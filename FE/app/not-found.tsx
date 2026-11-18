import Link from "next/link";
export default function NotFound() {
  return (
    <main
      className="empty-state"
      style={{ minHeight: "100dvh", justifyContent: "center" }}
    >
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này chưa có trong ứng dụng.</p>
      <Link className="btn btn-primary" href="/sinh-vien">
        Về trang chủ
      </Link>
    </main>
  );
}
