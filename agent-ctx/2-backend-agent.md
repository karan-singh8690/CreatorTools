---
Task ID: 2
Agent: Backend Agent
Task: Build all backend API routes for PDFelement clone

Work Log:
- Created utility library /src/lib/pdf-utils.ts with:
  - getPageCount() - extract page count using pdf-lib
  - extractTextFromPdf() - extract text using pdfjs-dist (legacy build for server-side)
  - mergePdfs() - merge multiple PDF buffers using pdf-lib
  - compressPdf() - compress PDF by re-saving with pdf-lib (removes metadata, uses object streams)
- Created /src/app/api/files/route.ts:
  - GET: List all files, sorted by createdAt desc, with ?search= query support
  - POST: Upload PDF file, save to uploads dir, extract page count & text content
- Created /src/app/api/files/[id]/route.ts:
  - GET: Get file metadata by ID
  - PATCH: Update file (star/unstar, rename)
  - DELETE: Delete file from DB + physical file from disk
- Created /src/app/api/files/[id]/download/route.ts:
  - GET: Stream PDF file for viewing (inline) or downloading (attachment via ?download=1)
- Created /src/app/api/files/[id]/compress/route.ts:
  - POST: Compress PDF, save as new file, return size comparison stats
- Created /src/app/api/files/[id]/extract-text/route.ts:
  - GET: Extract text from PDF, cache in DB, return extracted text
- Created /src/app/api/files/combine/route.ts:
  - POST: Merge multiple PDFs by file ID order, save combined file, return metadata
- Updated /src/app/api/chat/route.ts:
  - Added fileId parameter support
  - Fetches PDF text content from database using fileId
  - Includes PDF text in system prompt for AI context (truncated to 50K chars)
  - Handles case where no text could be extracted (suggests OCR)

Stage Summary:
- All 10 API routes built and working
- Lint passes with no errors
- Dev server running without errors
- All routes use Prisma db client, pdf-lib for PDF operations, pdfjs-dist for text extraction
