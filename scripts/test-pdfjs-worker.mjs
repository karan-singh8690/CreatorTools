import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import { Worker } from 'worker_threads';

const require = createRequire(import.meta.url);
let workerPath;
try {
  workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  console.log('resolved worker path:', workerPath);
  console.log('file URL:', pathToFileURL(workerPath).href);
} catch (e) {
  console.log('require.resolve FAILED, falling back to cwd path');
  workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  console.log('cwd path:', workerPath);
}

// Test 1: set workerSrc as file URL
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
console.log('workerSrc set to:', pdfjs.GlobalWorkerOptions.workerSrc);

import fs from 'fs';
const data = new Uint8Array(fs.readFileSync('/tmp/test-watermark.pdf'));
try {
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, useSystemFonts: true, isEvalSupported: false }).promise;
  console.log('SUCCESS: loaded', doc.numPages, 'pages');
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  console.log('text items on page 1:', tc.items.length);
  console.log('sample texts:', tc.items.filter(i=>i.str).slice(0,5).map(i=>i.str));
  await doc.destroy();
} catch (e) {
  console.log('FAILED:', e.message);
}
