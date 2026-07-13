/**
 * Raster scan cleanup — multi-stage pipeline.
 *
 * Stages (applied in order when cleanScan / clean-scan mode is active):
 *   1. Flatten           — composite transparency onto white paper
 *   2. Deskew            — projection-profile skew detection + rotation
 *   3. Page edge detect  — find the actual content bounding box
 *   4. Border removal    — crop/fill dark scan borders outside content
 *   5. Hole punch remove — detect & fill 3-hole-punch circles in margins
 *   6. Speckle removal   — median filter kills scanner dots / salt noise
 *   7. Shadow removal    — background-estimation illumination correction
 *   8. CLAHE             — contrast-limited adaptive histogram equalization
 *   9. Threshold         — binarize to clean B/W text (clean-scan / max)
 *  10. Sharpen           — unsharp mask for crisp text edges
 *
 * For background-removal / full modes, only the relevant subset runs.
 */
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { CleanupOptions, QualityLevel } from './types';

export interface RasterResult {
  pngPath: string;
  width: number;
  height: number;
}

// ─── Stage 2: Deskew ─────────────────────────────────────────────────────────

/**
 * Detect the skew angle of a scanned page using the projection-profile
 * method: the angle that maximizes the variance of the horizontal projection
 * (row-sum of dark pixels) is the skew angle, because aligned text lines
 * produce sharp peaks in the projection.
 *
 * Runs on a downscaled grayscale image for speed, then rotates the original.
 */
async function detectSkewAngle(imgPath: string): Promise<number> {
  try {
    const meta = await sharp(imgPath).metadata();
    const w = meta.width ?? 1000;
    const targetW = 400;
    const scale = targetW / w;

    // Downscale → grayscale → blur (reduce noise) → threshold to binary.
    const small = await sharp(imgPath)
      .resize(targetW, Math.round((meta.height ?? 1400) * scale), { fit: 'fill' })
      .greyscale()
      .blur(0.8) // light blur reduces speckle noise before thresholding
      .normalise()
      .threshold(140)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = small;
    const sw = info.width;
    const sh = info.height;

    let bestAngle = 0;
    let bestVar = -1;

    // Coarse scan: -12° to +12° in 0.5° steps.
    for (let a = -12; a <= 12; a += 0.5) {
      const variance = await projectionVariance(data, sw, sh, a);
      if (variance > bestVar) {
        bestVar = variance;
        bestAngle = a;
      }
    }

    // Fine scan: ±1° around best, in 0.1° steps.
    const fineStart = Math.max(-15, bestAngle - 1);
    const fineEnd = Math.min(15, bestAngle + 1);
    for (let a = fineStart; a <= fineEnd; a += 0.1) {
      const variance = await projectionVariance(data, sw, sh, a);
      if (variance > bestVar) {
        bestVar = variance;
        bestAngle = a;
      }
    }

    return Math.round(bestAngle * 10) / 10;
  } catch {
    return 0;
  }
}

/**
 * Compute the variance of the horizontal projection profile after rotating
 * the binary image by `angle` degrees. Higher variance = better text-line
 * alignment = closer to the true skew angle.
 *
 * We simulate rotation by shearing the projection: for each output row y,
 * we sample input rows shifted by tan(angle) × (y - centerY). This is an
 * approximation that avoids the cost of a real per-pixel rotation.
 */
async function projectionVariance(
  data: Buffer,
  w: number,
  h: number,
  angleDeg: number
): Promise<number> {
  const rad = (angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const centerY = h / 2;

  // Row sums of dark pixels (value < 128 = text), with a per-row horizontal
  // shift that simulates rotating the image by `angle`. The angle that
  // maximizes projection variance is the skew angle (aligned text lines
  // produce sharp peaks).
  const rowSums = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    const shift = Math.round(tan * (y - centerY));
    let sum = 0;
    for (let x = 0; x < w; x++) {
      const sx = x + shift; // sample the SHIFTED column
      if (sx < 0 || sx >= w) continue;
      const px = data[y * w + sx]; // ← must use sx, not x
      if (px < 128) sum++;
    }
    rowSums[y] = sum;
  }

  // Variance of row sums.
  let mean = 0;
  for (let i = 0; i < h; i++) mean += rowSums[i];
  mean /= h;
  let varSum = 0;
  for (let i = 0; i < h; i++) {
    const d = rowSums[i] - mean;
    varSum += d * d;
  }
  return varSum / h;
}

/** Apply deskew: detect skew, rotate the image to straighten it. */
async function deskew(buf: Buffer): Promise<Buffer> {
  // Save to a temp path for detection (sharp can't analyze a buffer path).
  const tmp = `/tmp/deskew-${Date.now()}.png`;
  await fs.writeFile(tmp, buf);
  const angle = await detectSkewAngle(tmp);
  await fs.unlink(tmp).catch(() => {});
  if (Math.abs(angle) < 0.2) return buf; // negligible skew
  const out = await sharp(buf, { failOn: 'none' })
    .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
    .toBuffer();
  return out;
}

// ─── Stage 3+4: Page edge detection & border removal ─────────────────────────

interface ContentBbox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Detect the content bounding box — the region of the page containing actual
 * text/graphics, excluding dark scan borders and dirty margins.
 *
 * Two-pass approach:
 *   1. BORDER PASS: scan from each edge inward. A row/column is part of the
 *      dark border if >30% of its pixels are dark. Skip past the border band
 *      to find the "page area" (the white paper region inside the border).
 *   2. CONTENT PASS: within the page area, find the first/last rows and
 *      columns with significant dark content (>0.5% dark = text/graphics).
 *
 * This correctly handles dark scan borders that the old single-pass approach
 * mistook for content.
 */
async function detectContentBbox(buf: Buffer): Promise<ContentBbox | null> {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) return null;

    const targetW = 500;
    const scale = targetW / w;
    const small = await sharp(buf)
      .resize(targetW, Math.round(h * scale), { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sw = small.info.width;
    const sh = small.info.height;
    const sd = small.data;

    // Column and row dark-pixel fractions.
    const colDarkFrac = new Float32Array(sw);
    const rowDarkFrac = new Float32Array(sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (sd[y * sw + x] < 128) {
          colDarkFrac[x]++;
          rowDarkFrac[y]++;
        }
      }
    }
    for (let x = 0; x < sw; x++) colDarkFrac[x] /= sh;
    for (let y = 0; y < sh; y++) rowDarkFrac[y] /= sw;

    // Pass 1: skip dark border bands (>30% dark = border).
    const borderThresh = 0.3;
    let borderL = 0, borderR = sw - 1, borderT = 0, borderB = sh - 1;
    while (borderL < sw && colDarkFrac[borderL] > borderThresh) borderL++;
    while (borderR > borderL && colDarkFrac[borderR] > borderThresh) borderR--;
    while (borderT < sh && rowDarkFrac[borderT] > borderThresh) borderT++;
    while (borderB > borderT && rowDarkFrac[borderB] > borderThresh) borderB--;

    // Pass 2: within the page area, find actual content (>0.5% dark).
    const contentThresh = 0.005;
    let left = borderL, right = borderR, top = borderT, bottom = borderB;
    while (left < right && colDarkFrac[left] < contentThresh) left++;
    while (right > left && colDarkFrac[right] < contentThresh) right--;
    while (top < bottom && rowDarkFrac[top] < contentThresh) top++;
    while (bottom > top && rowDarkFrac[bottom] < contentThresh) bottom--;

    if (right <= left || bottom <= top) return null;

    // Convert back to original-resolution pixels, with a small inset margin.
    const inset = 4;
    return {
      left: Math.max(0, Math.round(left / scale) - inset),
      top: Math.max(0, Math.round(top / scale) - inset),
      width: Math.min(w, Math.round((right - left + 1) / scale) + inset * 2),
      height: Math.min(h, Math.round((bottom - top + 1) / scale) + inset * 2),
    };
  } catch {
    return null;
  }
}

/**
 * Remove dark scan borders by cropping to the detected content bbox. Also
 * serves as margin cleanup (removes dirty margins outside the content).
 * If the content bbox covers ~98%+ of the page, we skip (no border to remove).
 */
async function removeBorders(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const bbox = await detectContentBbox(buf);
  if (!bbox) return buf;
  // Only crop if there's a meaningful border (≥1% removed on any side).
  const minBorder = 0.01;
  if (
    bbox.left < w * minBorder &&
    bbox.top < h * minBorder &&
    bbox.width > w * (1 - 2 * minBorder) &&
    bbox.height > h * (1 - 2 * minBorder)
  ) {
    return buf; // no significant border
  }
  try {
    return await sharp(buf, { failOn: 'none' }).extract(bbox).toBuffer();
  } catch {
    return buf;
  }
}

// ─── Stage 5: Hole punch removal ─────────────────────────────────────────────

/**
 * Detect and remove 3-hole-punch circles in the page margins.
 *
 * Hole punches appear as dark, roughly-circular blobs in the left or right
 * margin bands. We detect them by:
 *   1. Looking only in the margin bands (outer 10% on each side).
 *   2. Thresholding to find dark pixels.
 *   3. Finding connected clusters via a simple flood-fill.
 *   4. For each cluster whose size and aspect ratio match a hole punch
 *      (area in a plausible range, roughly square), fill it white.
 */
async function removeHolePunches(buf: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) return buf;

    const marginW = Math.floor(w * 0.1); // 10% margin band
    if (marginW < 20) return buf; // too small to bother

    // Build a dark-pixel mask for the left & right margin bands.
    // Downscale for cluster detection speed.
    const scale = Math.min(1, 600 / w);
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);
    const smarginW = Math.floor(sw * 0.1);

    const raw = await sharp(buf)
      .resize(sw, sh, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();

    // Mask: 1 = dark pixel in margin band.
    const mask = new Uint8Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const inMargin = x < smarginW || x >= sw - smarginW;
        if (inMargin && raw[y * sw + x] < 160) mask[y * sw + x] = 1;
      }
    }

    // Connected components (4-connectivity) on the mask.
    const visited = new Uint8Array(sw * sh);
    const clusters: { minX: number; minY: number; maxX: number; maxY: number; size: number }[] = [];
    const stack: number[] = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 0 || visited[i]) continue;
      // BFS this cluster
      stack.length = 0;
      stack.push(i);
      visited[i] = 1;
      let minX = sw,
        minY = sh,
        maxX = 0,
        maxY = 0,
        size = 0;
      while (stack.length) {
        const idx = stack.pop()!;
        const cx = idx % sw;
        const cy = Math.floor(idx / sw);
        size++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        // 4-neighbors
        if (cx > 0) {
          const ni = idx - 1;
          if (mask[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
        if (cx < sw - 1) {
          const ni = idx + 1;
          if (mask[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
        if (cy > 0) {
          const ni = idx - sw;
          if (mask[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
        if (cy < sh - 1) {
          const ni = idx + sw;
          if (mask[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
      // Hole-punch heuristic: cluster is roughly square, area in punch range.
      // At the downscaled size, a punch is ~30-120px wide. Aspect ratio ~1.
      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      const aspect = cw / ch;
      const minSize = 15;
      const maxSize = 400;
      if (
        size >= minSize &&
        size <= maxSize &&
        aspect > 0.6 &&
        aspect < 1.7
      ) {
        clusters.push({ minX, minY, maxX, maxY, size });
      }
    }

    if (clusters.length === 0) return buf;

    // For each detected punch cluster, composite a white ellipse over the
    // region in the ORIGINAL image. Convert downscaled coords back to full res.
    const overlays: { input: Buffer; top: number; left: number }[] = [];
    for (const c of clusters) {
      const left = Math.round(c.minX / scale) - 2;
      const top = Math.round(c.minY / scale) - 2;
      const ew = Math.round((c.maxX - c.minX + 1) / scale) + 4;
      const eh = Math.round((c.maxY - c.minY + 1) / scale) + 4;
      if (ew < 4 || eh < 4) continue;
      // White filled ellipse SVG, composited over the punch.
      const svg = `<svg width="${ew}" height="${eh}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${ew / 2}" cy="${eh / 2}" rx="${ew / 2}" ry="${eh / 2}" fill="white"/></svg>`;
      const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
      overlays.push({ input: overlay, top: Math.max(0, top), left: Math.max(0, left) });
    }

    if (overlays.length === 0) return buf;
    return await sharp(buf, { failOn: 'none' }).composite(overlays).toBuffer();
  } catch {
    return buf;
  }
}

// ─── Stage 7: Shadow removal (illumination correction) ───────────────────────

/**
 * Remove shadows and illumination gradients via background estimation.
 *
 * Classic technique: estimate the page background by heavily blurring the
 * image (large-kernel Gaussian), then divide the original by the background
 * to normalize illumination: result = clamp(orig * 255 / bg). This removes
 * shadows near binding edges, uneven lighting, and gradient backgrounds
 * while preserving text contrast.
 */
async function removeShadows(buf: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) return buf;

    // Work in grayscale for the illumination correction.
    const orig = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    const oData = orig.data;
    const channels = orig.info.channels;

    // Background = heavy blur of the grayscale image. Kernel sigma scales
    // with image size so it covers large shadow gradients.
    const sigma = Math.max(15, Math.round(Math.min(w, h) / 30));
    const bg = await sharp(buf)
      .greyscale()
      .blur(sigma)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bData = bg.data;

    // result[i] = clamp(orig * 255 / max(bg, 1))
    const outBuf = Buffer.alloc(oData.length);
    for (let i = 0; i < oData.length; i++) {
      const o = oData[i];
      const b = bData[i] > 8 ? bData[i] : 8; // avoid div-by-zero on pure black
      let v = (o * 255) / b;
      if (v > 255) v = 255;
      if (v < 0) v = 0;
      outBuf[i] = v;
    }

    // Return as a grayscale PNG with the same dimensions (PNG preserves
    // dimension metadata so the next sharp() call reads it correctly).
    return await sharp(outBuf, {
      raw: { width: w, height: h, channels: 1 },
    })
      .png()
      .toBuffer();
  } catch {
    return buf;
  }
}

// ─── Stage 6: Speckle removal ────────────────────────────────────────────────

/**
 * Remove speckles (tiny dots/dust) via median filter. For clean-scan mode
 * we use a larger median window (3) to kill isolated pixels; for lighter
 * cleanup we use median(2).
 */
function removeSpeckles(pipe: sharp.Sharp, intensity: 'light' | 'strong'): sharp.Sharp {
  return intensity === 'strong' ? pipe.median(3) : pipe.median(2);
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

/**
 * Process a single rendered page PNG through the full scan-cleanup pipeline.
 * Writes the cleaned image to outDir. Never throws — falls back to the
 * original image so the page is never lost.
 */
export async function cleanPageRaster(
  sourcePng: string,
  outDir: string,
  page: number,
  opts: CleanupOptions
): Promise<RasterResult> {
  const ext = opts.quality === 'fast' || opts.quality === 'balanced' ? 'jpg' : 'png';
  const outPath = path.join(outDir, `clean-${String(page).padStart(4, '0')}.${ext}`);

  try {
    const meta = await sharp(sourcePng, { failOn: 'none' }).metadata();
    let buf = await sharp(sourcePng, { failOn: 'none' }).toBuffer();

    const isScanCleanup =
      opts.cleanScan || opts.mode === 'clean-scan';

    // Stage 1: flatten transparency onto white paper.
    if (opts.removeBackground || isScanCleanup || !opts.keepTransparency) {
      buf = await sharp(buf, { failOn: 'none' })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toBuffer();
    }

    // Stages 2-7: scan-cleanup-specific (deskew, borders, hole punches,
    // speckles, shadows). These noticeably improve scanned documents.
    if (isScanCleanup) {
      // Stage 4: border removal — run FIRST while the dark border is still
      // clearly visible (shadow removal would lighten it below the detection
      // threshold). Also serves as page edge detection + margin cleanup.
      buf = await removeBorders(buf);

      // Stage 7: shadow removal (illumination correction) — run on the
      // border-free image so shadows near edges don't affect edge detection.
      buf = await removeShadows(buf);

      // Stage 2: deskew (straighten skewed scans) — works best on a clean,
      // border-free, shadow-free image where text lines are the dominant signal.
      buf = await deskew(buf);

      // Stage 5: hole punch removal (fill 3-hole-punch circles).
      buf = await removeHolePunches(buf);

      // Stage 6: speckle removal (median filter for dust/dots).
      buf = await sharp(buf, { failOn: 'none' }).median(3).toBuffer();
    } else if (opts.removeBackground || opts.mode === 'background' || opts.mode === 'full') {
      // Light speckle removal for background-removal mode.
      buf = await removeSpeckles(sharp(buf, { failOn: 'none' }), 'light').toBuffer();
    }

    // Build the sharp pipeline for the remaining contrast/threshold/sharpen stages.
    let pipe = sharp(buf, { failOn: 'none' });

    // Background removal: histogram stretch to kill gray paper.
    if (opts.removeBackground || opts.mode === 'background' || opts.mode === 'full') {
      pipe = pipe.normalise();
    }

    // Stage 8: CLAHE (contrast-limited adaptive histogram equalization).
    if (isScanCleanup) {
      pipe = pipe.clahe({ width: 8, height: 8, maxSlope: 3 });
    }

    // Stage 9: threshold (binarize to clean B/W text).
    const wantBinary =
      isScanCleanup || (opts.quality === 'maximum' && opts.removeBackground);
    if (wantBinary && !opts.preserveColors) {
      pipe = pipe.greyscale().threshold(180, { grayscale: false });
    }

    // Stage 10: sharpen (unsharp mask for crisp text edges).
    if (opts.improveReadability || isScanCleanup) {
      pipe = pipe.sharpen({ sigma: 1.2, m1: 0.8, m2: 0.2 });
    }

    // Modulate: small brightness boost.
    if (opts.improveReadability) {
      pipe = pipe.modulate({
        brightness: 1.05,
        saturation: opts.preserveColors ? 1 : 0.85,
      });
    }

    // Output format: JPEG for fast/balanced, PNG for high/maximum.
    if (opts.quality === 'fast' || opts.quality === 'balanced') {
      pipe = pipe.jpeg({
        quality: opts.quality === 'fast' ? 72 : 85,
        mozjpeg: true,
      });
    } else {
      pipe = pipe.png({
        compressionLevel: opts.quality === 'maximum' ? 6 : 9,
        palette: false,
      });
    }

    await pipe.toFile(outPath);
    // Return the OUTPUT image dimensions (after deskew/border-removal may
    // have changed them), not the source dimensions.
    const outMeta = await sharp(outPath).metadata();
    return { pngPath: outPath, width: outMeta.width ?? meta.width ?? 0, height: outMeta.height ?? meta.height ?? 0 };
  } catch (err) {
    // Fallback: copy the original page so the document is never corrupted.
    try {
      await fs.copyFile(sourcePng, outPath);
    } catch {
      /* ignore */
    }
    const meta = await sharp(sourcePng).metadata();
    return { pngPath: outPath, width: meta.width ?? 0, height: meta.height ?? 0 };
  }
}

/**
 * Watermark region inpainting (raster approach for visual watermark removal
 * on scanned or flattened PDFs). Given a watermark bbox in PDF points and
 * the rendered page dimensions, whiten that region. Used when a vector
 * watermark can't be cleanly removed from the content stream.
 */
export async function maskWatermarkRegion(
  sourcePng: string,
  outPath: string,
  region: { x: number; y: number; width: number; height: number },
  pagePoints: { width: number; height: number },
  renderedPx: { width: number; height: number }
): Promise<void> {
  // Convert PDF user-space (origin bottom-left) to image pixels (origin top-left).
  const scaleX = renderedPx.width / pagePoints.width;
  const scaleY = renderedPx.height / pagePoints.height;
  const left = Math.max(0, Math.round(region.x * scaleX));
  const top = Math.max(0, Math.round((pagePoints.height - region.y - region.height) * scaleY));
  const w = Math.min(renderedPx.width - left, Math.round(region.width * scaleX));
  const h = Math.min(renderedPx.height - top, Math.round(region.height * scaleY));
  if (w <= 0 || h <= 0) {
    await fs.copyFile(sourcePng, outPath);
    return;
  }
  // Composite a white rectangle over the watermark region.
  const whiteRect = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await sharp(sourcePng, { failOn: 'none' })
    .composite([{ input: whiteRect, top, left }])
    .toFile(outPath);
}
