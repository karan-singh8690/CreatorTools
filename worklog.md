---
Task ID: 2
Agent: Main Agent
Task: Update Zustand store and build file upload component for PDF management app

Work Log:
- Updated Zustand store (src/store/app-store.ts) with real API integration:
  - Replaced hardcoded sample files with empty array, API-driven data
  - Added PdfFile interface matching backend schema (id, name, originalName, size, mimeType, pages, starred, textContent, filePath, createdAt, updatedAt)
  - Added PDFFile backward-compatible alias type
  - Added formatFileSize() and formatDate() helper functions
  - Added UploadProgress interface for tracking uploads
  - Added fetchFiles() - fetches files from GET /api/files with optional search
  - Added uploadFiles() - uploads files via POST /api/files with progress tracking
  - Added toggleStar() - toggles starred via PATCH /api/files/[id] with optimistic update
  - Added deleteFile() - deletes via DELETE /api/files/[id] with optimistic update
  - Added renameFile() - renames via PATCH /api/files/[id] with optimistic update
  - Added combineSelectedFiles() - combines via POST /api/files/combine
  - Added compressFile() - compresses via POST /api/files/[id]/compress
  - Added isLoadingFiles, isCombining, isCompressing loading states
  - Kept all existing view types, chat messages, and navigation state

- Built FileUpload component (src/components/pdf-element/file-upload.tsx):
  - Drag & drop zone using react-dropzone
  - Only accepts PDF files
  - Shows upload progress per file with visual indicators
  - Supports multiple file upload
  - Compact mode (sidebar-friendly) and full mode (main area)
  - Shows upload status (uploading, success, error) with icons and progress bars
  - Auto-refreshes file list after upload completes
  - Beautiful UI with PDF icon, dashed border, color-coded feedback

- Updated AppSidebar component (src/components/pdf-element/app-sidebar.tsx):
  - "Open PDF" button triggers hidden file input dialog
  - After upload, navigates to home view showing files
  - Uses store's uploadFiles and fetchFiles functions
  - Shows starred file count badge next to "Starred Files"
  - Maintained same dark theme design
  - Reset file input after upload for re-selection

- Updated existing components to work with new PdfFile type:
  - RecentFiles: Updated to use formatFileSize/formatDate, added fetchFiles on mount, refresh button, delete/rename dialogs, filter tabs (All/Starred), dropdown menu with actions
  - PdfViewer: Updated to use formatFileSize, added fileId in chat API call, added download handler, shows textContent preview or scanned document notice
  - CombineFiles: Updated to use formatFileSize/formatDate, integrated combineSelectedFiles with toast notifications and loading state
  - BatchPrint: Updated to use formatFileSize
  - page.tsx: Added FileUpload component on home view

Stage Summary:
- Zustand store fully integrated with backend API (CRUD, upload, combine, compress)
- File upload component with drag & drop, progress tracking, dual mode
- All components updated for new PdfFile type with proper formatting
- Lint checks passing, dev server running without errors
- API calls working (confirmed Prisma queries in dev log)
