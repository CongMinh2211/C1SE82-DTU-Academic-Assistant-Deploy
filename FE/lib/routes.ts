export const routes = {
  login: "/dang-nhap",
  register: "/dang-ky",
  resetPassword: "/dat-lai-mat-khau",
  profile: "/sinh-vien/tai-khoan",
  settings: "/sinh-vien/cai-dat",
  adminSettings: "/quan-tri/cai-dat",
  analytics: "/quan-tri/thong-ke",
  users: "/quan-tri/tai-khoan",
  home: "/sinh-vien",
  chat: "/sinh-vien/hoi-dap",
  fallback: "/sinh-vien/hoi-dap/chua-du-nguon",
  faq: "/sinh-vien/faq",
  history: "/sinh-vien/lich-su",
  feedback: "/sinh-vien/gop-y",
  source: "/sinh-vien/nguon",
  sent: "/sinh-vien/gop-y/da-gui",
  dashboard: "/quan-tri",
  documents: "/quan-tri/tai-lieu",
  addSource: "/quan-tri/tai-lieu/them",
  indexing: "/quan-tri/xu-ly-tai-lieu",
  adminFaq: "/quan-tri/faq",
  review: "/quan-tri/phan-hoi",
  audit: "/quan-tri/nhat-ky",
  faqEditor: "/quan-tri/faq/bien-soan",
} as const;

export type Screen = keyof typeof routes;

export const screens: {
  screen: Screen;
  figmaId: string;
  title: string;
  breadcrumb: string;
}[] = [
  { screen: "login", figmaId: "3:2", title: "Đăng nhập", breadcrumb: "" },
  { screen: "register", figmaId: "", title: "Đăng ký", breadcrumb: "" },
  {
    screen: "resetPassword",
    figmaId: "",
    title: "Đặt lại mật khẩu",
    breadcrumb: "",
  },
  {
    screen: "profile",
    figmaId: "",
    title: "Tài khoản",
    breadcrumb: "Tài khoản / Thông tin cá nhân",
  },
  {
    screen: "users",
    figmaId: "",
    title: "Quản lý tài khoản",
    breadcrumb: "Quản trị / Tài khoản",
  },
  {
    screen: "settings",
    figmaId: "",
    title: "Cài đặt",
    breadcrumb: "Tài khoản / Cài đặt",
  },
  {
    screen: "adminSettings",
    figmaId: "",
    title: "Cài đặt",
    breadcrumb: "Quản trị / Cài đặt",
  },
  {
    screen: "analytics",
    figmaId: "",
    title: "Thống kê",
    breadcrumb: "Quản trị / Thống kê sử dụng",
  },
  {
    screen: "home",
    figmaId: "4:2",
    title: "Trang chủ",
    breadcrumb: "Trang chủ / Không gian sinh viên",
  },
  {
    screen: "chat",
    figmaId: "4:48",
    title: "Hỏi đáp học vụ",
    breadcrumb: "Hỏi đáp / Trợ lý học vụ",
  },
  {
    screen: "fallback",
    figmaId: "4:28",
    title: "Chưa đủ nguồn",
    breadcrumb: "Hỏi đáp / Chưa đủ nguồn",
  },
  {
    screen: "faq",
    figmaId: "6:2",
    title: "FAQ & thủ tục",
    breadcrumb: "Thư viện / FAQ & thủ tục",
  },
  {
    screen: "history",
    figmaId: "6:33",
    title: "Lịch sử hỏi đáp",
    breadcrumb: "Tài khoản / Lịch sử hỏi đáp",
  },
  {
    screen: "feedback",
    figmaId: "6:64",
    title: "Gửi góp ý",
    breadcrumb: "Hỗ trợ / Gửi góp ý",
  },
  {
    screen: "source",
    figmaId: "41:1326",
    title: "Chi tiết nguồn",
    breadcrumb: "Hỏi đáp / Trợ lý học vụ",
  },
  {
    screen: "sent",
    figmaId: "41:1439",
    title: "Đã gửi góp ý",
    breadcrumb: "Hỏi đáp / Trợ lý học vụ",
  },
  {
    screen: "dashboard",
    figmaId: "7:2",
    title: "Tổng quan",
    breadcrumb: "Quản trị / Tổng quan",
  },
  {
    screen: "documents",
    figmaId: "7:49",
    title: "Tài liệu & nguồn",
    breadcrumb: "Quản trị / Tài liệu & nguồn",
  },
  {
    screen: "addSource",
    figmaId: "7:108",
    title: "Thêm nguồn tài liệu",
    breadcrumb: "Quản trị / Tài liệu & nguồn",
  },
  {
    screen: "indexing",
    figmaId: "8:2",
    title: "Xử lý tài liệu",
    breadcrumb: "Quản trị / Xử lý tài liệu",
  },
  {
    screen: "adminFaq",
    figmaId: "8:47",
    title: "Quản lý FAQ",
    breadcrumb: "Quản trị / Quản lý FAQ",
  },
  {
    screen: "review",
    figmaId: "8:84",
    title: "Phản hồi",
    breadcrumb: "Quản trị / Phản hồi",
  },
  {
    screen: "audit",
    figmaId: "8:123",
    title: "Lịch sử & nhật ký",
    breadcrumb: "Quản trị / Lịch sử & nhật ký",
  },
  {
    screen: "faqEditor",
    figmaId: "41:1552",
    title: "Biên soạn FAQ",
    breadcrumb: "Quản trị / Quản lý FAQ",
  },
];

export const studentNavigation = [
  { screen: "home", label: "Trang chủ", icon: "home" },
  { screen: "chat", label: "Hỏi đáp học vụ", icon: "chat" },
  { screen: "faq", label: "FAQ & thủ tục", icon: "book" },
  { screen: "history", label: "Lịch sử hỏi đáp", icon: "clock" },
  { screen: "feedback", label: "Gửi góp ý", icon: "heart" },
  { screen: "profile", label: "Tài khoản", icon: "user" },
  { screen: "settings", label: "Cài đặt", icon: "settings" },
] as const;

export const adminNavigation = [
  { screen: "dashboard", label: "Tổng quan", icon: "home" },
  { screen: "documents", label: "Tài liệu & nguồn", icon: "file" },
  { screen: "indexing", label: "Xử lý tài liệu", icon: "refresh" },
  { screen: "adminFaq", label: "Quản lý FAQ", icon: "help" },
  { screen: "review", label: "Phản hồi", icon: "chat" },
  { screen: "analytics", label: "Thống kê", icon: "chart" },
  { screen: "audit", label: "Lịch sử & nhật ký", icon: "clock" },
  { screen: "users", label: "Tài khoản", icon: "user" },
] as const;
