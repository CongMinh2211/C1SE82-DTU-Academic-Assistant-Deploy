"use client";
import { useState, type FormEvent } from "react";
import { api, useResource } from "@/lib/api-client";
import { Card, Button } from "@/components/ui";

type Schedule = { id:string; start_url:string; enabled:number; interval_hours:number; max_pages:number; last_message:string|null; last_status:string|null };
export function CrawlSchedules() {
  const schedules = useResource<{items:Schedule[]}>("admin/crawl-schedules");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget, data = new FormData(form);
    try {
      await api("admin/crawl-schedules", {method:"POST",body:JSON.stringify({url:data.get("url"),topic:data.get("topic"),scope:data.get("scope"),intervalHours:Number(data.get("intervalHours")),maxPages:Number(data.get("maxPages"))})});
      form.reset(); setMessage("Đã tạo lịch. Worker sẽ kiểm tra và đưa tài liệu mới vào hàng đợi chờ duyệt."); await schedules.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tạo lịch."); }
    finally { setBusy(false); }
  }
  return <Card className="stack">
    <h2>Lịch thu thập website DTU</h2>
    <p>Chỉ thu thập trang cùng website, tối đa 10 trang mỗi lượt và tôn trọng robots.txt. Nội dung mới cần được kiểm tra, duyệt và xuất bản.</p>
    <form className="stack" onSubmit={submit}>
      <label className="field">Trang bắt đầu<input className="input" type="url" name="url" placeholder="https://...duytan.edu.vn/" required /></label>
      <label className="field">Chủ đề<input className="input" name="topic" maxLength={80} required /></label>
      <label className="field">Phạm vi áp dụng<input className="input" name="scope" minLength={10} maxLength={1500} required /></label>
      <label className="field">Chu kỳ (giờ)<input className="input" name="intervalHours" type="number" min={6} max={168} defaultValue={24} required /></label>
      <label className="field">Số trang tối đa mỗi lượt<input className="input" name="maxPages" type="number" min={1} max={10} defaultValue={5} required /></label>
      <Button type="submit" disabled={busy}>Tạo lịch thu thập</Button>
    </form>
    {message && <p role="status">{message}</p>}
    {schedules.error && <p role="alert">Không tải được danh sách lịch thu thập.</p>}
    {schedules.data?.items.map(item => <div key={item.id} className="stack"><strong>{item.start_url}</strong><span>{item.enabled ? `Mỗi ${item.interval_hours} giờ · tối đa ${item.max_pages} trang` : "Đã dừng"}</span><small>{item.last_message || "Chưa chạy"}</small>{!!item.enabled && <Button type="button" onClick={async () => {try { await api(`admin/crawl-schedules/${item.id}/run-now`,{method:"POST"}); setMessage("Đã yêu cầu worker chạy lại lịch này."); await schedules.refresh(); } catch {setMessage("Không thể yêu cầu chạy lại.");}}}>Chạy lại</Button>}{!!item.enabled && <Button type="button" onClick={async () => {if (!window.confirm("Dừng lịch thu thập này?")) return; try { await api(`admin/crawl-schedules/${item.id}/disable`,{method:"POST"}); await schedules.refresh(); setMessage("Đã dừng lịch thu thập."); } catch {setMessage("Không thể dừng lịch. Vui lòng thử lại.");}}}>Dừng lịch</Button>}</div>)}
    <p>Facebook có thể yêu cầu đăng nhập hoặc cấp quyền API; chưa tự đọc bài hoặc đưa bài trong nhóm vào nguồn tin.</p>
  </Card>;
}
