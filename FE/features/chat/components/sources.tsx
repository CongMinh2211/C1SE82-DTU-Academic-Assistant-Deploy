// Mục đích file: Hiển thị danh sách nguồn gắn với câu trả lời để người dùng đối chiếu.
"use client";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { studentCopy } from "@/lib/student-copy";
import { useEffect, useRef, useState } from "react";
import { routes } from "@/lib/routes";
import { dateText } from "@/lib/api-client";
import type { Citation, Message } from "@/lib/contracts";
import { Badge, Icon, IconTile } from "@/components/ui";

const sourceLabels: Record<string, string> = {
  official: "Nguồn DTU",
  institutional: "Cơ quan / tổ chức",
  press: "Báo chí",
  reference: "Nguồn tham khảo",
  other: "Cần đối chiếu",
};

export function citationLabel(c: Citation) {
  // Nguồn web hiển thị loại nhà xuất bản; tài liệu nội bộ hiển thị phiên bản.
  return c.documentId === "web"
    ? sourceLabels[c.sourceTier || "other"]
    : `Tài liệu • Phiên bản ${c.version}`;
}

export function Sources({
  answer,
  reveal,
  question,
}: {
  answer?: Message;
  reveal: number;
  question?: string;
}) {
  const { language } = useApp();
  const copy = studentCopy[language];
  const [open, setOpen] = useState(true);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Khi có yêu cầu xem nguồn, mở bảng chi tiết và cuộn tới vùng nguồn.
    if (!reveal) return;
    if (panel.current) panel.current.open = true;
    panel.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    panel.current?.focus({ preventScroll: true });
  }, [reveal]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1200px)");
    const update = () => setOpen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return (
    <details
      className="card source-evidence"
      ref={panel}
      tabIndex={-1}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span>
          <Icon name="file" size={20} />
          <strong>{copy.sources}</strong>
        </span>
        <Badge tone="blue">{answer?.citations.length || 0}</Badge>
        <span className="source-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="sources-body">
        {!!answer?.citations.length && question && (
          <p className="source-question" title={question}>
            <small>{copy.sourceFor}</small>
            {question}
          </p>
        )}
        {answer?.citations.map((c) => (
          <Link
            className="citation-card"
            key={c.id}
            href={`${routes.source}?message=${answer.id}&citation=${c.id}`}
          >
            <div className="citation-meta">
              <span
                className={`source-tier tier-${c.sourceTier || "document"}`}
              >
                {citationLabel(c)}
              </span>
              <span>[{c.id}]</span>
            </div>
            <strong>{c.title}</strong>
            <small>
              {c.documentId === "web"
                ? c.url && new URL(c.url).hostname.replace(/^www\./, "")
                : `${copy.page} ${c.page}${c.pageEnd > c.page ? `–${c.pageEnd}` : ""}`}
              {c.retrievedAt ? ` · ${dateText(c.retrievedAt)}` : ""}
            </small>
            <span>
              {copy.sourceLink} <span aria-hidden="true">↗</span>
            </span>
          </Link>
        ))}
        {!answer?.citations.length && (
          <div className="sources-empty">
            <IconTile name="file" tone="muted" size={40} />
            <p>{copy.emptySources}</p>
          </div>
        )}
        {!!answer?.citations.length && (
          <p className="source-note">
            {copy.scope}
          </p>
        )}
      </div>
    </details>
  );
}
