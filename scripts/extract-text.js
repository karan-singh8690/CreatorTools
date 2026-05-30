// Text extraction script - runs as a separate Node.js process
// to avoid pdfjs-dist worker issues in Next.js bundled environment
/* eslint-disable @typescript-eslint/no-require-imports */
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs')
const fs = require('fs')

const filePath = process.argv[2]

async function main() {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath))
    const doc = await getDocument({ data, useSystemFonts: true }).promise
    const parts = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      const text = tc.items.map(item => 'str' in item ? item.str : '').join(' ')
      if (text.trim()) parts.push(`--- Page ${i} ---\n${text}`)
    }
    await doc.destroy()
    process.stdout.write(JSON.stringify(parts.join('\n\n')))
  } catch (e) {
    process.stderr.write(e.message || String(e))
    process.exit(1)
  }
}

main()
