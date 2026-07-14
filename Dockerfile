# ─── Builder stage ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Install bun (for fast install) + build deps for sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates python3 make g++ \
    && curl -fsSL https://bun.sh/install | bash \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Install deps (postinstall runs prisma generate)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build the Next.js standalone output
RUN bun run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner

# Install ALL system tools the PDF cleanup/OCR/PDF-A features need.
# These are NOT available on Vercel — this Docker image is required.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    tesseract-ocr \
    poppler-utils \
    qpdf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma schema + generated client (for db:push on startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create runtime directories
RUN mkdir -p /app/db /app/uploads /app/uploads/cleanup

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/db/custom.db

EXPOSE 3000

# Run prisma db:push (creates/migrates the SQLite DB) then start the server.
# The standalone server.js is a Node script — run with node, not bun.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
