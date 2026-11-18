// Mục đích file: Hiển thị trang chủ sinh viên và các lối vào chức năng học vụ.
"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { VoiceInput } from "@/components/voice-input";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { useResource, dateText } from "@/lib/api-client";
import type { Conversation } from "@/lib/contracts";
import { useApp } from "@/components/app-provider";
import { homeCopy } from "@/lib/student-copy";
import { ResourceState, topics } from "@/components/live-shared";
import {
  Button,
  ButtonLink,
  CampusImage,
  Card,
  EmptyState,
  Icon,
  IconTile,
  Notice,
} from "@/components/ui";

export function StudentHome() {
  // Lấy người dùng và lịch sử để cá nhân hóa trang chủ.
  const router = useRouter(),
    { user, language } = useApp();
  const copy = homeCopy[language];
  const [input, setInput] = useState("");
  const history = useResource<Conversation[]>("conversations");
  // Chuyển câu hỏi không rỗng sang trang chat bằng tham số URL đã mã hóa.
  const ask = (q: string) => {
    if (q.trim())
      router.push(`${routes.chat}?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <>
      <section className="welcome-hero student-hero">
        <div className="welcome-copy">
          <div className="hero-brand">
            <div className="hero-brand-logos">
              <Image src="/figma/dtu-logo.png" alt="Đại học Duy Tân" width={104} height={51} />
              <span className="hero-brand-divider" aria-hidden="true" />
              <Image className="hero-international-logo" src="/figma/dtu-international-school-logo.png" alt="Khoa Đào tạo Quốc tế - Đại học Duy Tân" width={180} height={22} />
            </div>
            <span><b>DTU</b> Academic Assistant</span>
          </div>
          <strong className="student-hero-greeting">{copy.hello}, {user?.role === "admin" ? "ADMIN" : user?.name.trim().split(/\s+/).at(-1)?.toUpperCase()}</strong>
          <h1>{copy.title}</h1>
          <p>{copy.desc}</p>
          <label htmlFor="home-question" className="hero-question-hint">
            <span className="hero-hint-icon" aria-hidden="true">✦</span>
            {copy.hint}
            <span className="hero-pointing-hand" aria-hidden="true">👇</span>
          </label>
          <form
            className="question-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <Icon name="search" tone="muted" />
            <input
              id="home-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={copy.placeholder}
              placeholder={copy.placeholder}
              required
              maxLength={2500}
            />
            <VoiceInput value={input} onChange={setInput} />
            <Button type="submit">{copy.send}</Button>
          </form>
          <div className="hero-suggestions"><strong>{copy.try}</strong>{copy.suggestions.map(q => <button type="button" key={q} onClick={() => ask(q)}>{q}</button>)}</div>
        </div>
        <div className="student-hero-visual">
          <CampusImage variant="home" priority />
          <div className="hero-mascot-wrap">
            <Image className="hero-mascot" src="/figma/dtu-assistant-mascot-chest.png" alt="Robot trợ lý DTU đang chào" width={480} height={440} priority />
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>{copy.discover}</h2>
        <ButtonLink href={routes.faq}>{copy.faq}</ButtonLink>
      </div>
      <div className="topic-grid">
        {topics.slice(0, 4).map((t, i) => (
          <Link
            key={t}
            className={`topic-card ${["tone-blue", "tone-teal", "topic-purple", "tone-amber"][i]}`}
            href={`${routes.faq}?chu-de=${encodeURIComponent(t)}`}
          >
            <strong>{copy.topics[i]}</strong>
            <p>
              {copy.details[i]}
            </p>
            <span>{copy.explore} →</span>
          </Link>
        ))}
      </div>
      <div className="equal-columns home-info">
        <Card>
          <div className="card-title">
            <Icon name="help" />
            <h2>{copy.suggest}</h2>
          </div>
          {[
            "HKI năm học 2026-2027 được đăng ký tối đa bao nhiêu tín chỉ?",
            "Học phí K31 ngành Công nghệ Phần mềm mã 102 năm học 2026-2027 là bao nhiêu?",
            "Điều kiện công nhận tốt nghiệp đợt tháng 9/2026 là gì?",
          ].map((q) => (
            <button key={q} className="record" onClick={() => ask(q)}>
              <IconTile name="chat" />
              <span className="record-copy">
                <strong>{q}</strong>
                <small>{copy.published}</small>
              </span>
              <Icon name="chevron" tone="muted" size={20} />
            </button>
          ))}
        </Card>
        <Card>
          <h2>Tiếp tục câu chuyện của bạn</h2>
          <ResourceState {...history} retry={history.refresh} />
          {history.data?.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              className="record"
              href={`${routes.chat}?c=${c.id}`}
            >
              <IconTile name="clock" />
              <span className="record-copy">
                <strong>{c.title}</strong>
                <small>{dateText(c.updated_at)}</small>
              </span>
              <Icon name="chevron" tone="muted" size={20} />
            </Link>
          ))}
          {history.data?.length === 0 && (
            <EmptyState>
              Những cuộc trò chuyện của bạn sẽ xuất hiện ở đây.
            </EmptyState>
          )}
          <ButtonLink href={routes.history}>Xem lịch sử hỏi đáp</ButtonLink>
        </Card>
      </div>
      <Notice title="Kiểm tra đúng phạm vi áp dụng">
        Cho biết khóa, ngành/chương trình và học kỳ hoặc đợt xét để trợ lý tìm
        nguồn phù hợp.
      </Notice>
      <footer className="student-contact-footer" aria-label="Thông tin liên hệ Đại học Duy Tân">
        <div className="student-contact-intro">
          <span>HỖ TRỢ SINH VIÊN</span>
          <h2>Cần thêm sự hỗ trợ?</h2>
          <p>Liên hệ trực tiếp đơn vị phù hợp để được hướng dẫn cụ thể.</p>
          <a href="https://duytan.edu.vn/ContactUs" target="_blank" rel="noopener noreferrer">Xem danh bạ chính thức DTU ↗</a>
        </div>
        <div className="student-contact-grid">
          <div><strong>Ban Đào tạo</strong><span>K7/25 Quang Trung, Đà Nẵng</span><a href="tel:02362243775">0236 224 3775</a><a href="mailto:bandaotao@duytan.edu.vn">bandaotao@duytan.edu.vn</a></div>
          <div><strong>Văn phòng Đại học Duy Tân</strong><span>03 Quang Trung, Đà Nẵng</span><a href="tel:02363827111">0236 382 7111</a></div>
          <div><strong>Khoa Đào tạo Quốc tế</strong><span>Thông tin văn phòng theo trang liên hệ của khoa</span><a href="tel:02367109922">0236 710 9922 · máy lẻ 137</a><a href="https://is.duytan.edu.vn/contact" target="_blank" rel="noopener noreferrer">Xem thông tin khoa ↗</a></div>
          <div><strong>Tư vấn tuyển sinh</strong><span>Trung tâm Tuyển sinh DTU</span><a href="tel:19002252">1900 2252</a><a href="tel:0905294390">0905 294 390</a></div>
        </div>
        <details className="faculty-contacts">
          <summary>Danh bạ khoa và văn phòng theo cơ sở <span aria-hidden="true">↓</span></summary>
          <p>Thông tin được trích từ trang chính thức của từng đơn vị. Vui lòng gọi xác nhận trước khi đến.</p>
          <div className="faculty-contact-grid">
            {[
              ["Khoa Đào tạo Quốc tế", "P.601 - 254 Nguyễn Văn Linh; P.204–205 nhà G - 120 Hoàng Minh Thảo", "0236 710 9922 · máy lẻ 137", "02367109922", "https://is.duytan.edu.vn/contact"],
              ["Khoa Kinh tế - Tài chính", "P.301 - 254 Nguyễn Văn Linh", "0236 365 0403 · máy lẻ 129/405", "02363650403", "https://kkttc.duytan.edu.vn/contact"],
              ["Khoa Quản trị Kinh doanh", "P.201 - 254 Nguyễn Văn Linh", "0236 365 0403 · máy lẻ 128", "02363650403", "https://kqtkd.duytan.edu.vn/lien-he"],
              ["Khoa Tiếng Trung", "P.702, tầng 7 - 254 Nguyễn Văn Linh", "0236 365 0403 · máy lẻ 621", "02363650403", "https://ktiengtrung.duytan.edu.vn/contact"],
              ["Khoa Mỹ thuật Ứng dụng", "P.101C, khu B - 120 Hoàng Minh Thảo", "0236 710 9922 · máy lẻ 142", "02367109922", "https://khoamtud.duytan.edu.vn/lien-he"],
              ["Khoa Kiến trúc", "P.405D - 120 Hoàng Minh Thảo", "0236 382 7111 · máy lẻ 203", "02363827111", "https://kkientruc.duytan.edu.vn/lien-he/"],
              ["Khoa Dược", "P.201, nhà C - 120 Hoàng Minh Thảo", "0236 710 9922 · máy lẻ 302", "02367109922", "https://cmp.duytan.edu.vn/khoa-duoc-1ea/gioi-thieu-khoa-duoc-x2s"],
              ["Khoa Y", "P.402, nhà F - 120 Hoàng Minh Thảo", "0236 382 7111 · máy lẻ 402", "02363827111", "https://med.duytan.edu.vn/tong-quan-j57/khoa-y-truong-dai-hoc-duy-tanbht9i"],
              ["Khoa Răng - Hàm - Mặt", "P.412, nhà F - 120 Hoàng Minh Thảo", "0236 382 7111 · máy lẻ 412", "02363827111", "https://cmp.duytan.edu.vn/khoa-rang-ham-mat-32m/gioi-thieu-ve-khoa-rang-ham-mat-truong-dai-ho"],
              ["Trung tâm Tư vấn tuyển sinh Khoa Đào tạo Quốc tế", "P.111 - 209 Phan Thanh", "0236 710 9922 · máy lẻ 137", "02367109922", "https://is.duytan.edu.vn/contact"],
            ].map(([name, address, phone, number, source]) => <div className="faculty-contact-card" key={name}>
              <strong>{name}</strong><span>{address}, Đà Nẵng</span><a href={`tel:${number}`}>{phone}</a><a href={source} target="_blank" rel="noopener noreferrer">Xem nguồn chính thức ↗</a>
            </div>)}
          </div>
          <p>Chưa có số riêng được xác minh cho mọi cơ sở. Tổng đài DTU: <a href="tel:02363650403">0236 365 0403</a>. Các ngành hoặc đơn vị khác: <a href="https://duytan.edu.vn/ContactUs" target="_blank" rel="noopener noreferrer">xem danh bạ DTU ↗</a>.</p>
        </details>
        <div className="student-social-links"><strong>Kênh cộng đồng</strong><a href="https://www.facebook.com/DTU.InternationalSchool" target="_blank" rel="noopener noreferrer">Khoa Đào tạo Quốc tế trên Facebook ↗</a><a href="https://www.facebook.com/groups/goctintucdtu" target="_blank" rel="noopener noreferrer">Nhóm Góc tin tức DTU ↗</a><small>Nội dung Facebook có thể yêu cầu đăng nhập; hãy đối chiếu thông báo quan trọng với trang chính thức DTU.</small></div>
      </footer>
    </>
  );
}
