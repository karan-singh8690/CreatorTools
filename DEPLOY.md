# Deploy CreatorTools

CreatorTools is a Next.js 16 app that needs **system binaries** (Ghostscript,
Tesseract OCR, Poppler, qpdf) for its advanced PDF features. These are **not
available on Vercel** — you must deploy to a container platform.

## Quick deploy (Render.com — recommended)

1. **Push the `deploy` branch to GitHub** (already done if you're reading this).

2. Go to **https://render.com** → New → **Web Service** → connect your GitHub
   repo `karan-singh8690/CreatorTools`.

3. Render auto-detects `render.yaml`. Click **Apply**.

4. Set the environment variable `NEXT_PUBLIC_SITE_URL` to your Render URL
   (e.g. `https://creatortools.onrender.com`) after the first deploy, then
   redeploy.

5. Done. The app runs on a persistent disk (SQLite + uploads survive
   redeploy).

**Cost**: ~$7/month (Render Starter: 512 MB RAM, 1 GB disk).

## Alternative: Railway.app

1. Go to **https://railway.app** → New Project → deploy from GitHub repo.
2. Railway detects the `Dockerfile` automatically.
3. Add a persistent volume: mount `/app/db` (and optionally `/app/uploads`).
4. Set `DATABASE_URL=file:/app/db/custom.db` and `NEXT_PUBLIC_SITE_URL`.

## Alternative: Fly.io / any Docker host

```bash
docker build -t creatortools .
docker run -p 3000:3000 \
  -v creatortools-data:/app/db \
  -e NEXT_PUBLIC_SITE_URL=https://your-domain \
  creatortools
```

## ⚠️ Why NOT Vercel?

The PDF Cleanup tool (watermark removal, scan cleanup, OCR, PDF/A output,
smart compression) shells out to:

| Binary | Purpose |
|--------|---------|
| `gs` (Ghostscript) | PDF/A-2b/3 conversion, smart compression |
| `tesseract` | OCR (searchable PDF) |
| `pdftoppm` / `pdfinfo` / `pdftotext` / `pdfimages` (Poppler) | Page rendering, text/bbox extraction, image analysis |
| `qpdf` | PDF optimization, repair |

Vercel's serverless functions **cannot install system packages**. Deploying to
Vercel would make these features crash. The Dockerfile installs all of them.

## Environment variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `DATABASE_URL` | Yes | `file:/app/db/custom.db` | SQLite path. Use a persistent volume in production. |
| `NEXT_PUBLIC_SITE_URL` | Yes | — | Your deployed URL (for SEO/sitemap/canonical). |
| `NODE_ENV` | — | `production` | Set automatically in Docker. |

## First run

The Docker `CMD` runs `prisma db push` on every startup, which creates the
SQLite database (if it doesn't exist) and applies the schema. No manual
migration step needed.

## Health check

`GET /` returns HTTP 200 — use this as your health check path.
