// Mục đích file: Truy xuất bằng chứng từ kho dữ liệu, giữ phạm vi và số trang của đoạn được chọn.
import { row, rows } from "../db";
import { normalize, type SourcePage } from "./parser";
import { embedTexts } from "./embeddings";
import { usableForQuestion, preferRecentWithinScope } from "./source-validity";
import { EvidenceCache } from "./evidence-cache";
import { universityDate } from "./date";
import { QueryVectorCache } from "./query-vector-cache";
import { vectors, vectorIndex } from "./vectors";
export type Evidence = {
  id: string;
  chunkId: string;
  documentId: string;
  revisionId: string;
  title: string;
  version: number;
  page: number;
  pageEnd: number;
  section: string;
  text: string;
  scope: string;
  url?: string;
  retrievedAt?: string;
  publishedAt?: string;
  sourceTier?: import("../web-sources").SourceTier;
  assessment?: string;
  discoveredBy?: string;
  score: number;
  issuedOn?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  scopeKey?: string | null;
};
const queryVectors = new QueryVectorCache();
const retrievalCache = new EvidenceCache<Evidence[]>();
type ChunkRow = {
  id: string;
  document_id: string;
  revision_id: string;
  title: string;
  version: number;
  page: number;
  page_end: number;
  section: string;
  text: string;
  scope: string;
  source_url: string | null;
  search_text: string;
  issued_on: string | null;
  effective_from: string | null;
  effective_until: string | null;
  scope_key: string | null;
};
function validity(row: Pick<ChunkRow, "issued_on" | "effective_from" | "effective_until" | "scope_key">) {
  return { issuedOn: row.issued_on, effectiveFrom: row.effective_from, effectiveUntil: row.effective_until, scopeKey: row.scope_key };
}
function usable(row: Pick<ChunkRow, "issued_on" | "effective_from" | "effective_until" | "scope_key">, question: string) {
  return usableForQuestion(row, question);
}
// Không chỉ dựa vào active_revision: phiên bản cũng phải thực sự ở trạng thái công bố.
const select = `SELECT c.*,r.title_snapshot title,r.scope_snapshot scope,r.source_url,r.version,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM chunks c JOIN documents d ON d.id=c.document_id JOIN revisions r ON r.id=c.revision_id AND r.document_id=d.id WHERE d.deleted_at IS NULL AND d.active_revision=c.revision_id AND r.status='published'`;
// Nhận diện câu hỏi về học phí, kể cả cách hỏi giá một tín chỉ.
export function tuitionQuestion(question: string) {
  const text = normalize(question);
  return (
    /hoc phi|tuition|(?:credit|semester) fee|cost per credit/.test(text) ||
    (/\b(?:1|mot|moi)\s+tin(?:\s+chi)?\b/.test(text) &&
      /\b(?:bao nhieu|gia|phi|tien|cost|price)\b/.test(text) &&
      !/\b(?:gio|tiet|hours?)\b/.test(text))
  );
}
export function questionCohort(question: string) {
  return questionCohorts(question)[0];
}
export function questionCohorts(question: string) {
  return [
    ...new Set(
      [
        ...normalize(question).matchAll(/\bk\s*(\d{2})\b|\bkhoa\s*(\d{2})\b/g),
      ].map((match) => match[1] || match[2]),
    ),
  ];
}
export function questionMajorCodes(question: string) {
  return [
    ...new Set(
      [...question.matchAll(/\b\d{3}(?:\s*\([A-Za-z]+\))?(?![\w(])/g)]
        .filter(
          (match) =>
            !/^\s*(?:tin chi|credits?|dong|vnd|ngay|days?|%|hours?)/.test(
              normalize(question.slice((match.index || 0) + match[0].length)),
            ),
        )
        .map((match) => match[0].replace(/\s/g, "").toLowerCase()),
    ),
  ];
}
export function expand(question: string) {
  const text = normalize(question);
  const synonyms: [RegExp, string][] = [
    [/tuition|fees?/g, "hoc phi don gia tin chi hoc ky"],
    [/graduat|diploma|degree/g, "tot nghiep dieu kien"],
    [/register|enrol/g, "dang ky hoc phan"],
    [/grade|score|gpa/g, "diem trung binh tich luy"],
    [/prerequisite/g, "tien quyet"],
    [/withdraw/g, "rut huy bo dang ky"],
    [/english|ielts|toeic/g, "ngoai ngu chung chi"],
    // Bổ sung từ tương đương để tìm được tài liệu tiếng Việt từ câu hỏi tiếng Anh.
    [/\b(?:exam|examination|test)\b/g, "thi kiem tra lich thi"],
    [/\b(?:schedule|timetable)\b/g, "lich hoc lich thi thoi khoa bieu"],
    [/\b(?:pay|payment|transfer|bank|cash)\b/g, "nop thanh toan chuyen khoan ngan hang tien mat"],
    [/\b(?:credit|credits)\b/g, "tin chi"],
    [/\b(?:scholarship|scholarships)\b/g, "hoc bong"],
    [/\b(?:lecturer|lecturers|professor|teacher|faculty)\b/g, "giang vien giang day khoa"],
    [/\b(?:contact|phone|address|office)\b/g, "lien he dien thoai dia chi van phong"],
    [/\b(?:residence|accommodation|off-campus)\b/g, "khai bao ngoai tru noi o"],
    [/\b(?:evaluation|evaluate|assessment)\b/g, "danh gia khao sat"],
    [/\b(?:conduct|training)\b/g, "ren luyen"],
    [/\b(?:rules|regulations|policy)\b/g, "noi quy quy dinh quy che"],
    [/\b(?:classroom|laboratory|lab)\b/g, "lop hoc phong hoc phong may"],
    [/\b(?:advisor|adviser)\b/g, "co van hoc tap"],
  ];
  return (
    text +
    " " +
    (tuitionQuestion(question) ? "hoc phi don gia tin chi " : "") +
    synonyms
      .filter(([re]) => re.test(text))
      .map(([, words]) => words)
      .join(" ")
  );
}
// Prose clauses often continue across a page or a list. Keep table rows atomic,
// but give the agent whole source pages so a matching heading cannot hide the
// remaining conditions. Citation text is taken verbatim from saved pages.
export function withPageContext(
  anchors: Evidence[],
  pagesByRevision: Map<string, SourcePage[]>,
): Evidence[] {
  const seen = new Set<string>();
  let characters = 0;
  const result: Evidence[] = [];
  for (const anchor of anchors) {
    const tableRow = /^\d+\s*\|/m.test(anchor.text);
    const pages = (pagesByRevision.get(anchor.revisionId) || []).filter(
      (p) => p.page >= anchor.page && p.page <= anchor.pageEnd,
    );
    const text = pages.map((p) => p.text).join("\n\n");
    const expanded =
      !tableRow &&
      text &&
      !pages.some((p) => /^\d+\s*\|/m.test(p.text)) &&
      text.length <= 14000 &&
      characters + text.length <= 60000;
    const key = expanded
      ? `${anchor.revisionId}:${anchor.page}-${anchor.pageEnd}`
      : anchor.chunkId;
    if (seen.has(key)) continue;
    seen.add(key);
    characters += expanded ? text.length : anchor.text.length;
    result.push({ ...anchor, text: expanded ? text : anchor.text });
  }
  return result;
}
// Tìm dòng học phí theo khóa và mã ngành để hạn chế nhầm giữa các chương trình.
export async function exactTuitionEvidence(
  question: string,
): Promise<Evidence[]> {
  const codes = questionMajorCodes(question);
  if (!codes.length) return [];
  const exact = await rows<ChunkRow>(
    `${select} AND (${codes.map(() => "c.text LIKE ?").join(" OR ")}) ORDER BY c.id`,
    ...codes.map((code) => `%| ${code.toUpperCase()} |%`),
  );
  return exact.filter(c => usable(c, question)).map((c, i) => ({
    id: `S${i + 1}`,
    chunkId: c.id,
    documentId: c.document_id,
    revisionId: c.revision_id,
    title: c.title,
    version: c.version,
    page: c.page,
    pageEnd: c.page_end,
    section: c.section,
    text: c.text,
    scope: c.scope + (c.effective_from && c.effective_until ? "" : " [Chưa xác minh đầy đủ thời hạn hiệu lực; không khẳng định đang có hiệu lực.]"),
    ...(c.source_url ? { url: c.source_url } : {}),
    score: 1,
    ...validity(c),
  }));
}

// Kết hợp các cách tìm kiếm để lấy những đoạn nguồn liên quan đến câu hỏi.
export async function retrieve(question: string): Promise<Evidence[]> {
  // Chỉ đưa các phiên bản đang hoạt động vào tập tìm kiếm của sinh viên.
  const activeRows = (
    await rows<{
      active_revision: string; issued_on: string | null; effective_from: string | null; effective_until: string | null; scope_key: string | null;
    }>(
      "SELECT d.active_revision,r.issued_on,r.effective_from,r.effective_until,r.scope_key FROM documents d JOIN revisions r ON r.id=d.active_revision AND r.document_id=d.id WHERE d.deleted_at IS NULL AND r.status='published'",
    )
  ).filter(r => usable(r, question));
  // Nếu không còn phiên bản phù hợp, dừng ngay để không truy vấn toàn bộ kho vector.
  const active = activeRows.map((r) => r.active_revision);
  if (!active.length) return [];
  // Kiểm tra trạng thái nguồn mỗi lượt; khóa đổi ngay khi duyệt, gỡ hay sửa ngày/phạm vi.
  const fingerprint = activeRows.map(r => [r.active_revision,r.issued_on,r.effective_from,r.effective_until,r.scope_key]).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  return retrievalCache.get(question, [universityDate(), fingerprint], async () => {
  // Mở rộng cách diễn đạt và tách khóa/mã ngành nhằm hỗ trợ cả từ khóa lẫn ngữ nghĩa.
  const query = expand(question),
    cohorts = questionCohorts(question),
    majorCodes = questionMajorCodes(question);
  const terms = [...new Set(query.match(/[a-z0-9]{2,}/g) || [])]
    .filter(
      (t) =>
        ![
          "la",
          "gi",
          "em",
          "toi",
          "the",
          "and",
          "can",
          "what",
          "how",
          "cho",
          "cua",
          "bao",
          "nhieu",
          "xin",
          "minh",
          "duoc",
          "voi",
        ].includes(t),
    )
    .slice(0, 36);
  // Tìm theo từ khóa trước để giữ các thuật ngữ và mã ngành xuất hiện chính xác.
  const scores = new Map<string, number>();
  let lexical: {
    id: string;
  }[] = [];
  if (terms.length)
    lexical = await rows<{
      id: string;
    }>(
      `SELECT id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT 100`,
      terms.map((t) => `"${t}"`).join(" OR "),
    );
  // Cộng điểm theo thứ hạng; hai bộ tìm kiếm đóng góp độc lập vào cùng một chunk.
  lexical.forEach((r, i) => scores.set(r.id, 1 / (40 + i)));
  // Tìm theo ngữ nghĩa để hỗ trợ cách diễn đạt khác từ ngữ trong tài liệu.
  // Vector của cùng câu hỏi được tái sử dụng ngắn hạn; nguồn vẫn luôn tìm lại từ dữ liệu đang công bố.
  const queryVector = await queryVectors.get(
    question,
    async () => (await embedTexts([question], "query"))[0],
  );
  const vectorStore = await vectors();
  const semantic = await vectorStore.query({
    indexName: vectorIndex,
    queryVector,
    topK: 100,
    filter: { revisionId: { $in: active } },
  });
  // Chỉ cộng điểm cho kết quả vector đạt ngưỡng tối thiểu; điểm này không phải xác suất đúng.
  semantic.forEach((r, i) => {
    if (r.score >= 0.66)
      scores.set(r.id, (scores.get(r.id) || 0) + 1 / (40 + i));
  });
  const semanticScores = new Map(semantic.map((r) => [r.id, r.score]));
  const candidates: Evidence[] = [];
  // Ghép điểm hai cách tìm, rồi đọc lại các đoạn thuộc phiên bản đang hoạt động.
  const matchedIds = [...scores.keys()];
  const matched = matchedIds.length
    ? await rows<ChunkRow>(
        `${select} AND c.id IN (${matchedIds.map(() => "?").join(",")})`,
        ...matchedIds,
      )
    : [];
  const byId = new Map(matched.map((c) => [c.id, c]));
  // Tìm riêng dòng có mã ngành chính xác để không bỏ sót khi dòng nằm ngoài top 100.
  // Câu hỏi diễn đạt lại vẫn có thể tìm được mã nếu dữ liệu nguồn thực sự chứa mã đó.
  if (tuitionQuestion(question) && majorCodes.length) {
    const exact = await rows<ChunkRow>(
      `${select} AND (${majorCodes.map(() => "c.text LIKE ?").join(" OR ")})`,
      ...majorCodes.map((code) => `%| ${code.toUpperCase()} |%`),
    );
    for (const c of exact) {
      byId.set(c.id, c);
      scores.set(c.id, (scores.get(c.id) || 0) + 0.2);
    }
  }
  for (const [chunkId, score] of scores) {
    const c = byId.get(chunkId);
    if (!c || !usable(c, question)) continue;
    if (
      tuitionQuestion(question) &&
      cohorts.length &&
      /hoc phi/.test(normalize(c.title)) &&
      !cohorts.some((cohort) =>
        new RegExp(`\\bk${cohort}\\b`).test(normalize(c.title)),
      )
    )
      continue;
    // Đoạn ít từ trùng cần điểm ngữ nghĩa cao hơn để giảm nguồn không liên quan.
    const lexicalHits = terms.filter((t) => c.search_text.includes(t)).length;
    if (lexicalHits < 2 && (semanticScores.get(chunkId) || 0) < 0.81) continue;
    const rowCode = c.text
      .split("\n")
      .find((line) => /^\d+\s*\|/.test(line))
      ?.split("|")[2]
      ?.trim();
    if (
      tuitionQuestion(question) &&
      majorCodes.length &&
      rowCode &&
      !majorCodes.includes(rowCode.replace(/\s/g, "").toLowerCase())
    )
      continue;
    // Tăng nhẹ thứ hạng dòng có mã chính xác, nhưng không tự tạo nội dung hay học phí.
    const exactBoost =
      rowCode && majorCodes.includes(rowCode.replace(/\s/g, "").toLowerCase())
        ? 0.1
        : 0;
    candidates.push({
      id: "",
      chunkId: c.id,
      documentId: c.document_id,
      revisionId: c.revision_id,
      title: c.title,
      version: c.version,
      page: c.page,
      pageEnd: c.page_end,
      section: c.section,
      text: c.text,
      scope: c.scope + (c.effective_from && c.effective_until ? "" : " [Chưa xác minh đầy đủ thời hạn hiệu lực; không khẳng định đang có hiệu lực.]"),
      ...(c.source_url ? { url: c.source_url } : {}),
      score: score + exactBoost,
      ...validity(c),
    });
  }
  // Nếu người dùng nêu số điều, ưu tiên đoạn thuộc đúng điều đó trong tập đã tìm được.
  const article = normalize(question).match(
    /\b(?:dieu|article)\s+(\d+)\b/,
  )?.[1];
  if (article) {
    for (const candidate of candidates)
      if (new RegExp(`^dieu ${article}\\.`).test(normalize(candidate.section)))
        candidate.score += 0.15;
  }
  candidates.sort((a, b) => b.score - a.score);
  // Chỉ loại bản cũ khi quản trị viên đã xác nhận cùng phạm vi và cả hai có ngày hiệu lực.
  // Nếu câu hỏi nêu năm cụ thể, không tự gộp các giai đoạn theo nhóm mới nhất.
  const explicitYear = /\b20\d{2}\b/.test(question);
  const newest = new Map<string, string>();
  if (!explicitYear) for (const c of activeRows) {
    if (!c.scope_key || !c.issued_on || !c.effective_from || !c.effective_until) continue;
    const old = newest.get(c.scope_key);
    if (!old || old < c.issued_on) newest.set(c.scope_key, c.issued_on);
  }
  const preferred = candidates.filter(c => !c.scopeKey || !c.issuedOn || !c.effectiveFrom || !c.effectiveUntil || !newest.has(c.scopeKey) || c.issuedOn === newest.get(c.scopeKey));
  const chosen = preferRecentWithinScope(preferred).slice(0, 10);
  // Bổ sung đoạn tiếp theo khi điều khoản vắt qua trang; chỉ lấy từ cùng phiên bản đang công bố.
  for (const anchor of [...chosen]) {
    if (!anchor.section || /^\d+\s*\|/m.test(anchor.text)) continue;
    const tail = await row<ChunkRow>(
      `${select} AND c.revision_id=? AND c.page=? ORDER BY c.rowid DESC LIMIT 1`,
      anchor.revisionId,
      anchor.pageEnd,
    );
    const next = await row<ChunkRow>(
      `${select} AND c.revision_id=? AND c.page=? ORDER BY c.rowid LIMIT 1`,
      anchor.revisionId,
      anchor.pageEnd + 1,
    );
    const continuation =
      tail?.section && next?.section === tail.section ? next : undefined;
    if (
      continuation &&
      !chosen.some(
        (c) =>
          c.revisionId === continuation.revision_id &&
          c.page === continuation.page,
      )
    )
      chosen.push({
        ...anchor,
        chunkId: continuation.id,
        page: continuation.page,
        pageEnd: continuation.page_end,
        text: continuation.text,
      });
  }
  // Include binding transition provisions alongside the general regulation.
  if (chosen.some((c) => c.title === "Quy chế đào tạo trình độ đại học")) {
    const transition = (
      await rows<ChunkRow>(
        `${select} AND d.title='Quy chế đào tạo trình độ đại học' AND c.page>=23 ORDER BY c.page,c.id`,
      )
    ).filter(c => usable(c, question)).filter((c) =>
      /Điều 27|áp dụng đối với khóa|khóa tuyển sinh|chuyển tiếp/.test(c.text),
    );
    for (const c of transition.slice(0, 2))
      if (!chosen.some((x) => x.chunkId === c.id))
        chosen.push({
          id: "",
          chunkId: c.id,
          documentId: c.document_id,
          revisionId: c.revision_id,
          title: c.title,
          version: c.version,
          page: c.page,
          pageEnd: c.page_end,
          section: c.section,
          text: c.text,
          scope: c.scope + (c.effective_from && c.effective_until ? "" : " [Chưa xác minh đầy đủ thời hạn hiệu lực; không khẳng định đang có hiệu lực.]"),
          ...validity(c),
          score: 0,
        });
  }
  const parents = new Map<string, SourcePage[]>();
  for (const revisionId of new Set(chosen.map((c) => c.revisionId))) {
    const revision = await row<{
      pages_json: string;
    }>("SELECT pages_json FROM revisions WHERE id=?", revisionId);
    parents.set(revisionId, JSON.parse(revision?.pages_json || "[]"));
  }
  return withPageContext(chosen, parents).map((c, i) => ({
    ...c,
    id: `S${i + 1}`,
  }));
  });
}
