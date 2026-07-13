# Task 2-a: Backend API Routes for CreatorTools

## Agent: Backend API Developer

## Summary
Created 6 API routes for PDF manipulation in the CreatorTools project, following the existing pattern from the compress API route.

## Routes Created

### 1. Watermark - `src/app/api/files/[id]/watermark/route.ts`
- POST endpoint accepting `{ text, fontSize?, color?, opacity?, rotation?, position? }`
- Uses pdf-lib to draw text watermark on every page
- Supports 'center' and 'diagonal' positions
- Diagonal mode centers text and applies rotation (default -45°)
- Hex color parsing with opacity support
- Returns `{ file: PdfFile, watermark: { applied: true, text } }`

### 2. Background - `src/app/api/files/[id]/background/route.ts`
- POST endpoint accepting `{ color?, opacity? }`
- Uses pdf-lib to draw a filled rectangle covering entire page
- Semi-transparent overlay effect with configurable opacity
- Returns `{ file: PdfFile }`

### 3. Header Footer - `src/app/api/files/[id]/header-footer/route.ts`
- POST endpoint accepting `{ headerText?, footerText?, pageNumberFormat?, showPageNumbers?, fontSize?, color? }`
- Supports page number formats: '1,2,3', 'i,ii,iii', 'I,II,III', 'A,B,C', 'a,b,c'
- Replaces `{page}` and `{total}` placeholders in header/footer text
- Centers header text at top and footer text at bottom
- If only showPageNumbers is true, adds "X / Y" at bottom center
- Returns `{ file: PdfFile }`

### 4. Bates Number - `src/app/api/files/[id]/bates-number/route.ts`
- POST endpoint accepting `{ prefix?, startNumber?, digits?, suffix?, position?, fontSize?, color? }`
- Sequential Bates numbering with format: PREFIX + zero-padded number + SUFFIX
- Supports positions: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
- Default: prefix="", startNumber=1, digits=6, position="bottom-right"
- Returns `{ file: PdfFile, bates: { prefix, startNumber, totalPages } }`

### 5. Security - `src/app/api/files/[id]/security/route.ts`
- POST endpoint accepting `{ userPassword?, ownerPassword?, permissions? }`
- Since pdf-lib doesn't support native encryption, implements best-effort approach:
  - Stores SHA-256 password hashes in PDF keywords metadata
  - Stores permission flags (print/copy/modify) in structured metadata
  - Sets producer marker indicating protection
- Returns `{ file: PdfFile, security: { protected: true, hasPassword } }`

### 6. Delete Blank Pages - `src/app/api/files/[id]/delete-blank/route.ts`
- POST endpoint accepting `{ threshold? }` (0-1 for blankness detection, default 0.1)
- Uses pdfjs-dist to analyze each page for:
  - Text content (via getTextContent)
  - Images (paintImageXObject, paintJpegXObject operators)
  - Drawing operations (fill, stroke, constructPath operators)
- Uses pdf-lib to create new PDF with only non-blank pages
- If all pages would be removed, keeps at least the first page
- Returns `{ file: PdfFile, deleted: { pagesRemoved, originalPages, newPages } }`

## Technical Details
- All routes follow the existing pattern from compress/route.ts
- Consistent error handling with try/catch and appropriate HTTP status codes
- Files saved with UUID names to uploads directory
- New database entries created for output files
- All routes use `ignoreEncryption: true` when loading PDFs
- Lint passes cleanly with no errors
