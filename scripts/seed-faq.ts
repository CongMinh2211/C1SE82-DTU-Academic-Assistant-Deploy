import { row, db, id, now, audit } from "../BE/db";
const administrator = await row<{
  id: string;
}>("SELECT id FROM user WHERE role='admin' ORDER BY createdAt LIMIT 1");
if (!administrator) throw new Error("Run setup first");
const definitions = [
  {
    document: "TL03",
    pattern: "%19 tín chỉ đối với sinh viên chương trình thường%",
    question:
      "HKI 2026–2027, sinh viên chương trình thường được đăng ký tối đa bao nhiêu tín chỉ?",
    topic: "Đăng ký học phần",
  },
  {
    document: "TL03",
    pattern: "%Áp dụng điều kiện đăng ký lỏng%",
    question:
      "Thông báo HKI 2026–2027 quy định thế nào về học phần tiên quyết đang học chưa có điểm?",
    topic: "Đăng ký học phần",
  },
  {
    document: "TL03",
    pattern: "%Thời gian bỏ đăng ký học phần%",
    question:
      "Mốc bỏ đăng ký học phần nhận điểm W/R trong thông báo HKI 2026–2027 là khi nào?",
    topic: "Đăng ký học phần",
  },
  {
    document: "TL02",
    pattern: "%Sinh viên thiếu chứng chỉ GDQP-AN%",
    question:
      "Đợt tốt nghiệp tháng 9/2026, thiếu chuẩn đầu ra có được bảo vệ ĐATN/KLTN không?",
    topic: "Tốt nghiệp",
  },
];
for (const definition of definitions) {
  if (await row("SELECT id FROM faqs WHERE question=?", definition.question))
    continue;
  const source = await row<{
    id: string;
    text: string;
    title_snapshot: string;
    scope_snapshot: string;
  }>(
    "SELECT c.*,r.title_snapshot,r.scope_snapshot FROM chunks c JOIN documents d ON d.active_revision=c.revision_id JOIN revisions r ON r.id=c.revision_id WHERE c.document_id=? AND c.text LIKE ? AND d.deleted_at IS NULL LIMIT 1",
    definition.document,
    definition.pattern,
  );
  if (!source) continue;
  const key = id();
  await db()
    .prepare("INSERT INTO faqs VALUES (?,?,?,?,?,?,?,?)")
    .run(
      key,
      definition.question,
      `Theo tài liệu “${source.title_snapshot}”:\n\n${source.text}\n\nPhạm vi: ${source.scope_snapshot}`,
      definition.topic,
      source.id,
      "published",
      administrator.id,
      now(),
    );
  await audit(administrator.id, "faq.seeded_from_canonical_source", key);
}
console.log(
  JSON.stringify({
    event: "faq_seeded",
    count: (
      await row<{
        n: number;
      }>("SELECT count(*) n FROM faqs")
    )?.n,
  }),
);
