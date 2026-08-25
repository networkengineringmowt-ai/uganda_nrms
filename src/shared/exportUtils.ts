/**
 * exportUtils - generic export helpers used across all platform sections.
 * CSV/XLSX for tables, PNG/PDF for charts/maps via html-to-image, KML/GeoJSON
 * for geodata.
 */
import { toPng } from 'html-to-image';

// ── Internal helper ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportTableToCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escapeCsvCell(r[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const name = filename.endsWith('.csv') ? filename : `${filename}-${isoDate()}.csv`;
  triggerDownload(blob, name);
}

// ── PNG (charts, maps, any DOM container) ─────────────────────────────────────

export async function exportChartToPNG(
  containerRef: React.RefObject<HTMLElement | null>,
  filename: string,
) {
  const el = containerRef.current;
  if (!el) return;
  try {
    const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: '#02050a' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.png') ? filename : `${filename}-${isoDate()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('PNG export failed', e);
  }
}

export const exportMapToPNG = exportChartToPNG;

// Same as exportChartToPNG, but targets a DOM element by id - used by the
// platform-wide PageToolbar so any page/section can be exported without
// needing its own ref.
export async function exportElementToPNG(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  try {
    const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: '#02050a' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename.endsWith('.png') ? filename : `${filename}-${isoDate()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('PNG export failed', e);
  }
}

// ── PDF (snapshot of the current view, via the same html-to-image capture) ────

/**
 * Captures a DOM element as a raster image (same html-to-image pipeline used
 * for PNG) and drops it into a jsPDF document. If the captured image is
 * taller than a single page at the page's width, it is sliced into
 * page-height strips and each strip becomes its own page - a simple, robust
 * strategy that avoids re-flowing the underlying HTML/CSS into real PDF text.
 * This is a visual snapshot export, not a text-selectable document.
 */
export async function exportElementToPDF(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const { jsPDF } = await import('jspdf');

  const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: '#02050a', pixelRatio: 2 });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PDF export: image decode failed'));
    img.src = dataUrl;
  });

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  // Landscape A4 in points, matched to the captured element's aspect ratio.
  const orientation = imgW >= imgH ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Scale the full image to the page width, then figure out how many page
  // heights that scaled image spans.
  const scale = pageW / imgW;
  const scaledH = imgH * scale;
  const pageCount = Math.max(1, Math.ceil(scaledH / pageH));

  if (pageCount === 1) {
    const y = (pageH - scaledH) / 2;
    pdf.addImage(dataUrl, 'PNG', 0, Math.max(0, y), pageW, scaledH, undefined, 'FAST');
  } else {
    // Slice the source image (in source pixels) into page-height chunks via
    // an offscreen canvas, and add one page per chunk.
    const sliceHeightSrc = pageH / scale;
    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = Math.ceil(sliceHeightSrc);
    const ctx = canvas.getContext('2d');
    for (let page = 0; page < pageCount; page++) {
      const srcY = page * sliceHeightSrc;
      const thisSliceH = Math.min(sliceHeightSrc, imgH - srcY);
      if (thisSliceH <= 0) break;
      if (page > 0) pdf.addPage();
      if (ctx) {
        canvas.height = Math.ceil(thisSliceH);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, srcY, imgW, thisSliceH, 0, 0, imgW, thisSliceH);
        const sliceUrl = canvas.toDataURL('image/png');
        pdf.addImage(sliceUrl, 'PNG', 0, 0, pageW, thisSliceH * scale, undefined, 'FAST');
      }
    }
  }

  const name = filename.endsWith('.pdf') ? filename : `${filename}-${isoDate()}.pdf`;
  pdf.save(name);
}

// ── XLSX (generic - any table sourced as headers + row objects) ───────────────

/**
 * Lightweight XLSX writer for ad-hoc tables (e.g. scraped from the DOM by the
 * platform-wide export menu). For richer per-module exports with formulas /
 * totals / metadata sheets, see exportTableToExcel in ./excelExport.ts.
 */
export async function exportTableToXLSX(
  rows: Record<string, unknown>[],
  headers: string[],
  filename: string,
) {
  if (!rows.length || !headers.length) return;
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Uganda National Roads Platform - DNR/MOWT';
  wb.created = new Date();

  const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = headers.map(h => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(40, h.length + 6)),
  }));

  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FF7DD3E0' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16263E' } };
    cell.alignment = { vertical: 'middle' };
  });

  for (const r of rows) ws.addRow(headers.map(h => r[h] ?? ''));

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const name = filename.endsWith('.xlsx') ? filename : `${filename}-${isoDate()}.xlsx`;
  triggerDownload(blob, name);
}

// ── DOM table scanning (generic CSV/XLSX source for the platform-wide menu) ───

/**
 * The platform has dozens of independent table components (ExhaustiveTables,
 * DeepAnalysisTables, per-module registries, etc.) with no shared data layer
 * to hook a "give me the current rows" callback into from a single top-level
 * toolbar. Rather than plumb an export callback through every one of them,
 * the generic Export menu scans the visible content pane for the first
 * rendered <table> and parses it directly: <thead> th cells become headers,
 * <tbody> tr rows become row objects keyed by header label. This works for
 * every table on the platform for free and keeps PageToolbar decoupled from
 * individual modules - the tradeoff is it exports what's rendered (visible
 * page/filtered rows), not necessarily the full unfiltered dataset.
 */
export interface ScannedTable {
  headers: string[];
  rows: Record<string, unknown>[];
}

export function scanFirstTable(containerId: string): ScannedTable | null {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const table = container.querySelector('table');
  if (!table) return null;

  const headCells = Array.from(table.querySelectorAll('thead th'));
  const headers = headCells.map((th, i) => (th.textContent || `Column ${i + 1}`).trim());
  if (!headers.length) return null;

  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const rows: Record<string, unknown>[] = bodyRows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td'));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { row[h] = (cells[i]?.textContent || '').trim(); });
    return row;
  });

  return { headers, rows };
}

// ── GeoJSON ───────────────────────────────────────────────────────────────────

export function exportGeoJSON(
  geojson: object,
  filename: string,
) {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const name = filename.endsWith('.geojson') ? filename : `${filename}-${isoDate()}.geojson`;
  triggerDownload(blob, name);
}

// ── KML ───────────────────────────────────────────────────────────────────────

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface GeoJsonFeature {
  type: string;
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
  properties: Record<string, unknown>;
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

function featureToPlacemark(f: GeoJsonFeature): string {
  const props = f.properties;
  const name = escapeXml(String(props['name'] ?? props['link_name'] ?? props['id'] ?? 'Feature'));
  const desc = Object.entries(props)
    .map(([k, v]) => `<b>${escapeXml(k)}:</b> ${escapeXml(String(v ?? ''))}`)
    .join('<br/>');

  const geom = f.geometry;
  let coordTag = '';
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    coordTag = `<Point><coordinates>${c[0]},${c[1]},0</coordinates></Point>`;
  } else if (geom.type === 'LineString') {
    const pts = (geom.coordinates as number[][]).map(c => `${c[0]},${c[1]},0`).join(' ');
    coordTag = `<LineString><coordinates>${pts}</coordinates></LineString>`;
  } else if (geom.type === 'MultiLineString') {
    const inner = (geom.coordinates as number[][][])
      .map(line => {
        const pts = line.map(c => `${c[0]},${c[1]},0`).join(' ');
        return `<LineString><coordinates>${pts}</coordinates></LineString>`;
      })
      .join('\n    ');
    coordTag = `<MultiGeometry>${inner}</MultiGeometry>`;
  }

  return `  <Placemark>
    <name>${name}</name>
    <description><![CDATA[${desc}]]></description>
    ${coordTag}
  </Placemark>`;
}

export function geoJsonToKml(geojson: GeoJsonCollection, filename: string) {
  const placemarks = geojson.features.map(featureToPlacemark).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Uganda National Road Network</name>
  <description>Exported from Uganda Roads Management Platform - ${isoDate()}</description>
${placemarks}
</Document>
</kml>`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const name = filename.endsWith('.kml') ? filename : `${filename}-${isoDate()}.kml`;
  triggerDownload(blob, name);
}
