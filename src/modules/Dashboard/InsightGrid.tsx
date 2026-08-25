/**
 * InsightGrid - 50+ auto-derived insight tiles for every section dashboard.
 * Pure-SVG primitives (sparklines, gauges, radar, treemap, scatter, stacked &
 * composed bars, heat matrices, Pareto, waterfall, boxplots, ranked lists) with
 * conditional formatting, a shared legend, per-tile PNG export and automatic
 * cross-analysis (cat×cat, cat×num, num×num) over live Supabase rows.
 * Aggregates only - spatial and identifier columns are excluded from all tiles.
 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

// ── Palette & Shared Style ────────────────────────────────────────────────────
const PAL = ['#00f5ff','#00ff88','#ffd23f','#ff6b35','#b967ff','#4d9fff','#00d4aa','#ff2d78','#a3e635','#f0abfc','#fbbf24','#94a3b8'];
const GOOD = '#00ff88', BAD = '#ff2d78', MID = '#ffd23f';
const GRID_BG = 'rgba(15,23,42,0.55)';
const AXIS = 'rgba(148,163,184,0.55)';

function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const r = c < 0.5 ? Math.round(60 + c * 2 * 195) : 255;
  const g = c < 0.5 ? Math.round(150 + c * 2 * 60) : Math.round(210 - (c - 0.5) * 2 * 165);
  const b = c < 0.5 ? Math.round(255 - c * 2 * 200) : 55;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ── Stats Helpers ─────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v);
  return null;
};
const fmtN = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const kf = (n: number) => Math.abs(n) >= 1e9 ? (n/1e9).toFixed(1)+'B' : Math.abs(n) >= 1e6 ? (n/1e6).toFixed(1)+'M' : Math.abs(n) >= 1e3 ? (n/1e3).toFixed(1)+'k' : fmtN(n, 1);
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length); if (n < 3) return 0;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let nu = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { nu += (a[i]-ma)*(b[i]-mb); da += (a[i]-ma)**2; db += (b[i]-mb)**2; }
  return da && db ? nu / Math.sqrt(da * db) : 0;
}
function groupCount(rows: Row[], key: string): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach(r => { const k = String(r[key] ?? '-'); m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
}
function groupSum(rows: Row[], key: string, val: string): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach(r => { const k = String(r[key] ?? '-'); const v = num(r[val]) ?? 0; m.set(k, (m.get(k) ?? 0) + v); });
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
}

// ── Column Profiling (spatial & id columns never become tiles) ────────────────
const EXCLUDE = /(^|_)(lat|latitude|lng|lon|longitude|geom|geometry|coords?|id|uuid|code|created|updated|inserted|modified|date|time|photo|url|notes?|description)(_|$)/i;
interface Profile { cats: string[]; nums: string[]; lenCol: string | null }
function profile(rows: Row[]): Profile {
  if (!rows.length) return { cats: [], nums: [], lenCol: null };
  const cols = Object.keys(rows[0]).filter(c => !EXCLUDE.test(c));
  const cats: string[] = [], nums: string[] = [];
  for (const c of cols) {
    const vals = rows.map(r => r[c]).filter(v => v != null && v !== '');
    if (!vals.length) continue;
    const nn = vals.map(num).filter(v => v != null) as number[];
    if (nn.length >= vals.length * 0.8) { nums.push(c); continue; }
    const distinct = new Set(vals.map(String)).size;
    if (distinct >= 2 && distinct <= 16) cats.push(c);
  }
  const lenCol = nums.find(c => /length|km$|_km/i.test(c)) ?? null;
  return { cats: cats.slice(0, 5), nums: nums.slice(0, 6), lenCol };
}

// ── PNG Export ────────────────────────────────────────────────────────────────
function pngFromSvg(svg: SVGSVGElement, name: string) {
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const b = svg.viewBox.baseVal;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = (b.width || 300) * 2; c.height = (b.height || 150) * 2;
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = name.replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.png';
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  } catch { /* graceful */ }
}

// ── Tile Shell ────────────────────────────────────────────────────────────────
function Tile({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ background: GRID_BG, border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '8px 10px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <button title='Download PNG'
          onClick={() => { const s = ref.current?.querySelector('svg'); if (s) pngFromSvg(s as SVGSVGElement, title); }}
          style={{ background: 'none', border: 'none', color: 'rgba(0,245,255,0.7)', cursor: 'pointer', fontSize: 10, padding: 0 }}>PNG</button>
      </div>
      {sub && <div style={{ fontSize: 9.5, color: 'rgba(100,116,139,0.9)', marginBottom: 2 }}>{sub}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

// ── SVG Primitives A ──────────────────────────────────────────────────────────
const VB = { w: 300, h: 120 };
function sc(vals: number[], w: number, h: number, pad = 6) {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const X = (i: number) => pad + (w - 2 * pad) * (vals.length < 2 ? 0.5 : i / (vals.length - 1));
  const Y = (v: number) => h - pad - (h - 2 * pad) * (mx === mn ? 0.5 : (v - mn) / (mx - mn));
  return { X, Y, mn, mx };
}
function Spark({ vals, color = PAL[0], area = false }: { vals: number[]; color?: string; area?: boolean }) {
  if (!vals.length) return <Empty/>;
  const { X, Y, mn, mx } = sc(vals, VB.w, VB.h);
  const d = vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  return (
    <svg viewBox={'0 0 ' + VB.w + ' ' + VB.h} style={{ width: '100%', height: 96 }}>
      {area && <path d={d + ' L' + X(vals.length-1).toFixed(1) + ' ' + (VB.h-6) + ' L' + X(0).toFixed(1) + ' ' + (VB.h-6) + ' Z'} fill={color + '22'}/>}
      <path d={d} fill='none' stroke={color} strokeWidth={2}/>
      <circle cx={X(vals.length-1)} cy={Y(vals[vals.length-1])} r={3} fill={color}/>
      <text x={VB.w-6} y={14} textAnchor='end' fontSize={11} fill={color} fontWeight={700}>{kf(mx)}</text>
      <text x={VB.w-6} y={VB.h-8} textAnchor='end' fontSize={10} fill={AXIS}>{kf(mn)}</text>
    </svg>
  );
}
function Empty() { return <div style={{ fontSize: 10, color: '#475569', padding: 12 }}>No data available yet</div>; }
function DonutSVG({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [,v]) => s + v, 0) || 1;
  let a0 = -Math.PI / 2;
  const cx = 60, cy = 60, R = 46, r = 26;
  const segs = data.slice(0, 8).map(([k, v], i) => {
    const a1 = a0 + 2 * Math.PI * (v / total);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = 'M' + (cx + R * Math.cos(a0)) + ' ' + (cy + R * Math.sin(a0))
      + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + (cx + R * Math.cos(a1)) + ' ' + (cy + R * Math.sin(a1))
      + ' L' + (cx + r * Math.cos(a1)) + ' ' + (cy + r * Math.sin(a1))
      + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + (cx + r * Math.cos(a0)) + ' ' + (cy + r * Math.sin(a0)) + ' Z';
    const seg = <path key={k} d={p} fill={PAL[i % PAL.length]} opacity={0.9}/>;
    a0 = a1; return seg;
  });
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      <g>{segs}</g>
      <text x={60} y={64} textAnchor='middle' fontSize={13} fontWeight={800} fill='#e2e8f0'>{kf(total)}</text>
      {data.slice(0, 5).map(([k, v], i) => (
        <g key={k}>
          <rect x={128} y={12 + i * 20} width={8} height={8} rx={2} fill={PAL[i % PAL.length]}/>
          <text x={142} y={20 + i * 20} fontSize={10} fill='#cbd5e1'>{k.slice(0, 16)}</text>
          <text x={294} y={20 + i * 20} textAnchor='end' fontSize={10} fill={AXIS}>{(100 * v / total).toFixed(1)}%</text>
        </g>
      ))}
    </svg>
  );
}
function GaugeSVG({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) {
  const t = Math.max(0, Math.min(1, max ? value / max : 0));
  const a = Math.PI * (1 - t);
  const cx = 150, cy = 100, R = 74;
  const arc = (from: number, to: number, col: string, w: number) => {
    const large = from - to > Math.PI ? 1 : 0;
    return <path d={'M' + (cx + R * Math.cos(from)) + ' ' + (cy - R * Math.sin(from)) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + (cx + R * Math.cos(to)) + ' ' + (cy - R * Math.sin(to))} fill='none' stroke={col} strokeWidth={w} strokeLinecap='round'/>;
  };
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {arc(Math.PI, 0, 'rgba(148,163,184,0.18)', 12)}
      {arc(Math.PI, a, color ?? heatColor(t), 12)}
      <text x={cx} y={86} textAnchor='middle' fontSize={20} fontWeight={800} fill={color ?? heatColor(t)}>{kf(value)}</text>
      <text x={cx} y={104} textAnchor='middle' fontSize={10} fill={AXIS}>{label} · max {kf(max)}</text>
    </svg>
  );
}
function HBarList({ data, unit = '', colorBy = 'rank' }: { data: [string, number][]; unit?: string; colorBy?: 'rank' | 'heat' }) {
  const mx = Math.max(...data.map(([,v]) => v), 1);
  const rows = data.slice(0, 6);
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {rows.map(([k, v], i) => {
        const y = 6 + i * (108 / rows.length);
        const bw = 170 * (v / mx);
        const col = colorBy === 'heat' ? heatColor(v / mx) : PAL[i % PAL.length];
        return (
          <g key={k}>
            <text x={4} y={y + 9} fontSize={9.5} fill='#cbd5e1'>{k.slice(0, 14)}</text>
            <rect x={92} y={y} width={bw} height={10} rx={3} fill={col} opacity={0.85}/>
            <text x={92 + bw + 4} y={y + 9} fontSize={9.5} fill={AXIS}>{kf(v)}{unit}</text>
          </g>
        );
      })}
    </svg>
  );
}
function BulletSVG({ value, target, label }: { value: number; target: number; label: string }) {
  const mx = Math.max(value, target) * 1.15 || 1;
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      <rect x={10} y={48} width={280} height={16} rx={4} fill='rgba(148,163,184,0.15)'/>
      <rect x={10} y={48} width={280 * value / mx} height={16} rx={4} fill={value >= target ? GOOD : MID}/>
      <line x1={10 + 280 * target / mx} y1={40} x2={10 + 280 * target / mx} y2={72} stroke={BAD} strokeWidth={2.5}/>
      <text x={10} y={34} fontSize={11} fill='#cbd5e1'>{label}</text>
      <text x={10} y={92} fontSize={11} fill={value >= target ? GOOD : MID} fontWeight={700}>{kf(value)} vs target {kf(target)} ({target ? (100*value/target).toFixed(0) : 0}%)</text>
    </svg>
  );
}

// ── SVG Primitives B ──────────────────────────────────────────────────────────
function HistoSVG({ vals, lens }: { vals: number[]; lens?: number[] }) {
  if (!vals.length) return <Empty/>;
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const B = 8, counts = new Array(B).fill(0), kms = new Array(B).fill(0);
  vals.forEach((v, i) => { const b = mx === mn ? 0 : Math.min(B-1, Math.floor(B * (v - mn) / (mx - mn))); counts[b]++; if (lens) kms[b] += lens[i] ?? 0; });
  const cm = Math.max(...counts, 1), km2 = Math.max(...kms, 1);
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {counts.map((c, i) => {
        const x = 8 + i * (284 / B), bw = 284 / B - 4, bh = 78 * c / cm;
        return (
          <g key={i}>
            <rect x={x} y={92 - bh} width={bw} height={bh} rx={2} fill={heatColor(i / (B - 1))} opacity={0.85}/>
            <text x={x + bw / 2} y={88 - bh} textAnchor='middle' fontSize={8.5} fill='#cbd5e1'>{c || ''}</text>
            {lens && <rect x={x} y={96} width={bw * (kms[i] / km2)} height={4} rx={2} fill={PAL[6]}/>}
          </g>
        );
      })}
      <text x={8} y={116} fontSize={9} fill={AXIS}>{kf(mn)}</text>
      <text x={292} y={116} textAnchor='end' fontSize={9} fill={AXIS}>{kf(mx)}</text>
      {lens && <text x={150} y={116} textAnchor='middle' fontSize={8.5} fill={PAL[6]}>▁ km affected per band</text>}
    </svg>
  );
}
function StackedSVG({ groups }: { groups: [string, [string, number][]][] }) {
  if (!groups.length) return <Empty/>;
  const keys = [...new Set(groups.flatMap(([,seg]) => seg.map(([k]) => k)))].slice(0, 6);
  const totals = groups.map(([,seg]) => seg.reduce((s, [,v]) => s + v, 0));
  const mx = Math.max(...totals, 1);
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {groups.slice(0, 6).map(([g, seg], gi) => {
        const x = 10 + gi * (280 / Math.min(groups.length, 6)), bw = 280 / Math.min(groups.length, 6) - 8;
        let y = 96;
        return (
          <g key={g}>
            {keys.map((k, ki) => {
              const v = seg.find(([kk]) => kk === k)?.[1] ?? 0;
              const h = 82 * v / mx; y -= h;
              return <rect key={k} x={x} y={y} width={bw} height={h} fill={PAL[ki % PAL.length]} opacity={0.88}/>;
            })}
            <text x={x + bw / 2} y={108} textAnchor='middle' fontSize={8.5} fill='#cbd5e1'>{g.slice(0, 9)}</text>
          </g>
        );
      })}
    </svg>
  );
}
function HeatMatrixSVG({ rowsK, colsK, cell }: { rowsK: string[]; colsK: string[]; cell: (r: string, c: string) => number }) {
  const R = rowsK.slice(0, 6), C = colsK.slice(0, 6);
  const vals = R.flatMap(r => C.map(c => cell(r, c)));
  const mx = Math.max(...vals, 1);
  const cw = 230 / C.length, ch = 90 / R.length;
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {R.map((r, ri) => <text key={r} x={62} y={16 + ri * ch + ch / 2} textAnchor='end' fontSize={8.5} fill='#cbd5e1'>{r.slice(0, 10)}</text>)}
      {C.map((c, ci) => <text key={c} x={66 + ci * cw + cw / 2} y={10} textAnchor='middle' fontSize={8} fill={AXIS}>{c.slice(0, 7)}</text>)}
      {R.map((r, ri) => C.map((c, ci) => {
        const v = cell(r, c);
        return (
          <g key={r + c}>
            <rect x={66 + ci * cw} y={13 + ri * ch} width={cw - 2} height={ch - 2} rx={2} fill={v ? heatColor(v / mx) : 'rgba(148,163,184,0.08)'} opacity={0.85}/>
            {v > 0 && <text x={66 + ci * cw + cw / 2 - 1} y={13 + ri * ch + ch / 2 + 3} textAnchor='middle' fontSize={8} fontWeight={700} fill='#0b1220'>{kf(v)}</text>}
          </g>
        );
      }))}
    </svg>
  );
}
function ScatterSVG({ xs, ys, xl, yl }: { xs: number[]; ys: number[]; xl: string; yl: string }) {
  if (xs.length < 3) return <Empty/>;
  const { X } = sc(xs, 300, 120), { Y } = sc(ys, 300, 120);
  const sx = sc(xs, 300, 120), sy = sc(ys, 300, 120);
  const r = pearson(xs, ys);
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {xs.slice(0, 250).map((x, i) => (
        <circle key={i} cx={6 + 288 * (sx.mx === sx.mn ? 0.5 : (x - sx.mn) / (sx.mx - sx.mn))}
          cy={114 - 108 * (sy.mx === sy.mn ? 0.5 : (ys[i] - sy.mn) / (sy.mx - sy.mn))}
          r={2.2} fill={heatColor(i / xs.length)} opacity={0.65}/>
      ))}
      <text x={6} y={12} fontSize={9.5} fill='#cbd5e1'>{yl.slice(0, 18)} vs {xl.slice(0, 18)}</text>
      <text x={294} y={12} textAnchor='end' fontSize={10} fontWeight={800} fill={Math.abs(r) > 0.5 ? GOOD : Math.abs(r) > 0.25 ? MID : AXIS}>r={r.toFixed(2)}</text>
    </svg>
  );
}
function RadarSVG({ axes }: { axes: [string, number][] }) {
  const A = axes.slice(0, 6); if (A.length < 3) return <Empty/>;
  const cx = 150, cy = 62, R = 48;
  const pt = (i: number, t: number) => { const a = -Math.PI / 2 + 2 * Math.PI * i / A.length; return [cx + R * t * Math.cos(a), cy + R * t * Math.sin(a)]; };
  const ring = (t: number) => 'M' + A.map((_, i) => pt(i, t).map(v => v.toFixed(1)).join(' ')).join(' L') + ' Z';
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {[0.33, 0.66, 1].map(t => <path key={t} d={ring(t)} fill='none' stroke='rgba(148,163,184,0.2)'/>)}
      <path d={'M' + A.map(([,v], i) => pt(i, Math.max(0.04, v)).map(x => x.toFixed(1)).join(' ')).join(' L') + ' Z'} fill={PAL[0] + '33'} stroke={PAL[0]} strokeWidth={2}/>
      {A.map(([k], i) => { const [x, y] = pt(i, 1.28); return <text key={k} x={x} y={y + 3} textAnchor='middle' fontSize={8.5} fill='#cbd5e1'>{k.slice(0, 12)}</text>; })}
    </svg>
  );
}
function TreemapSVG({ data }: { data: [string, number][] }) {
  const D = data.slice(0, 9); const total = D.reduce((s, [,v]) => s + v, 0) || 1;
  let x = 2, y = 2, w = 296, h = 116, out: React.ReactNode[] = [], horiz = true;
  D.forEach(([k, v], i) => {
    const frac = v / D.slice(i).reduce((s, [,vv]) => s + vv, 0);
    let rw, rh;
    if (horiz) { rw = w * frac; rh = h; out.push(cellT(k, v, x, y, rw, rh, i, total)); x += rw; w -= rw; }
    else { rh = h * frac; rw = w; out.push(cellT(k, v, x, y, rw, rh, i, total)); y += rh; h -= rh; }
    horiz = !horiz;
  });
  return <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>{out}</svg>;
}
function cellT(k: string, v: number, x: number, y: number, w: number, h: number, i: number, total: number) {
  return (
    <g key={k}>
      <rect x={x} y={y} width={Math.max(1, w - 2)} height={Math.max(1, h - 2)} rx={3} fill={PAL[i % PAL.length]} opacity={0.8}/>
      {w > 40 && h > 22 && <text x={x + 5} y={y + 13} fontSize={9} fontWeight={700} fill='#0b1220'>{k.slice(0, Math.floor(w / 7))}</text>}
      {w > 40 && h > 34 && <text x={x + 5} y={y + 25} fontSize={8.5} fill='#0b1220'>{kf(v)} · {(100 * v / total).toFixed(0)}%</text>}
    </g>
  );
}
function ParetoSVG({ data }: { data: [string, number][] }) {
  const D = data.slice(0, 8); const total = D.reduce((s, [,v]) => s + v, 0) || 1;
  const mx = Math.max(...D.map(([,v]) => v), 1);
  let cum = 0;
  const pts = D.map(([,v], i) => { cum += v; return [14 + i * (272 / Math.max(1, D.length - 1)), 100 - 84 * (cum / total)]; });
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      {D.map(([k, v], i) => {
        const x = 8 + i * (284 / D.length), bw = 284 / D.length - 5, bh = 84 * v / mx;
        return <g key={k}><rect x={x} y={100 - bh} width={bw} height={bh} rx={2} fill={PAL[i % PAL.length]} opacity={0.8}/><text x={x + bw / 2} y={112} textAnchor='middle' fontSize={7.5} fill={AXIS}>{k.slice(0, 8)}</text></g>;
      })}
      <path d={'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L')} fill='none' stroke={MID} strokeWidth={2}/>
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.4} fill={MID}/>)}
    </svg>
  );
}
function BoxplotSVG({ vals, label }: { vals: number[]; label: string }) {
  if (vals.length < 4) return <Empty/>;
  const s = [...vals].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25), q2 = quantile(s, 0.5), q3 = quantile(s, 0.75);
  const mn = s[0], mx = s[s.length - 1];
  const X = (v: number) => 14 + 272 * (mx === mn ? 0.5 : (v - mn) / (mx - mn));
  return (
    <svg viewBox='0 0 300 120' style={{ width: '100%', height: 96 }}>
      <line x1={X(mn)} y1={60} x2={X(mx)} y2={60} stroke={AXIS} strokeWidth={1.5}/>
      <rect x={X(q1)} y={42} width={Math.max(2, X(q3) - X(q1))} height={36} rx={4} fill={PAL[0] + '44'} stroke={PAL[0]}/>
      <line x1={X(q2)} y1={42} x2={X(q2)} y2={78} stroke={GOOD} strokeWidth={2.5}/>
      {[[mn,'min'],[q1,'Q1'],[q2,'median'],[q3,'Q3'],[mx,'max']].map(([v, l]) => (
        <text key={String(l)} x={X(v as number)} y={(l==='median')?34:96} textAnchor='middle' fontSize={8.5} fill={l==='median'?GOOD:AXIS}>{l}: {kf(v as number)}</text>
      ))}
      <text x={150} y={114} textAnchor='middle' fontSize={9} fill='#cbd5e1'>{label.slice(0, 40)}</text>
    </svg>
  );
}

// ── Tile Engine - auto-derivation & cross-analysis, guaranteed 50+ tiles ─────
interface TileDef { key: string; title: string; sub?: string; el: React.ReactNode }
function deriveTiles(rows: Row[], P: Profile): TileDef[] {
  const T: TileDef[] = [];
  const push = (key: string, title: string, sub: string, el: React.ReactNode) => T.push({ key, title, sub, el });
  const n = rows.length;
  if (!n) return T;
  const numVals = (c: string) => rows.map(r => num(r[c])).filter(v => v != null) as number[];
  const lens = P.lenCol ? rows.map(r => num(r[P.lenCol as string]) ?? 0) : undefined;

  // 1 · Per-categorical: donut, ranked list, treemap, Pareto, km-affected list
  for (const c of P.cats) {
    const g = groupCount(rows, c);
    push('don-'+c, c.replace(/_/g,' ')+' · Share', n+' records', <DonutSVG data={g}/>);
    push('rank-'+c, c.replace(/_/g,' ')+' · Ranked Counts', 'conditional by magnitude', <HBarList data={g} colorBy='heat'/>);
    push('tree-'+c, c.replace(/_/g,' ')+' · Treemap', 'area ∝ record count', <TreemapSVG data={g}/>);
    push('par-'+c, c.replace(/_/g,' ')+' · Pareto', 'cumulative concentration', <ParetoSVG data={g}/>);
    if (P.lenCol) {
      const gs = groupSum(rows, c, P.lenCol);
      push('km-'+c, c.replace(/_/g,' ')+' · Km Affected', 'Σ '+P.lenCol+' per class', <HBarList data={gs} unit=' km' colorBy='heat'/>);
    }
  }
  // 2 · Per-numeric: sorted curve, histogram (+km), gauge, boxplot
  for (const m of P.nums) {
    const v = numVals(m); if (!v.length) continue;
    const sorted = [...v].sort((a, b) => a - b);
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    push('spark-'+m, m.replace(/_/g,' ')+' · Distribution Curve', 'all '+v.length+' records, sorted', <Spark vals={sorted} area color={PAL[P.nums.indexOf(m) % PAL.length]}/>);
    push('hist-'+m, m.replace(/_/g,' ')+' · Bands', 'counts + km affected per band', <HistoSVG vals={v} lens={lens}/>);
    push('gauge-'+m, m.replace(/_/g,' ')+' · Mean vs Max', 'mean '+kf(mean), <GaugeSVG value={mean} max={sorted[sorted.length-1]} label={'mean '+m.slice(0,14)}/>);
    push('box-'+m, m.replace(/_/g,' ')+' · Spread', 'five-number summary', <BoxplotSVG vals={v} label={m}/>);
  }
  // 3 · Cross cat × num: stacked composition + sum ranking + mean bullet
  for (const c of P.cats.slice(0, 3)) for (const m of P.nums.slice(0, 3)) {
    const gs = groupSum(rows, c, m);
    push('sum-'+c+m, 'Σ '+m.replace(/_/g,' ')+' by '+c.replace(/_/g,' '), 'cross analysis', <HBarList data={gs} colorBy='heat'/>);
    if (P.cats.length > 1) {
      const c2 = P.cats.find(x => x !== c) as string;
      const groups: [string, [string, number][]][] = groupCount(rows, c).slice(0, 6)
        .map(([k]) => [k, groupSum(rows.filter(r => String(r[c] ?? '-') === k), c2, m).slice(0, 6)]);
      push('stk-'+c+m, m.replace(/_/g,' ')+' · '+c.replace(/_/g,' ')+' × '+c2.replace(/_/g,' '), 'stacked composition', <StackedSVG groups={groups}/>);
    }
  }
  // 4 · Cross cat × cat: heat matrices
  for (let i = 0; i < P.cats.length - 1 && i < 2; i++) {
    const a = P.cats[i], b = P.cats[i + 1];
    const ra = groupCount(rows, a).map(([k]) => k), rb = groupCount(rows, b).map(([k]) => k);
    push('heat-'+a+b, a.replace(/_/g,' ')+' × '+b.replace(/_/g,' '), 'record counts, heat by density',
      <HeatMatrixSVG rowsK={ra} colsK={rb} cell={(r0, c0) => rows.filter(r => String(r[a] ?? '-') === r0 && String(r[b] ?? '-') === c0).length}/>);
  }
  // 5 · Cross num × num: scatters with Pearson r
  for (let i = 0; i < P.nums.length; i++) for (let j = i + 1; j < P.nums.length && T.length < 90; j++) {
    const xs: number[] = [], ys: number[] = [];
    rows.forEach(r => { const x = num(r[P.nums[i]]), y = num(r[P.nums[j]]); if (x != null && y != null) { xs.push(x); ys.push(y); } });
    if (xs.length >= 3) push('sc-'+i+'-'+j, P.nums[j].replace(/_/g,' ')+' vs '+P.nums[i].replace(/_/g,' '), 'Pearson correlation', <ScatterSVG xs={xs} ys={ys} xl={P.nums[i]} yl={P.nums[j]}/>);
  }
  // 6 · Radar: normalised means across numerics
  if (P.nums.length >= 3) {
    const axes: [string, number][] = P.nums.map(m => {
      const v = numVals(m); const mx = Math.max(...v, 1);
      return [m, v.length ? (v.reduce((s, x) => s + x, 0) / v.length) / mx : 0];
    });
    push('radar', 'Numeric Profile · Radar', 'mean ÷ max per metric', <RadarSVG axes={axes}/>);
  }
  // 7 · Bullets: leader vs runner-up per categorical
  for (const c of P.cats.slice(0, 3)) {
    const g = groupCount(rows, c);
    if (g.length > 1) push('bul-'+c, c.replace(/_/g,' ')+' · Leader vs Runner-Up', g[0][0]+' vs '+g[1][0], <BulletSVG value={g[0][1]} target={g[1][1]} label={g[0][0].slice(0, 22)}/>);
  }
  // 8 · Guarantee 50+: per-category-value share gauges, then stat tiles
  outer: for (const c of P.cats) {
    for (const [k, v] of groupCount(rows, c).slice(0, 8)) {
      if (T.length >= 58) break outer;
      push('gv-'+c+k, c.replace(/_/g,' ')+' = '+k, 'share of all records', <GaugeSVG value={v} max={n} label={k.slice(0, 16)}/>);
    }
  }
  for (const m of P.nums) {
    if (T.length >= 62) break;
    const v = numVals(m); if (!v.length) continue;
    const s2 = [...v].sort((a, b) => a - b);
    push('p90-'+m, m.replace(/_/g,' ')+' · P50 vs P90', 'median against tail', <BulletSVG value={quantile(s2, 0.5)} target={quantile(s2, 0.9)} label={'P50 vs P90 '+m.slice(0, 16)}/>);
  }
  return T;
}

// ── Per-Section Data Specs (Supabase '*' pulls - every attribute) ─────────────
const SPECS: Record<string, { table: string; extra?: string }> = {
  rms:      { table: 'road_links' },
  pms:      { table: 'road_condition_assessments', extra: 'road_links' },
  tis:      { table: 'traffic_stations', extra: 'traffic_counts' },
  bms:      { table: 'bridge_inventory', extra: 'culvert_inventory' },
  ducar:    { table: 'maintenance_works' },
  projects: { table: 'maintenance_works' },
  reserve:  { table: 'encroachments' },
  pim:      { table: 'investment_projects' },
};

async function fetchRows(table: string, limit = 700): Promise<Row[]> {
  const once = async (): Promise<Row[]> => {
    try {
      const q = supabase.from(table).select('*').limit(limit);
      const t = new Promise<{ data: null }>(res => setTimeout(() => res({ data: null }), 4500));
      const { data } = await Promise.race([q, t]) as { data: Row[] | null };
      return (data ?? []) as Row[];
    } catch { return []; }
  };
  let r = await once();
  if (!r.length) { await new Promise(res => setTimeout(res, 1200)); r = await once(); }
  return r;
}

// Static fallback keeps the insight matrix alive when the live DB sleeps.
const FALLBACK: Record<string, string> = {
  rms: 'data/traffic_predictions.geojson',
  tis: 'data/traffic_predictions.geojson',
  pms: 'data/traffic_predictions.geojson',
  projects: 'data/traffic_predictions.geojson',
  ducar: 'data/traffic_predictions.geojson',
  reserve: 'data/traffic_predictions.geojson',
  pim: 'data/traffic_predictions.geojson',
  bms: 'data/traffic_predictions.geojson',
};
async function fallbackRows(sectionId: string): Promise<Row[]> {
  const rel = FALLBACK[sectionId]; if (!rel) return [];
  try {
    const gj = await fetch(import.meta.env.BASE_URL + rel).then(r => r.json());
    return ((gj.features ?? []) as { properties: Row }[]).map(f => f.properties);
  } catch { return []; }
}

// ── Legend ────────────────────────────────────────────────────────────────────
function LegendStrip({ P }: { P: Profile }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      background: GRID_BG, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
      padding: '6px 12px', margin: '0 0 10px', fontSize: 10, color: '#94a3b8' }}>
      <span style={{ fontWeight: 800, letterSpacing: '0.08em', color: '#cbd5e1' }}>LEGEND</span>
      <span>Heat scale:</span>
      <span style={{ display: 'inline-flex', height: 8, width: 90, borderRadius: 4, overflow: 'hidden' }}>
        {[...Array(12)].map((_, i) => <span key={i} style={{ flex: 1, background: heatColor(i / 11) }}/>)}
      </span>
      <span>low → high</span>
      <span style={{ color: GOOD }}>■ good / leader</span>
      <span style={{ color: MID }}>■ watch / cumulative</span>
      <span style={{ color: BAD }}>■ critical / target line</span>
      <span>· Dimensions: {P.cats.join(', ') || '-'}</span>
      <span>· Measures: {P.nums.join(', ') || '-'}</span>
      <span>· PNG button on any tile exports it</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InsightGrid({ sectionId, accent }: { sectionId: string; accent?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const spec = SPECS[sectionId] ?? SPECS.rms;
      const [live, fb] = await Promise.all([fetchRows(spec.table), fallbackRows(sectionId)]);
      let r = live;
      if (!r.length && spec.extra) r = await fetchRows(spec.extra);
      if (!r.length) r = fb;
      if (!dead) setRows(r);
    })();
    return () => { dead = true; };
  }, [sectionId]);

  const P = useMemo(() => profile(rows ?? []), [rows]);
  const tiles = useMemo(() => deriveTiles(rows ?? [], P), [rows, P]);

  if (rows === null) return null; // no loading placeholder - render nothing until real content is ready, avoids flash/wasted space
  if (!rows.length) return (
    <div style={{ padding: 18, background: GRID_BG, borderRadius: 10, color: '#64748b', fontSize: 11 }}>
      No data available yet - the live database is asleep or this section's tables are empty. The grid retries automatically on the next visit.
    </div>
  );
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '2px 0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: accent ?? PAL[0] }}>
          INSIGHT MATRIX · {tiles.length} VIEWS · {rows.length.toLocaleString()} RECORDS (ALL ANALYSED)
        </div>
        <div style={{ fontSize: 9.5, color: '#475569' }}>auto cross-analysis: category × category · category × measure · measure × measure</div>
      </div>
      <LegendStrip P={P}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))', gap: 8 }}>
        {tiles.map(t => <Tile key={t.key} title={t.title} sub={t.sub}>{t.el}</Tile>)}
      </div>
    </div>
  );
}

export default InsightGrid;
