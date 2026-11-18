import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:
    process.env.DTU_STANDALONE_BUILD === "true" ? "standalone" : undefined,
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Cho phép trang cùng nguồn yêu cầu micro; trình duyệt vẫn phải được người dùng cấp quyền.
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://vercel.com/api/blob https://vercel.com/api/blob/ https://*.blob.vercel-storage.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@huggingface/transformers",
    "onnxruntime-node",
    "@mastra/core",
    "@mastra/libsql",
    "@mastra/rag",
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/@napi-rs/canvas*/**/*",
      "./node_modules/pdf-parse/dist/**/*",
      "./node_modules/pdfjs-dist/legacy/build/**/*",
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v*/linux/x64/*",
      "./node_modules/onnxruntime-node/bin/napi-v*/linux/arm64/*",
      "./node_modules/onnxruntime-common/**/*",
      "./node_modules/sharp/package.json",
      "./node_modules/sharp/lib/**/*",
      "./node_modules/@img/sharp-linux*/**/*",
      "./node_modules/@img/sharp-libvips-linux*/**/*",
    ],
  },
  /* config options here */
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
