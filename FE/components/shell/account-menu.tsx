// Mục đích file: Hiển thị menu tài khoản và các thao tác liên quan đến phiên đăng nhập.
import Link from "next/link";
import { Icon } from "@/components/ui";

import { authClient } from "@/lib/auth-client";

import { routes } from "@/lib/routes";

import type { ShellNavigation } from "@/components/shell/use-shell-navigation";
export function AccountMenu({
  userPanel,
  user,
  setUserOpen,
  admin,
  signingOut,
  setSigningOut,
  router,
  notify,
}: Pick<
  ShellNavigation,
  | "userPanel"
  | "user"
  | "setUserOpen"
  | "admin"
  | "signingOut"
  | "setSigningOut"
  | "router"
  | "notify"
>) {
  // Liên kết và đăng xuất thao tác qua trạng thái, router và dịch vụ xác thực được truyền từ shell.
  return (
    <div
      className="user-menu"
      id="account-menu"
      ref={userPanel}
      aria-label="Tài khoản"
    >
      <strong>{user?.name}</strong>
      <Link href={routes.profile} onClick={() => setUserOpen(false)}>
        <Icon name="user" size={18} tone="muted" /> <span>Thông tin tài khoản</span>
      </Link>
      <Link
        href={admin ? routes.adminSettings : routes.settings}
        onClick={() => setUserOpen(false)}
      >
        <Icon name="settings" size={18} tone="muted" /> <span>Cài đặt</span>
      </Link>
      {user?.role === "admin" && (
        <Link
          href={admin ? routes.home : routes.dashboard}
          onClick={() => setUserOpen(false)}
        >
          <Icon name={admin ? "home" : "shield"} size={18} tone="muted" />
          <span>{admin ? "Xem giao diện sinh viên" : "Xem giao diện quản trị"}</span>
        </Link>
      )}
      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          try {
            const result = await authClient.signOut();
            if (result.error)
              throw new Error("Không thể đăng xuất. Vui lòng thử lại.");
            setUserOpen(false);
            router.replace(routes.login);
            router.refresh();
          } catch (e) {
            notify(e instanceof Error ? e.message : "Không thể đăng xuất.");
          } finally {
            setSigningOut(false);
          }
        }}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17v2H5V5h5v2M13 8l4 4-4 4M17 12H9" /></svg>
        <span>{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </button>
    </div>
  );
}
