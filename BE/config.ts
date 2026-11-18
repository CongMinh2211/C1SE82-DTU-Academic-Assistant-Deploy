// Mục đích file: Tập trung các đường dẫn và biến cấu hình chạy ứng dụng; thông tin bí mật lấy từ môi trường.
import path from "node:path";

// Data is mounted at runtime, never traced into the build output.
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.APP_DATA_DIR ||
    (process.env.VERCEL ? "/tmp/dtu-runtime" : "./data"),
);
export const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
export const appOrigins = [
  new URL(appUrl).origin,
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
];
export const databasePath = path.join(dataDir, "academic.sqlite");
export const embeddingModel = "Xenova/multilingual-e5-small";
export const embeddingDimension = 384;
export const maxUploadBytes = 20 * 1024 * 1024;
export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
