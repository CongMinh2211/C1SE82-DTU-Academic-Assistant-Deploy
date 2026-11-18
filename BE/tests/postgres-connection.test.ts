import test from "node:test";
import assert from "node:assert/strict";
import { postgresConnectionUrl } from "../postgres-connection";

test("Postgres mặc định xác minh chứng chỉ ngay cả khi URL yêu cầu chế độ yếu hơn", () => {
  delete process.env.RENDER_POSTGRES_INTERNAL;
  const url = new URL(postgresConnectionUrl("postgresql://db.example.test/app?sslmode=disable"));
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
});

test("Chế độ demo Render bắt buộc hostname nội bộ và TLS", () => {
  process.env.RENDER_POSTGRES_INTERNAL = "true";
  try {
    const url = new URL(postgresConnectionUrl("postgresql://dpg-abc123-a/app?sslmode=disable"));
    assert.equal(url.searchParams.get("sslmode"), "no-verify");
    assert.throws(() => postgresConnectionUrl("postgresql://untrusted.example/app"));
    assert.throws(() => postgresConnectionUrl("https://dpg-abc123-a/app"));
  } finally {
    delete process.env.RENDER_POSTGRES_INTERNAL;
  }
});
