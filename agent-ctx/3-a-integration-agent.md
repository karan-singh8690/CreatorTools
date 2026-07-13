# Task 3-a: Add Local Storage history to Security PDF and Bates Numbering PDF tools

## Work Record

### Files Modified:
1. `src/components/pdf-element/security-pdf.tsx`
   - Added imports: `useToolHistory`, `ToolHistoryPanel`
   - Added hook: `useToolHistory('security', 'PDF Security')` after other useState hooks
   - Added `addHistory()` call after success toast in `handleApplySecurity`
   - Added `addHistory` to useCallback dependency array
   - Added `<Separator />` + `<ToolHistoryPanel compact>` at bottom of settings panel

2. `src/components/pdf-element/bates-number-pdf.tsx`
   - Added imports: `useToolHistory`, `ToolHistoryPanel`
   - Added hook: `useToolHistory('bates-number', 'Bates Numbering')`
   - Added `addHistory()` call after success toast in `handleApplyBates`
   - Added `<Separator />` + `<ToolHistoryPanel compact>` at bottom of left panel

### Lint: Passes cleanly
### No existing functionality changed
