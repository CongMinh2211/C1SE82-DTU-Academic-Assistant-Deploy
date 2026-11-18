// Mục đích file: Hiển thị thanh đầu trang và các thao tác điều hướng chính.
import { screens, type Screen } from "@/lib/routes";
import { useApp } from "@/components/app-provider";
import { Icon } from "@/components/ui";

import type { ShellNavigation } from "@/components/shell/use-shell-navigation";
export function ShellHeader({
  screen,
  menuTrigger,
  menuOpen,
  collapsed,
  toggleCollapsed,
  setMenuOpen,
  showModal,
  userTrigger,
  admin,
  userOpen,
  setUserOpen,
  user,
}: Pick<
  ShellNavigation,
  | "menuTrigger"
  | "menuOpen"
  | "collapsed"
  | "toggleCollapsed"
  | "setMenuOpen"
  | "showModal"
  | "userTrigger"
  | "admin"
  | "userOpen"
  | "setUserOpen"
  | "user"
> & { screen: Screen }) {
  const { language } = useApp();
  const breadcrumb = screens.find((item) => item.screen === screen)?.breadcrumb;
  const studentBreadcrumbs: Record<string, [string,string]> = {
    home:["Home / Student space","मुखपृष्ठ / छात्र क्षेत्र"],chat:["Chat / Academic assistant","चैट / शैक्षणिक सहायक"],faq:["Library / FAQs & procedures","पुस्तकालय / प्रश्न और प्रक्रियाएँ"],history:["Account / Chat history","खाता / चैट इतिहास"],feedback:["Support / Send feedback","सहायता / प्रतिक्रिया"],profile:["Account / Profile","खाता / प्रोफ़ाइल"],settings:["Account / Settings","खाता / सेटिंग्स"],source:["Chat / Source","चैट / स्रोत"]
  };
  const heading = !admin && language !== "vi" ? studentBreadcrumbs[screen]?.[language === "en" ? 0 : 1] || breadcrumb : breadcrumb;
  // Các nút dùng chung trạng thái menu với sidebar và thể hiện màn hình hiện tại.
  return (
    <header className="application-bar">
      <button
        ref={menuTrigger}
        type="button"
        className="mobile-menu icon-button"
        aria-label="Mở điều hướng"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        ☰
      </button>
      <button
        type="button"
        className="desktop-menu icon-button"
        aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
        aria-expanded={!collapsed}
        aria-controls="main-navigation"
        onClick={toggleCollapsed}
      >
        ☰
      </button>
      <p className="header-breadcrumb">
        {heading}
      </p>
      <span className="header-spacer" />
      <button
        type="button"
        className="icon-button notification-button"
        aria-label="Thông tin trợ lý"
        onClick={() =>
          showModal(
            "Thông tin trợ lý",
            <div className="stack">
              <p>
                Trợ lý tra cứu tài liệu học vụ và tự tìm thông tin liên quan DTU
                trên toàn web.
              </p>
              <p className="muted">
                Ưu tiên nguồn chính thức và ghi rõ nguồn cho thông tin tra cứu.
                Khi chưa xác minh được, trợ lý sẽ nói rõ.
              </p>
            </div>,
          )
        }
      >
        <Icon name="help" tone="muted" />
      </button>
      <button
        ref={userTrigger}
        type="button"
        className="header-user"
        aria-label={admin ? "Mở menu quản trị viên" : "Mở menu sinh viên"}
        aria-expanded={userOpen}
        aria-controls="account-menu"
        onClick={() => setUserOpen(!userOpen)}
      >
        <Icon name="user" />
        <strong>
          {admin
            ? "Quản trị viên"
            : user?.role === "admin"
              ? "Chào Admin"
              : `Chào ${user?.name.trim().split(/\s+/).at(-1) || "bạn"}`}
        </strong>
      </button>
    </header>
  );
}
