FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json bun.lock ./
COPY frontend/package.json frontend/
COPY server/package.json server/
RUN bun install --frozen-lockfile

# Build frontend
COPY frontend/ frontend/
RUN cd frontend && bun run build

# Production image
FROM oven/bun:1-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy built frontend + server + dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/frontend/dist ./frontend/dist
COPY --from=base /app/frontend/node_modules ./frontend/node_modules
COPY --from=base /app/server/node_modules ./server/node_modules
COPY server/ server/
COPY package.json ./

# Data directories
RUN mkdir -p /data /data/uploads
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/knitly.db
ENV LOCAL_UPLOAD_DIR=/data/uploads
ENV USE_LOCAL_STORAGE=true
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "run", "--cwd", "server", "start"]
