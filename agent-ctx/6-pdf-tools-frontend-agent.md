# Task 6 - PDF Tools Frontend Agent

## Task
Create 6 frontend PDF tool components using the PdfToolLayout pattern.

## Components Created

1. **SecurityPdf** (`src/components/pdf-element/security-pdf.tsx`)
   - Lock icon, red color theme
   - Owner password input with show/hide toggle
   - Confirm password with mismatch validation
   - Permission checkboxes (print/copy/modify/annotate)
   - Info box about metadata security
   - API: POST /api/files/{id}/security

2. **ExtractDataPdf** (`src/components/pdf-element/extract-data-pdf.tsx`)
   - Table2 icon, sky color theme
   - AI-Powered badge
   - Query textarea with quick suggestion chips
   - Copy to clipboard functionality
   - API: POST /api/files/{id}/extract-data

3. **TranslatePdf** (`src/components/pdf-element/translate-pdf.tsx`)
   - Globe icon, violet color theme
   - AI-Powered badge
   - Language selector with 13 languages
   - Info box about AI translation
   - API: POST /api/files/{id}/translate

4. **DeleteBlankPagesPdf** (`src/components/pdf-element/delete-blank-pages-pdf.tsx`)
   - Trash2 icon, slate color theme
   - Info message about blank page detection
   - Result shows page count statistics
   - API: POST /api/files/{id}/delete-blank-pages

5. **SignDocumentPdf** (`src/components/pdf-element/sign-document-pdf.tsx`)
   - PenTool icon, fuchsia color theme
   - Draw/Type signature mode toggle
   - Canvas drawing with mouse + touch support
   - Position controls with quick presets
   - API: POST /api/files/{id}/sign

6. **CropPdf** (`src/components/pdf-element/crop-pdf.tsx`)
   - Crop icon, lime color theme
   - Margin inputs (Top/Bottom/Left/Right)
   - Quick presets + visual dimension preview
   - Apply to all pages toggle
   - API: POST /api/files/{id}/crop

## Verification
- Lint check passes (only 1 pre-existing warning in background-pdf.tsx)
- Dev server running (GET / returns 200)
- All components already imported in page.tsx by previous agent
