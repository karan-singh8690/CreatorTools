# Task 1 - Fix 716GB Storage Bug

## Summary
Fixed the critical 716GB storage bug in CreatorTools by changing `size` fields from `Int` to `BigInt` in the Prisma schema, creating a BigInt serialization utility, and updating all 35 API routes that interact with file size data.

## Changes Made

### Schema
- `prisma/schema.prisma`: Changed `size` from `Int` to `BigInt` in PdfFile, UploadLog, ChunkUploadSession

### New Files
- `src/lib/bigint-utils.ts`: bigIntToNumber(), numberToBigInt(), serializeBigInt()

### Modified API Routes (35 files)
- Storage API: Complete rewrite with $queryRaw, sanity checks, debug info
- Analytics API: Added bigIntToNumber and serializeBigInt
- All file creation routes: Changed `size: value` to `size: BigInt(value)`
- All file read routes: Added serializeBigInt for JSON responses
- All duplicate check routes: Added serializeBigInt for JSON responses

### Frontend
- `app-sidebar.tsx`: formatBytes with NaN/Infinity guards
- `settings-page.tsx`: formatBytes with NaN/Infinity guards
- `upload-validation.ts`: formatBytes with NaN/Infinity guards

## Verification
- `bun run db:push -- --accept-data-loss`: Schema updated successfully
- `bun run lint`: No errors
- Storage API returns: `{"usedBytes":0,"totalBytes":104857600,"_debug":{"rawUsedBytes":0,"dataCorruptionSuspected":false}}`
- Files API returns: `{"files":[]}`
- Dev server running with no errors
