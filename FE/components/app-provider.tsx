// Mục đích file: Chia sẻ thông tin tài khoản, thông báo và hộp thoại cho các thành phần giao diện.
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { languageKey, parseLanguage, answerLanguageKey, parseAnswerLanguage, type UiLanguage, type AnswerLanguage } from "@/lib/language";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { appearanceKey, parseAppearance, applyAppearance } from "@/lib/appearance";
export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  studentCode?: string | null;
  cohort?: string | null;
  major?: string | null;
};
type Modal = { title: string; content: ReactNode } | null;
const AppContext = createContext<{
  // Context cung cấp hồ sơ phiên cùng thao tác thông báo và hộp thoại dùng chung.
  user: AppUser | null;
  language: UiLanguage;
  selectedLanguage: UiLanguage;
  setLanguage: (language: UiLanguage) => Promise<boolean>;
  answerLanguage: AnswerLanguage;
  setAnswerLanguage: (language: AnswerLanguage) => Promise<boolean>;
  languageReady: boolean;
  notify: (s: string) => void;
  showModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
} | null>(null);
export function AppProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: AppUser | null;
}) {
  // Mỗi lần cập nhật thông báo hoặc hộp thoại sẽ làm các thành phần đang dùng context nhận trạng thái mới.
  const [studentLanguage, setLanguageState] = useState<UiLanguage>("vi");
  const [answerLanguage, setAnswerLanguageState] = useState<AnswerLanguage>("auto");
  const [languageReady, setLanguageReady] = useState(false);
  const pathname = usePathname();
  const isAuthPage = pathname === routes.login || pathname === routes.register || pathname === routes.resetPassword;
  const language: UiLanguage = pathname?.startsWith("/quan-tri") ? "vi" : studentLanguage;
  const [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal>(null);
  const showModal = useCallback(
    (title: string, content: ReactNode) => setModal({ title, content }),
    [],
  );
  const closeModal = useCallback(() => setModal(null), []);
  // Đọc cài đặt từ tài khoản. Khi nâng cấp lần đầu, giữ lựa chọn cũ của trình duyệt nếu có.
  useEffect(() => {
    let active = true;
    setLanguageState("vi"); setAnswerLanguageState("auto"); setLanguageReady(false);
    if (!user?.id) { setLanguageReady(true); return; }
    (async () => {
      try {
        const response = await fetch("/api/app/language-preferences", { credentials:"same-origin", cache:"no-store" });
        if (!response.ok) throw new Error("load failed");
        let value = await response.json() as {ui_language:string;answer_language:string;exists:boolean};
        if (!value.exists) {
          const oldUi = localStorage.getItem(languageKey(user.id));
          const oldAnswer = localStorage.getItem(answerLanguageKey(user.id));
          if (oldUi || oldAnswer) {
            const previous = {ui_language:parseLanguage(oldUi),answer_language:parseAnswerLanguage(oldAnswer)};
            const migrated = await fetch("/api/app/language-preferences", {method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(previous)});
            if (migrated.ok) value = {...previous,exists:true};
          }
        }
        if (active) { setLanguageState(parseLanguage(value.ui_language)); setAnswerLanguageState(parseAnswerLanguage(value.answer_language)); setLanguageReady(true); }
      } catch { if (active) { setLanguageReady(false); setToast("Không thể tải ngôn ngữ đã lưu. Vui lòng tải lại trang để thử lại."); } }
    })();
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const saveLanguage = useCallback(async (ui: UiLanguage, answer: AnswerLanguage) => {
    if (!user?.id) return false;
    try {
      const response = await fetch("/api/app/language-preferences", {method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({ui_language:ui,answer_language:answer})});
      if (!response.ok) return false;
      setLanguageState(ui); setAnswerLanguageState(answer); return true;
    } catch { return false; }
  }, [user?.id]);
  const setLanguage = useCallback((next: UiLanguage) => saveLanguage(next, answerLanguage), [saveLanguage,answerLanguage]);
  const setAnswerLanguage = useCallback((next: AnswerLanguage) => saveLanguage(studentLanguage,next), [saveLanguage,studentLanguage]);
  const value = useMemo(
    () => ({ user, language, selectedLanguage: studentLanguage, setLanguage, answerLanguage, setAnswerLanguage, languageReady, notify: setToast, showModal, closeModal }),
    [user, language, studentLanguage, setLanguage, answerLanguage, setAnswerLanguage, languageReady, showModal, closeModal],
  );
  // Giữ màn hình xác thực sáng; vùng làm việc vẫn dùng lựa chọn riêng theo tài khoản.
  useEffect(() => {
    if (isAuthPage) {
      applyAppearance({ theme: "light", size: "normal" }, false);
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      try { applyAppearance(parseAppearance(localStorage.getItem(appearanceKey(user?.id))), media.matches); }
      catch { applyAppearance(parseAppearance(null), media.matches); }
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("storage", update);
    window.addEventListener("dtu:appearance", update);
    return () => { media.removeEventListener("change", update); window.removeEventListener("storage", update); window.removeEventListener("dtu:appearance", update); };
  }, [user?.id, isAuthPage]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      dialog.current
        ?.querySelector<HTMLElement>("input,textarea,select")
        ?.focus();
    } else dialog.current?.close();
  }, [modal]);
  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="dialog-title"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        {modal && (
          <>
            <div className="dialog-heading">
              <h2 id="dialog-title">{modal.title}</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Đóng cửa sổ"
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </div>
            <div className="dialog-body">{modal.content}</div>
          </>
        )}
      </dialog>
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
