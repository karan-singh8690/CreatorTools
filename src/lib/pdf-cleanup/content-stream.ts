/**
 * PDF content-stream parser.
 *
 * Extracts "styled text runs" from PDF content streams: each run carries the
 * text string PLUS its full graphics-state context (font, size, rotation,
 * color, opacity, whether it's inside a transparency group). This richer
 * data powers multi-signal watermark detection (rotation repeat, color
 * similarity, transparency, font uniqueness, object frequency).
 *
 * We use pdf-lib to access each page's decompressed content stream + its
 * /Resources /ExtGState map (for opacity & transparency-group resolution),
 * then run a custom tokenizer + stateful operator parser over the stream
 * bytes. No pdfjs worker is involved.
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRawStream,
  PDFNumber,
  PDFHexString,
  PDFLiteralString,
} from 'pdf-lib';
import { promises as fs } from 'fs';
import zlib from 'zlib';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtGStateEntry {
  /** Fill opacity (/ca). Default 1. */
  opacity: number;
  /** Stroke opacity (/CA). Default 1. */
  strokeOpacity: number;
  /** True if this GState declares a transparency group (/S /Transparency or /Type /TransparencyGroup). */
  transparencyGroup: boolean;
}

export interface TextRun {
  text: string;
  font: string;
  /** Effective size = Tf size × sqrt(a² + b²) from the text matrix. */
  fontSize: number;
  /** Text matrix [a,b,c,d,e,f]. */
  matrix: number[];
  /** Rotation in degrees, derived from atan2(b, a). */
  rotation: number;
  /** Text origin x (user space, bottom-left origin). */
  x: number;
  /** Text origin y. */
  y: number;
  /** Fill color [r,g,b] 0..1. */
  color: [number, number, number];
  /** Fill opacity 0..1. */
  opacity: number;
  /** Drawn inside a transparency group. */
  inTransparencyGroup: boolean;
  /** 1-indexed page number. */
  page: number;
}

export interface PageTextRuns {
  pageNumber: number;
  width: number;
  height: number;
  runs: TextRun[];
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

export type Token =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lbracket' }
  | { t: 'rbracket' }
  | { t: 'ldict' }
  | { t: 'rdict' };

const WS = new Set([32, 9, 10, 13, 12, 0]); // space, tab, CR, LF, form feed, NUL
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]); // ( ) < > [ ] { } / %

function isWs(c: number): boolean {
  return WS.has(c);
}
function isDelim(c: number): boolean {
  return DELIM.has(c);
}

/** Decode a PDF literal string body (between the parens), handling escapes. */
function decodeLiteralString(data: Uint8Array, start: number): { value: string; next: number } {
  let i = start;
  let out = '';
  let depth = 1;
  while (i < data.length && depth > 0) {
    const ch = data[i];
    if (ch === 92) {
      // backslash escape
      i++;
      if (i >= data.length) break;
      const esc = data[i];
      if (esc === 110) out += '\n'; // \n
      else if (esc === 114) out += '\r'; // \r
      else if (esc === 116) out += '\t'; // \t
      else if (esc === 98) out += '\b'; // \b
      else if (esc === 102) out += '\f'; // \f
      else if (esc === 40) out += '('; // \(
      else if (esc === 41) out += ')'; // \)
      else if (esc === 92) out += '\\'; // \\
      else if (esc === 10 || esc === 13) {
        // line continuation — skip
      } else if (esc >= 48 && esc <= 55) {
        // octal \ddd (1-3 digits)
        let oct = String.fromCharCode(esc);
        let k = 0;
        while (k < 2 && i + 1 < data.length && data[i + 1] >= 48 && data[i + 1] <= 55) {
          i++;
          oct += String.fromCharCode(data[i]);
          k++;
        }
        out += String.fromCharCode(parseInt(oct, 8) & 0xff);
      } else {
        out += String.fromCharCode(esc);
      }
      i++;
    } else if (ch === 40) {
      depth++;
      out += '(';
      i++;
    } else if (ch === 41) {
      depth--;
      if (depth > 0) out += ')';
      i++;
    } else {
      out += String.fromCharCode(ch);
      i++;
    }
  }
  return { value: out, next: i };
}

/** Decode a hex string body (between the angle brackets). */
function decodeHexString(data: Uint8Array, start: number): { value: string; next: number } {
  let i = start;
  let hex = '';
  while (i < data.length && data[i] !== 62) {
    // '>'
    const c = data[i];
    if (!isWs(c)) hex += String.fromCharCode(c);
    i++;
  }
  // pad to even length
  if (hex.length % 2 === 1) hex += '0';
  let out = '';
  for (let k = 0; k < hex.length; k += 2) {
    const byte = parseInt(hex.slice(k, k + 2), 16);
    if (!isNaN(byte)) out += String.fromCharCode(byte);
  }
  return { value: out, next: i };
}

/** Tokenize a content stream (bytes) into a flat token list. */
export function tokenize(data: Uint8Array): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = data.length;
  while (i < len) {
    const c = data[i];
    if (isWs(c)) {
      i++;
      continue;
    }
    // Literal string (...)
    if (c === 40) {
      const { value, next } = decodeLiteralString(data, i + 1);
      tokens.push({ t: 'str', v: value });
      i = next + 1; // skip closing )
      continue;
    }
    // Hex string <...> or dict <<
    if (c === 60) {
      if (data[i + 1] === 60) {
        tokens.push({ t: 'ldict' });
        i += 2;
        continue;
      }
      const { value, next } = decodeHexString(data, i + 1);
      tokens.push({ t: 'str', v: value });
      i = next + 1; // skip closing >
      continue;
    }
    if (c === 62 && data[i + 1] === 62) {
      tokens.push({ t: 'rdict' });
      i += 2;
      continue;
    }
    // Array brackets
    if (c === 91) {
      tokens.push({ t: 'lbracket' });
      i++;
      continue;
    }
    if (c === 93) {
      tokens.push({ t: 'rbracket' });
      i++;
      continue;
    }
    // Name /Foo
    if (c === 47) {
      i++;
      let name = '';
      while (i < len && !isWs(data[i]) && !isDelim(data[i])) {
        name += String.fromCharCode(data[i]);
        i++;
      }
      tokens.push({ t: 'name', v: name });
      continue;
    }
    // Number (digit, -, ., +)
    if ((c >= 48 && c <= 57) || c === 45 || c === 46 || c === 43) {
      let num = '';
      while (i < len && ((data[i] >= 48 && data[i] <= 57) || data[i] === 45 || data[i] === 46 || data[i] === 43)) {
        num += String.fromCharCode(data[i]);
        i++;
      }
      const n = parseFloat(num);
      if (!isNaN(n)) tokens.push({ t: 'num', v: n });
      continue;
    }
    // Operator (letters) or special quote operators ' "
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 39 || c === 34) {
      let op = '';
      while (i < len && !isWs(data[i]) && !isDelim(data[i])) {
        op += String.fromCharCode(data[i]);
        i++;
      }
      tokens.push({ t: 'op', v: op });
      continue;
    }
    // Unknown byte (binary), skip
    i++;
  }
  return tokens;
}

// ─── Graphics state + parser ─────────────────────────────────────────────────

interface GfxState {
  font: string;
  fontSize: number;
  color: [number, number, number];
  opacity: number;
  strokeOpacity: number;
  inTransparencyGroup: boolean;
  /** Text matrix [a,b,c,d,e,f]. */
  tm: number[];
  /** Text line matrix (for Td/TD). */
  tl: number[];
}

function defaultState(): GfxState {
  return {
    font: '',
    fontSize: 0,
    color: [0, 0, 0],
    opacity: 1,
    strokeOpacity: 1,
    inTransparencyGroup: false,
    tm: [1, 0, 0, 1, 0, 0],
    tl: [1, 0, 0, 1, 0, 0],
  };
}

function cloneState(s: GfxState): GfxState {
  return {
    ...s,
    color: [...s.color] as [number, number, number],
    tm: [...s.tm],
    tl: [...s.tl],
  };
}

/** Multiply two 2×3 affine matrices (represented as [a,b,c,d,e,f]). */
function matMul(m1: number[], m2: number[]): number[] {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function makeRun(text: string, state: GfxState, page: number): TextRun {
  const [a, b, , , e, f] = state.tm;
  const rotation = Math.round((Math.atan2(b, a) * 180) / Math.PI * 10) / 10;
  const scale = Math.sqrt(a * a + b * b) || 1;
  const fontSize = state.fontSize * scale;
  return {
    text,
    font: state.font,
    fontSize,
    matrix: [...state.tm],
    rotation,
    x: e,
    y: f,
    color: [...state.color] as [number, number, number],
    opacity: state.opacity,
    inTransparencyGroup: state.inTransparencyGroup,
    page,
  };
}

/**
 * Parse a content stream (tokens) into styled text runs, tracking graphics
 * state. Resolves /gs names via the provided ExtGState map.
 */
export function parseContentStream(
  tokens: Token[],
  extGState: Map<string, ExtGStateEntry>,
  page: number
): TextRun[] {
  const runs: TextRun[] = [];
  let state = defaultState();
  const stack: GfxState[] = [];
  const operands: Token[] = [];
  let markedDepth = 0; // BMC/BDC nesting

  const flush = () => {
    operands.length = 0;
  };

  for (const tok of tokens) {
    if (tok.t === 'num' || tok.t === 'str' || tok.t === 'name' || tok.t === 'lbracket' || tok.t === 'ldict' || tok.t === 'rbracket' || tok.t === 'rdict') {
      operands.push(tok);
      continue;
    }
    // Operator
    const op = tok.v;
    switch (op) {
      case 'q':
        stack.push(cloneState(state));
        flush();
        break;
      case 'Q':
        state = stack.pop() ?? state;
        flush();
        break;
      case 'gs': {
        // /Name gs → set extended graphics state
        const nameTok = [...operands].reverse().find((t) => t.t === 'name');
        if (nameTok && nameTok.t === 'name') {
          const gs = extGState.get(nameTok.v);
          if (gs) {
            state = {
              ...state,
              opacity: gs.opacity,
              strokeOpacity: gs.strokeOpacity,
              inTransparencyGroup: state.inTransparencyGroup || gs.transparencyGroup,
            };
          }
        }
        flush();
        break;
      }
      case 'Tf': {
        // /Font size Tf
        const nameTok = operands.length >= 2 ? operands[operands.length - 2] : undefined;
        const sizeTok = operands.length >= 2 ? operands[operands.length - 1] : undefined;
        if (nameTok && nameTok.t === 'name') state.font = nameTok.v;
        if (sizeTok && sizeTok.t === 'num') state.fontSize = sizeTok.v;
        flush();
        break;
      }
      case 'Tm': {
        // a b c d e f Tm → set text matrix
        if (operands.length >= 6) {
          const nums = operands.slice(-6).map((t) => (t.t === 'num' ? t.v : 0));
          state.tm = nums;
          state.tl = [...nums];
        }
        flush();
        break;
      }
      case 'Td': {
        // tx ty Td → translate line matrix
        if (operands.length >= 2) {
          const tx = operands[operands.length - 2].t === 'num' ? (operands[operands.length - 2] as { v: number }).v : 0;
          const ty = operands[operands.length - 1].t === 'num' ? (operands[operands.length - 1] as { v: number }).v : 0;
          const move = [1, 0, 0, 1, tx, ty];
          state.tl = matMul(state.tl, move);
          state.tm = [...state.tl];
        }
        flush();
        break;
      }
      case 'TD': {
        // tx ty TD → translate + set leading
        if (operands.length >= 2) {
          const tx = operands[operands.length - 2].t === 'num' ? (operands[operands.length - 2] as { v: number }).v : 0;
          const ty = operands[operands.length - 1].t === 'num' ? (operands[operands.length - 1] as { v: number }).v : 0;
          const move = [1, 0, 0, 1, tx, ty];
          state.tl = matMul(state.tl, move);
          state.tm = [...state.tl];
        }
        flush();
        break;
      }
      case 'T*': {
        // next line (uses leading)
        state.tm = [...state.tl];
        flush();
        break;
      }
      case 'rg': {
        // r g b rg → fill color
        if (operands.length >= 3) {
          const [r, g, b] = operands.slice(-3).map((t) => (t.t === 'num' ? t.v : 0));
          state.color = [r, g, b];
        }
        flush();
        break;
      }
      case 'RG': {
        flush(); // stroke color — not tracked
        break;
      }
      case 'g': {
        // gray g → fill color
        const last = operands[operands.length - 1];
        if (last && last.t === 'num') state.color = [last.v, last.v, last.v];
        flush();
        break;
      }
      case 'k': {
        // c m y k k → CMYK fill (rough RGB approx)
        if (operands.length >= 4) {
          const [c, m, y] = operands.slice(-4).map((t) => (t.t === 'num' ? t.v : 0));
          state.color = [1 - c, 1 - m, 1 - y];
        }
        flush();
        break;
      }
      case 'cs':
      case 'CS':
      case 'sc':
      case 'SC':
      case 'scn':
      case 'SCN': {
        // Other color spaces — best-effort ignore (won't override rg/g/k)
        flush();
        break;
      }
      case 'Tj': {
        const strTok = operands[operands.length - 1];
        if (strTok && strTok.t === 'str' && strTok.v.trim()) {
          runs.push(makeRun(strTok.v, state, page));
        }
        flush();
        break;
      }
      case 'TJ': {
        // [ (str) num (str) num ... ] TJ — collect all string parts
        for (const t of operands) {
          if (t.t === 'str' && t.v.trim()) {
            runs.push(makeRun(t.v, state, page));
          }
        }
        flush();
        break;
      }
      case "'": {
        // string ' → move to next line + show
        const strTok = operands[operands.length - 1];
        if (strTok && strTok.t === 'str' && strTok.v.trim()) {
          runs.push(makeRun(strTok.v, state, page));
        }
        flush();
        break;
      }
      case '"': {
        // aw ac string " → set spacing + next line + show
        const strTok = operands[operands.length - 1];
        if (strTok && strTok.t === 'str' && strTok.v.trim()) {
          runs.push(makeRun(strTok.v, state, page));
        }
        flush();
        break;
      }
      case 'BMC':
      case 'BDC':
        markedDepth++;
        flush();
        break;
      case 'EMC':
        if (markedDepth > 0) markedDepth--;
        flush();
        break;
      default:
        // Unknown operator — flush operands
        flush();
    }
  }
  return runs;
}

// ─── ExtGState resolution via pdf-lib ────────────────────────────────────────

function numFromPDFNumber(v: unknown): number | undefined {
  if (v instanceof PDFNumber) return v.asNumber();
  return undefined;
}

function nameToText(v: unknown): string | undefined {
  if (v instanceof PDFName) {
    // pdf-lib PDFName stores the name WITH a leading slash in .value / .asString()
    try {
      const s = typeof (v as { asString: () => string }).asString === 'function'
        ? (v as { asString: () => string }).asString()
        : String(v);
      return s.replace(/^\//, '');
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Resolve a page's /Resources /ExtGState map into name→entry. */
function resolveExtGStateMap(
  doc: PDFDocument,
  pageDict: PDFDict
): Map<string, ExtGStateEntry> {
  const out = new Map<string, ExtGStateEntry>();
  let resources = pageDict.get(PDFName.of('Resources'));
  if (!resources) return out;
  resources = resources instanceof PDFDict ? resources : doc.context.lookup(resources);
  if (!(resources instanceof PDFDict)) return out;
  const extGState = resources.get(PDFName.of('ExtGState'));
  if (!extGState) return out;
  const gsDict =
    extGState instanceof PDFDict ? extGState : doc.context.lookup(extGState);
  if (!(gsDict instanceof PDFDict)) return out;

  for (const key of gsDict.entries()) {
    const [name, val] = key as [PDFName, unknown];
    const entry: ExtGStateEntry = { opacity: 1, strokeOpacity: 1, transparencyGroup: false };
    const resolved = val instanceof PDFDict ? val : doc.context.lookup(val);
    if (resolved instanceof PDFDict) {
      const ca = resolved.get(PDFName.of('ca'));
      const caNum = numFromPDFNumber(ca);
      if (caNum !== undefined) entry.opacity = caNum;
      const CA = resolved.get(PDFName.of('CA'));
      const CANum = numFromPDFNumber(CA);
      if (CANum !== undefined) entry.strokeOpacity = CANum;
      const s = nameToText(resolved.get(PDFName.of('S')));
      if (s === 'Transparency') entry.transparencyGroup = true;
      const type = nameToText(resolved.get(PDFName.of('Type')));
      if (type === 'TransparencyGroup') entry.transparencyGroup = true;
    }
    out.set(nameToText(name) ?? '', entry);
  }
  return out;
}

/** Get the concatenated, decompressed content stream bytes for a page. */
function getPageContentBytes(doc: PDFDocument, pageDict: PDFDict): Uint8Array {
  const contents = pageDict.get(PDFName.of('Contents'));
  if (!contents) return new Uint8Array(0);
  const streams: Uint8Array[] = [];

  const collectFrom = (obj: unknown) => {
    if (obj instanceof PDFRawStream) {
      // pdf-lib's getContents() returns raw (possibly still-compressed) bytes
      // in this build. Check the /Filter and inflate manually when needed.
      const filter = obj.dict.get(PDFName.of('Filter'));
      const filterName = nameToText(filter) ?? '';
      const raw = obj.contents;
      if (filterName.includes('FlateDecode')) {
        try {
          const inflated = zlib.inflateSync(Buffer.from(raw));
          streams.push(new Uint8Array(inflated));
          return;
        } catch {
          // fall through to raw bytes
        }
      }
      streams.push(raw);
    } else if (obj && typeof obj === 'object') {
      // PDFArray — iterate its entries (each may be an indirect ref).
      // pdf-lib's PDFArray.size is a METHOD in this version.
      const arr = obj as unknown as {
        size: (() => number) | number;
        get: (i: number) => unknown;
      };
      const sizeFn = typeof arr.size === 'function' ? arr.size() : (typeof arr.size === 'number' ? arr.size : 0);
      if (typeof arr.get === 'function') {
        for (let i = 0; i < sizeFn; i++) {
          const child = doc.context.lookup(arr.get(i));
          collectFrom(child);
        }
      }
    }
  };

  // contents may be a direct stream, a PDFArray of streams, or an indirect ref
  collectFrom(doc.context.lookup(contents));

  const total = streams.reduce((a, s) => a + s.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const s of streams) {
    out.set(s, off);
    off += s.length;
  }
  return out;
}

// ─── Public: extract text runs for a page range ───────────────────────────────

/**
 * Extract styled text runs for a range of pages. Loads the PDF with pdf-lib,
 * iterates the requested pages, resolves each page's ExtGState, tokenizes &
 * parses its content stream.
 */
export async function extractTextRuns(
  file: string,
  firstPage: number,
  lastPage: number
): Promise<PageTextRuns[]> {
  const data = await fs.readFile(file);
  const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  const pages = doc.getPages();
  const out: PageTextRuns[] = [];

  const start = Math.max(0, firstPage - 1);
  const end = Math.min(pages.length, lastPage);

  for (let i = start; i < end; i++) {
    const page = pages[i];
    const pageDict = page.node;
    const extGState = resolveExtGStateMap(doc, pageDict);
    const bytes = getPageContentBytes(doc, pageDict);
    const tokens = tokenize(bytes);
    const runs = parseContentStream(tokens, extGState, i + 1);
    const size = page.getSize();
    out.push({
      pageNumber: i + 1,
      width: size.width,
      height: size.height,
      runs,
    });
  }
  return out;
}

// Silence unused import warnings for types reserved for future hooks.
void PDFHexString;
void PDFLiteralString;
