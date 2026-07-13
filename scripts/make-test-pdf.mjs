import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fs from 'fs';

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.HelveticaBold);
for (let i = 0; i < 3; i++) {
  const page = doc.addPage([595, 842]); // A4
  page.drawText(`Page ${i+1} — Quarterly Report`, { x: 50, y: 780, size: 18, font, color: rgb(0.1,0.1,0.1) });
  page.drawText('This is the real document content that must be preserved.', { x: 50, y: 740, size: 12, font, color: rgb(0.2,0.2,0.2) });
  page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', { x: 50, y: 710, size: 11, font, color: rgb(0.3,0.3,0.3) });
  page.drawText('Sed do eiusmod tempor incididunt ut labore et dolore magna.', { x: 50, y: 690, size: 11, font, color: rgb(0.3,0.3,0.3) });
  // WATERMARK — rotated, large, light gray, centered
  page.drawText('DRAFT', {
    x: 200, y: 400, size: 80, font,
    color: rgb(0.75, 0.75, 0.75),
    opacity: 0.5,
    rotate: degrees(45),
  });
}
const out = await doc.save();
fs.writeFileSync('/tmp/test-watermark.pdf', out);
console.log('Created /tmp/test-watermark.pdf', out.length, 'bytes, 3 pages');
