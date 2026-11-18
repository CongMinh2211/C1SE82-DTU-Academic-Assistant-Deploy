// Mục đích file: Kiểm thử: Trạng thái tải, làm mới và xử lý yêu cầu tài nguyên đồng thời.
import test from "node:test";
import assert from "node:assert/strict";
import { ResourceRequest } from "../../FE/lib/resource-request";

// Các lượt đọc trùng lúc dùng chung yêu cầu đang chạy để tránh gọi API lặp.
test("overlapping automatic reads share one in-flight request", async () => {
  // Đếm lần callback thực sự được gọi, khác với số lần component gọi read.
  let calls = 0;
  // Giữ hàm resolve để chủ động mô phỏng mạng chậm mà không sleep theo thời gian máy.
  let resolve!: (value: number) => void;
  const request = new ResourceRequest("documents", async () => {
    calls++;
    // Promise chưa hoàn tất giúp lời gọi read thứ hai trùng với yêu cầu đầu.
    return new Promise<number>((done) => {
      resolve = done;
    });
  });
  const first = request.read(),
    second = request.read();
  // Hai caller phải nhận đúng cùng promise, không chỉ tình cờ nhận cùng dữ liệu.
  assert.equal(first, second);
  // Nhường một microtask để callback fetchValue bên trong ResourceRequest được khởi chạy.
  await Promise.resolve();
  // Chứng minh không có hai lượt gọi mạng cho hai lần đọc đồng thời.
  assert.equal(calls, 1);
  // Mô phỏng server hoàn tất, rồi kiểm tra cả hai caller cùng nhận kết quả.
  resolve(42);
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
});

// Làm mới sau thay đổi phải đợi yêu cầu cũ và lấy lại dữ liệu mới.
test("refresh after a mutation waits for an old poll and reads a fresh snapshot", async () => {
  let value = "before mutation",
    calls = 0;
  let finishPoll!: (value: string) => void;
  const request = new ResourceRequest("documents", async () => {
    // Lần gọi đầu bị giữ lại; những lần sau đọc giá trị sau mutation.
    if (++calls === 1)
      return new Promise<string>((resolve) => {
        finishPoll = resolve;
      });
    return value;
  });
  const poll = request.read();
  await Promise.resolve();
  // Mô phỏng dữ liệu thay đổi sau khi polling đã bắt đầu.
  value = "after mutation";
  const firstRefresh = request.refresh(),
    secondRefresh = request.refresh();
  // Hoàn tất polling bằng bản dữ liệu cũ để test phát hiện refresh dùng nhầm kết quả cũ.
  finishPoll("before mutation");
  assert.equal(await poll, "before mutation");
  assert.deepEqual(await Promise.all([firstRefresh, secondRefresh]), [
    "after mutation",
    "after mutation",
  ]);
  // Một polling và một refresh dùng chung cho hai caller: tổng cộng đúng hai lượt mạng.
  assert.equal(calls, 2);
});

// Nếu yêu cầu cũ lỗi, thao tác làm mới vẫn có thể gửi yêu cầu tiếp.
test("refresh still retries when the older in-flight read fails", async () => {
  let rejectOld!: (error: Error) => void,
    calls = 0;
  const request = new ResourceRequest("faqs", async () => {
    if (++calls === 1)
      return new Promise<string>((_, reject) => {
        rejectOld = reject;
      });
    return "fresh";
  });
  const poll = request.read();
  await Promise.resolve();
  const refresh = request.refresh();
  // Cố tình làm lượt polling cũ thất bại; refresh phải vượt qua lỗi cũ và gọi lại.
  rejectOld(new Error("Old request failed"));
  // Caller của polling vẫn phải nhận lỗi; lớp không được nuốt lỗi của caller này.
  await assert.rejects(poll, /Old request failed/);
  assert.equal(await refresh, "fresh");
});

// Một lần đọc hoàn tất không được khiến lần làm mới sau dùng dữ liệu cũ.
test("completed reads do not cache data across a later refresh", async () => {
  let value = 1;
  const request = new ResourceRequest("profile", async () => value);
  assert.equal(await request.read(), 1);
  // Đổi dữ liệu giữa hai lượt read đã hoàn tất để bắt lỗi cache dữ liệu vô thời hạn.
  value = 2;
  assert.equal(await request.read(), 2);
});

// Khi thành phần bị tháo khỏi giao diện, hủy yêu cầu còn chạy và ngừng cập nhật.
test("unmount aborts the active fetch and permanently closes that scope", async () => {
  let signal!: AbortSignal;
  const request = new ResourceRequest("conversation/A", async (input) => {
    // Ghi nhận signal thật được truyền vào callback, không tạo signal giả ngoài lớp.
    signal = input;
    return new Promise<void>((_, reject) =>
      input.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      ),
    );
  });
  const pending = request.read();
  await Promise.resolve();
  request.dispose();
  // Kiểm tra cả tín hiệu hủy mạng và trạng thái vòng đời của instance.
  assert.equal(signal.aborted, true);
  assert.equal(request.active, false);
  await assert.rejects(pending, { name: "AbortError" });
  // Instance đã đóng không được khởi động lại yêu cầu khi caller vô tình đọc tiếp.
  await assert.rejects(request.read(), { name: "AbortError" });
});

// Hai thành phần độc lập không dùng chung trạng thái yêu cầu chỉ vì có cùng khóa.
test("same key in separate mounts never shares data or a pending request", async () => {
  let resolveOld!: (value: string) => void;
  const old = new ResourceRequest(
    "conversation/A",
    async () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
  );
  const pending = old.read();
  await Promise.resolve();
  old.dispose();
  // Instance mới cùng key tượng trưng cho component được mount lại hoặc phiên khác.
  const current = new ResourceRequest(
    "conversation/A",
    async () => "new mount",
  );
  assert.equal(await current.read(), "new mount");
  // Cho phản hồi cũ đến muộn sau khi component mới đã có dữ liệu.
  resolveOld("late old mount");
  await pending;
  assert.equal(old.active, false);
  assert.equal(current.active, true);
});

// Lỗi yêu cầu phải giải phóng trạng thái đang chạy để có thể thử lại.
test("request failure releases the in-flight slot so a retry can succeed", async () => {
  let calls = 0;
  const request = new ResourceRequest("analytics", async () => {
    // Chỉ lượt đầu lỗi để kiểm tra pending được xóa trong nhánh finally.
    if (++calls === 1) throw new Error("Temporary failure");
    return 7;
  });
  await assert.rejects(request.read(), /Temporary failure/);
  assert.equal(await request.read(), 7);
  assert.equal(calls, 2);
});
