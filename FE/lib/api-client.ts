"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResourceRequest } from "./resource-request";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Đường dẫn tương đối đi qua proxy FE cùng tên miền để trình duyệt dùng cookie phiên.
  const response = await fetch(`/api/app/${path}`, {
    ...options,
    // Chỉ gửi cookie cho cùng origin, không gửi credential sang website nguồn tài liệu.
    credentials: "same-origin",
    headers: {
      // FormData phải để trình duyệt tự tạo boundary của multipart; JSON mới gắn Content-Type.
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  // API ứng dụng trả JSON cả khi thành công và khi lỗi nghiệp vụ.
  const payload = await response.json().catch(() => null);
  // Ném lỗi để hook/component hiển thị trạng thái thất bại, không coi HTTP lỗi là dữ liệu hợp lệ.
  if (!response.ok)
    throw new Error(payload?.error || "Hệ thống tạm thời không phản hồi. Vui lòng thử lại.");
  if (payload === null) throw new Error("Phản hồi từ hệ thống không hợp lệ. Vui lòng thử lại.");
  return payload as T;
}
export function useResource<T>(path: string | null, interval = 0) {
  // Ref giữ instance yêu cầu hiện hành qua render, không tự kích hoạt render khi thay.
  const current = useRef<ResourceRequest<T> | null>(null);
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loadedPath, setLoadedPath] = useState<string | null>(null);
  const load = useCallback(
    async (fresh = false) => {
      const request = current.current;
      // Bộ lọc đã đổi hoặc component chưa có instance: không ghi kết quả vào trang hiện tại.
      if (!path || !request || request.key !== path) return;
      try {
        const value = await (fresh ? request.refresh() : request.read());
        // Bỏ qua phản hồi cũ đến sau khi người dùng chuyển trang/đổi bộ lọc.
        if (!request.active || current.current !== request) return;
        setData(value);
        setError("");
      } catch (e) {
        if (request.active && current.current === request)
          setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
      } finally {
        // Chỉ đánh dấu tải xong cho yêu cầu vẫn thuộc component hiện hành.
        if (request.active && current.current === request) setLoadedPath(path);
      }
    },
    [path],
  );
  const refresh = useCallback(() => load(true), [load]);
  useEffect(() => {
    // path null tạm dừng việc tải khi component chưa đủ điều kiện gửi request.
    if (!path) return;
    const request = new ResourceRequest(path, (signal) =>
      api<T>(path, { signal }),
    );
    current.current = request;
    // Bắt đầu lượt đọc đầu tiên ngay sau khi mount hoặc đổi path.
    void load();
    // Chỉ polling khi có interval; mặc định không tạo timer gọi lại API liên tục.
    const timer = interval
      ? setInterval(() => {
          void load();
        }, interval)
      : undefined;
    return () => {
      // Cleanup hủy fetch/timer, tránh cập nhật state của component đã rời khỏi màn hình.
      request.dispose();
      if (current.current === request) current.current = null;
      clearInterval(timer);
    };
  }, [path, interval, load]);
  return {
    // Không hiển thị dữ liệu/lỗi của path cũ trong lúc path mới còn đang tải.
    data: loadedPath === path ? data : null,
    error: loadedPath === path ? error : "",
    loading: !!path && loadedPath !== path,
    refresh,
    setData,
  };
}
export const dateText = (date: string) => {
  // Dữ liệu cũ hoặc nguồn bên ngoài có thể thiếu ngày; không để lỗi ngày làm hỏng trang.
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
};
export const statusLabels: Record<string, string> = {
  published: "Đã xuất bản",
  ready: "Cần rà soát",
  queued: "Đang chờ",
  running: "Đang xử lý",
  done: "Hoàn tất",
  failed: "Lỗi xử lý",
  superseded: "Đã thay thế",
  answered: "Có nguồn",
  conversation: "Trợ lý DTU",
  insufficient: "Cần xác minh thêm",
  clarification: "Cần làm rõ",
  error: "Chưa xử lý được",
  processing: "Đang trả lời",
  pending: "Chờ xử lý",
  resolved: "Đã xử lý",
  draft: "Bản nháp",
  saved: "Đã lưu",
};
