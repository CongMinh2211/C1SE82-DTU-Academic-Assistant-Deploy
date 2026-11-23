FROM node:24.22.1-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --fetch-retries=4 && npm rebuild better-sqlite3 esbuild
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24.22.1-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 ca-certificates tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP_DATA_DIR=/app/data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/FE ./FE
COPY --from=build --chown=node:node /app/BE ./BE
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/tsconfig.json /app/package.json /app/package-lock.json ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["sh","-c","exec node node_modules/next/dist/bin/next start FE --hostname 0.0.0.0 --port ${PORT:-10000}"]
