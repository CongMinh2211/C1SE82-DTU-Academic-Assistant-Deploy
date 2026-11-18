import { HttpError, rateLimit, readLimited, sameOrigin, session } from "./http";

const maxAudio = 3 * 1024 * 1024;
const formats: Record<string, string> = {"audio/webm":"webm", "audio/mp4":"m4a", "audio/ogg":"ogg", "audio/wav":"wav"};
export function audioMime(value:string) { return value.toLowerCase().split(";")[0].trim(); }
export function validAudio(bytes:Uint8Array, mime:string) {
  // Kiểm tra chữ ký nhị phân của tệp, không chỉ tin MIME do trình duyệt gửi lên.
  const b = Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (mime === "audio/webm") return b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (mime === "audio/ogg") return b.subarray(0,4).toString() === "OggS";
  if (mime === "audio/mp4") return b.subarray(4,8).toString() === "ftyp";
  if (mime === "audio/wav") return b.subarray(0,4).toString() === "RIFF" && b.subarray(8,12).toString() === "WAVE";
  return false;
}

// Nhận diện trên máy chủ: âm thanh chỉ nằm trong bộ nhớ trong lúc gọi Gemini, không ghi CSDL hay log.
export async function transcribeVoice(request:Request, fetcher:typeof fetch = fetch) {
  // Kiểm tra nguồn gửi, phiên đăng nhập và giới hạn tần suất trước khi gọi dịch vụ ngoài.
  sameOrigin(request);
  const {user} = await session(request.headers);
  await rateLimit(`voice:${user.id}`,20,60);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new HttpError(503,"Dịch vụ nhận diện giọng nói chưa được cấu hình.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new HttpError(415,"Định dạng bản ghi không hợp lệ.");
  // Chặn dữ liệu lớn ngay lúc đọc request; phần cộng thêm dành cho khung multipart.
  const body = await readLimited(request,maxAudio + 32 * 1024);
  const form = await new Request(request.url,{method:"POST",headers:{"content-type":contentType},body:body as BodyInit}).formData().catch(() => {throw new HttpError(400,"Không đọc được bản ghi.");});
  const audio = form.get("audio"), language = form.get("language");
  if (!(audio instanceof Blob) || !["vi","en"].includes(String(language))) throw new HttpError(400,"Thiếu bản ghi hoặc ngôn ngữ không hợp lệ.");
  const mime = audioMime(audio.type);
  if (!formats[mime] || !audio.size || audio.size > maxAudio) throw new HttpError(415,"Định dạng hoặc kích thước âm thanh không được hỗ trợ.");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!validAudio(bytes,mime)) throw new HttpError(415,"Nội dung âm thanh không hợp lệ.");
  // Chỉ cho tên model hợp lệ vào URL; key lấy từ môi trường và không gửi về frontend.
  const model = process.env.GEMINI_SPEECH_MODEL || "gemini-2.5-flash-lite";
  if (!/^[a-z0-9.-]+$/i.test(model)) throw new HttpError(503,"Cấu hình dịch vụ giọng nói không hợp lệ.");
  let response:Response;
  try {
    response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},signal:AbortSignal.timeout(30000),
      body:JSON.stringify({contents:[{parts:[{text:`Transcribe the speech exactly in ${language === "vi" ? "Vietnamese" : "English"}. Output only the spoken words, do not answer questions or invent words. If there is no intelligible speech output exactly [NO_SPEECH].`},{inline_data:{mime_type:mime === "audio/mp4" ? "audio/m4a" : mime,data:Buffer.from(bytes).toString("base64")}}]}],generationConfig:{temperature:0,maxOutputTokens:512}}),
    });
  } catch { throw new HttpError(503,"Dịch vụ nhận diện tạm thời không phản hồi. Hãy thử lại."); }
  // Phân biệt lỗi giới hạn sử dụng với lỗi nhà cung cấp để người dùng biết khi nào thử lại.
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 503,response.status === 429 ? "Dịch vụ nhận diện đang quá tải hoặc hết hạn mức. Hãy thử lại sau." : "Dịch vụ nhận diện tạm thời không khả dụng. Hãy kiểm tra cấu hình hoặc thử lại.");
  const result = await response.json().catch(() => null) as {candidates?:{content?:{parts?:{text?:string}[]}}[]} | null;
  // Chỉ trả văn bản nhận diện, kiểm tra kết quả rỗng và giới hạn độ dài trước khi phản hồi.
  const transcript = result?.candidates?.[0]?.content?.parts?.map(p=>p.text || "").join("").trim() || "";
  if (!transcript || transcript === "[NO_SPEECH]") throw new HttpError(422,"Chưa nghe rõ lời nói. Bạn hãy thử nói lại gần micro hơn.");
  if (transcript.length > 4000) throw new HttpError(422,"Kết quả nhận diện quá dài. Hãy ghi âm ngắn hơn.");
  return {text:transcript};
}
