import { extractTextRuns } from './src/lib/pdf-cleanup/content-stream.ts';
(async () => {
  const pages = await extractTextRuns('/tmp/test-watermark.pdf', 1, 3);
  for (const p of pages) {
    console.log(`\n=== Page ${p.pageNumber} (${p.width}×${p.height}) — ${p.runs.length} runs ===`);
    for (const r of p.runs) {
      const colorStr = `rgb(${r.color.map(c=>c.toFixed(2)).join(',')})`;
      console.log(`  "${r.text}" font=${r.font} size=${r.fontSize.toFixed(1)} rot=${r.rotation}° pos=(${r.x.toFixed(0)},${r.y.toFixed(0)}) ${colorStr} op=${r.opacity} tg=${r.inTransparencyGroup}`);
    }
  }
})();
