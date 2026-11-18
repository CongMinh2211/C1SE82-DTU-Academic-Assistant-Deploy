import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Bộ dữ liệu chỉ chuẩn bị bản nháp; Admin phải rà soát và duyệt trước khi xuất bản.
const folder = path.resolve("knowledge/pending-review/international-capstone");
const profiles = JSON.parse(
  await readFile(path.join(folder, "profiles.json"), "utf8"),
);
const groups = [
  [
    "international-school",
    "international-school-directory.txt",
    "Đội ngũ Khoa Đào tạo Quốc tế",
  ],
  [
    "capstone-2026",
    "capstone-2026-mentors.txt",
    "Danh sách mentor Capstone 2026",
  ],
];
for (const [group, filename, title] of groups) {
  const entries = profiles.filter(
    (profile) => profile.directory_group === group,
  );
  if (!entries.length) throw new Error(`Không có hồ sơ nhóm ${group}`);
  const text = [
    title,
    "Dữ liệu đối chiếu lần gần nhất 25/10/2026; có thể thay đổi, cần xác nhận với đơn vị. Không tự suy ra thông tin bị thiếu.",
    ...entries.map((p) =>
      [
        `Họ tên: ${p.name}`,
        p.academic_degree && `Học hàm/học vị: ${p.academic_degree}`,
        p.position && `Chức vụ: ${p.position}`,
        p.department && `Đơn vị: ${p.department}`,
        p.email && `Email: ${p.email}`,
        p.phone && `Điện thoại theo nguồn: ${p.phone}`,
        p.scope && `Phạm vi: ${p.scope}`,
        `Nguồn gốc: ${p.source_url}`,
        `Ngày đối chiếu: ${p.verified_on}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n\n");
  await writeFile(path.join(folder, filename), text + "\n", {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(`${filename}: ${entries.length} bản ghi cần rà soát`);
}
