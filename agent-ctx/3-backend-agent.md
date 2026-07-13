# Task 3 - Backend Agent Work Log

## Task: Create backend API routes and PDF utility functions for 12 new PDF tools

## Files Modified

### 1. `/home/z/my-project/src/lib/pdf-utils.ts`
Added 9 new utility functions:
- `addWatermark` - Text watermark with font size, color, opacity, rotation, position
- `addBackground` - Background color with opacity on all pages
- `addHeaderFooter` - Header/footer text with alignment, page numbers, margin
- `addBatesNumber` - Bates numbering with prefix, suffix, zero-padding, position
- `addTextOverlay` - Text overlay on specific pages for Edit tool
- `createPdfFromText` - Create PDF from text with word-wrap and pagination
- `deleteBlankPages` - Remove blank pages using pdfjs-dist text detection
- `cropPdfPages` - Crop pages using setCropBox with per-page margins
- `addSignature` - Embed PNG/JPG signature images at specified positions

Also added `hexToRgb` helper for pdf-lib color conversion.

### 2. API Routes Created (12 files)

| Route | Method | Key Parameters |
|-------|--------|---------------|
| `/api/files/[id]/watermark` | POST | text, fontSize, color, opacity, rotation, position |
| `/api/files/[id]/background` | POST | color, opacity |
| `/api/files/[id]/header-footer` | POST | headerText, footerText, fontSize, color, alignment, pageNumbers, margin |
| `/api/files/[id]/bates-number` | POST | prefix, startNumber, suffix, fontSize, position, margin, zeroPadding |
| `/api/files/[id]/edit` | POST | texts array (text, page, x, y, fontSize, color, fontFamily) |
| `/api/files/create` | POST | title, content, fontSize, fontFamily, pageSize, margin |
| `/api/files/[id]/delete-blank-pages` | POST | (no body) - returns deletedCount |
| `/api/files/[id]/crop` | POST | marginTop/Bottom/Left/Right, pageNumbers |
| `/api/files/[id]/sign` | POST | imageDataUrl, page, x, y, width, height |
| `/api/files/[id]/security` | POST | ownerPassword, permissions |
| `/api/files/[id]/extract-data` | POST | query (AI-powered) |
| `/api/files/[id]/translate` | POST | targetLanguage (AI-powered) |

## Key Patterns Used
- `params: Promise<{ id: string }>` with `await params` (Next.js 16)
- `randomUUID()` for unique filenames
- Prisma `db.pdfFile.create()` for new file records
- `getPageCount()` and `extractTextFromPdf()` for metadata
- AI routes use `z-ai-web-dev-sdk` with `glm-4-flash` model
- All routes follow the compress route pattern exactly

## Lint Status
- 0 errors, 1 pre-existing warning (unrelated to this task)
