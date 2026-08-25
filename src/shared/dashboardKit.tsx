/**
 * dashboardKit - shared "100-chart" dashboard design system.
 *
 * Ports the look of public/dashboard.html (the standalone NRMS Live Dashboard
 * mockup - glow KPI tiles, accent chart-boxes, dense multi-chart grids) into
 * real React components driven by Recharts, so every section's Dashboard tab
 * can use live/real app data instead of a static page.
 *
 * Colour system matches dashboard.html's CSS custom properties exactly.
 */
import type { ReactNode } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, AreaChart, Area, ScatterChart, Scatter, ZAxis,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Treemap,
  RadialBarChart, RadialBar, FunnelChart, Funnel, LabelList,
} from 'recharts';

// ─── Palette (matches dashboard.html :root vars) ────────────────────────────
export const DASH_C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f', orange: '#ff6b35',
  pink: '#ff2d78', red: '#ff2d78', purple: '#b967ff', teal: '#00d4aa', blue: '#4d9fff',
  gray: 'rgba(148,163,184,0.7)',
};
// 4-band condition scale used by overview dashboards (Good/Fair/Poor/Critical).
// NOTE: this is a 4-stop variant for dashboards with 4 labeled bands - it is
// distinct from the canonical 5-stop risk/condition scale in
// src/utils/helpers.ts (CONDITION_COLORS, RISK_SCALE_STOPS), which includes
// the amber #eab308 mid-point. Named differently here on purpose to avoid
// confusion with that 5-stop export.
export const DASHBOARD_COND_COLORS = ['#22c55e', '#84cc16', '#f97316', '#ef4444'];
export const REGION_COLORS = [DASH_C.cyan, DASH_C.green, DASH_C.yellow, DASH_C.purple, DASH_C.pink, DASH_C.orange];

export function rgbOf(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '148,163,184';
  return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`;
}

const TIP_STYLE = {
  background: 'rgba(4,9,18,0.95)', border: '1px solid rgba(0,245,255,0.2)',
  borderRadius: 8, fontSize: 10, color: '#e2eaf4',
};
const AXIS_TICK = { fontSize: 8.5, fill: 'rgba(148,163,184,0.6)' };
const AXIS_LABEL_STYLE = { fontSize: 9, fill: 'rgba(148,163,184,0.7)' };

// ─── Layout primitives ───────────────────────────────────────────────────────

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10,
      marginBottom: 18,
    }}>
      {children}
    </div>
  );
}

export function KpiTile({ label, value, sub, color = DASH_C.cyan }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const rgb = rgbOf(color);
  return (
    <div style={{
      position: 'relative', borderRadius: 14, padding: '12px 14px',
      background: `linear-gradient(145deg, rgba(${rgb},0.09) 0%, rgba(2,5,8,0.75) 75%)`,
      border: `1px solid rgba(${rgb},0.28)`, borderLeft: `3px solid ${color}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', textShadow: `0 0 18px rgba(${rgb},0.5)` }}>
        {value}
      </div>
      {sub && <div style={{ color: 'rgba(100,116,139,0.7)', fontSize: 8.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function SectionHdr({ children, accent = DASH_C.cyan }: { children: ReactNode; accent?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 900, color: accent, letterSpacing: '0.14em', textTransform: 'uppercase',
      margin: '20px 0 12px', paddingBottom: 7,
      borderBottom: `1px solid rgba(${rgbOf(accent)},0.2)`,
      textShadow: `0 0 12px rgba(${rgbOf(accent)},0.35)`,
    }}>
      {children}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 9, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function StatMini({ value, label, color = DASH_C.cyan }: { value: string; label: string; color?: string }) {
  const rgb = rgbOf(color);
  return (
    <div style={{
      background: `linear-gradient(145deg, rgba(${rgb},0.1) 0%, rgba(2,5,8,0.8) 75%)`,
      border: `1px solid rgba(${rgb},0.22)`, borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: '11px 13px',
    }}>
      <div style={{ color, fontSize: 17, fontWeight: 900, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 8.5, fontWeight: 700, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

const GRID_COLS: Record<string, string> = {
  '1': '1fr', '2': '1fr 1fr', '3': '1fr 1fr 1fr', '4': '1fr 1fr 1fr 1fr',
  '12': '1fr 1.6fr', '21': '1.6fr 1fr', '13': '1fr 2.2fr',
};

export function ChartGrid({ cols = '3', children }: { cols?: '1' | '2' | '3' | '4' | '12' | '21' | '13'; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS[cols], gap: 12, marginBottom: 14 }}>
      {children}
    </div>
  );
}

export function ChartBox({ title, subtitle, accent = DASH_C.cyan, height = 200, children }: {
  title: string; subtitle?: string; accent?: string; height?: number; children: ReactNode;
}) {
  const rgb = rgbOf(accent);
  return (
    <div style={{
      position: 'relative', borderRadius: 14, padding: '12px 12px 8px',
      background: `linear-gradient(135deg, rgba(${rgb},0.06) 0%, rgba(2,5,8,0.6) 55%, rgba(${rgb},0.015) 100%)`,
      border: `1px solid rgba(${rgb},0.16)`, borderLeft: `3px solid ${accent}`,
      boxShadow: `0 4px 24px rgba(${rgb},0.05), inset 0 1px 0 rgba(255,255,255,0.03)`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: accent, marginBottom: 2 }}>
        {title}
        {subtitle && <span style={{ color: 'rgba(100,116,139,0.7)', fontSize: 8.5, fontWeight: 600, marginLeft: 6 }}>{subtitle}</span>}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

// ─── Chart type components (Recharts) ────────────────────────────────────────

export interface Slice { name: string; value: number; color?: string; }

export function DonutChart({ data, colors = REGION_COLORS, innerRadius = 42 }: { data: Slice[]; colors?: string[]; innerRadius?: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={innerRadius + 26} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color ?? colors[i % colors.length]} />)}
        </Pie>
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: number) => v.toLocaleString()} />
        <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.7)' }} iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PieChartTile({ data, colors = REGION_COLORS }: { data: Slice[]; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={62} label={{ fontSize: 8, fill: '#c3cede' }}>
          {data.map((d, i) => <Cell key={i} fill={d.color ?? colors[i % colors.length]} />)}
        </Pie>
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: number) => v.toLocaleString()} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export interface BarSeries { key: string; name: string; color: string; }

export function BarV({ data, xKey, series, unit, stacked = false }: {
  data: any[]; xKey: string; series: BarSeries[]; unit?: string; stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} unit={unit} width={unit ? 44 : 34} />
        <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(0,245,255,0.05)' }} />
        <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.7)' }} iconSize={8} />
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined} radius={stacked ? undefined : [3, 3, 0, 0]} isAnimationActive animationDuration={500} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarH({ data, yKey, series, unit, stacked = false }: {
  data: any[]; yKey: string; series: BarSeries[]; unit?: string; stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, left: 4, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} unit={unit} />
        <YAxis type="category" dataKey={yKey} tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} width={92} />
        <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(0,245,255,0.05)' }} />
        <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.7)' }} iconSize={8} />
        {series.map(s => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined} radius={stacked ? undefined : [0, 3, 3, 0]} isAnimationActive animationDuration={500} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineMulti({ data, xKey, series, unit, area = false }: {
  data: any[]; xKey: string; series: BarSeries[]; unit?: string; area?: boolean;
}) {
  const Chart: any = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} unit={unit} width={unit ? 44 : 34} />
        <Tooltip contentStyle={TIP_STYLE} cursor={{ stroke: 'rgba(0,245,255,0.25)', strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.7)' }} iconSize={8} />
        {series.map(s => area ? (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.12} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} activeDot={{ r: 4 }} />
        ) : (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive animationDuration={600} activeDot={{ r: 5 }} />
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

export function ScatterBubble({ data, xLabel, yLabel, color = DASH_C.cyan, sizeKey = 'z' }: {
  data: { x: number; y: number; z?: number; label?: string }[];
  xLabel: string; yLabel: string; color?: string; sizeKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" />
        <XAxis type="number" dataKey="x" name={xLabel} tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.15)' }} tickLine={false}
          label={{ value: xLabel, position: 'insideBottom', offset: -2, style: AXIS_LABEL_STYLE }} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={AXIS_TICK} axisLine={false} tickLine={false}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', style: AXIS_LABEL_STYLE }} />
        {data[0]?.z !== undefined && <ZAxis type="number" dataKey={sizeKey} range={[24, 260]} />}
        <Tooltip contentStyle={TIP_STYLE} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill={color} fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function HeatGrid({ matrix, xLabels, yLabels, accent = DASH_C.cyan, unit = '' }: {
  matrix: number[][]; xLabels: string[]; yLabels: string[]; accent?: string; unit?: string;
}) {
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const rgb = rgbOf(accent);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `72px repeat(${xLabels.length}, 1fr)`, gap: 2, fontSize: 8, height: '100%', alignContent: 'start' }}>
      <div />
      {xLabels.map(h => (
        <div key={h} style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
      ))}
      {yLabels.map((row, ri) => (
        <>
          <div key={row} style={{ color: 'rgba(148,163,184,0.75)', fontWeight: 600, padding: '3px 2px', fontSize: 8 }}>{row}</div>
          {matrix[ri].map((v, ci) => {
            const intensity = Math.min(v / max, 1);
            return (
              <div key={`${row}-${ci}`} title={`${v}${unit}`} style={{
                background: `rgba(${rgb},${0.06 + intensity * 0.36})`,
                border: `1px solid rgba(${rgb},${0.08 + intensity * 0.2})`,
                borderRadius: 3, padding: '4px 0', textAlign: 'center', color: accent, fontWeight: 700, fontSize: 7.5,
              }}>{v}</div>
            );
          })}
        </>
      ))}
    </div>
  );
}

export function TreemapC({ data, colors = REGION_COLORS }: { data: { name: string; size: number }[]; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap data={data} dataKey="size" nameKey="name" stroke="#020508" fill={DASH_C.cyan} isAnimationActive animationDuration={500}
        content={((props: any) => {
          const { x, y, width, height, index, name, value } = props;
          const c = colors[index % colors.length];
          if (width < 2 || height < 2) return <g />;
          return (
            <g>
              <rect x={x} y={y} width={width} height={height} style={{ fill: c, fillOpacity: 0.28, stroke: '#020508', strokeWidth: 1 }} />
              {width > 46 && height > 22 && (
                <text x={x + 5} y={y + 14} fontSize={8} fill="#e2eaf4" fontWeight={700}>{name}</text>
              )}
              {width > 46 && height > 32 && (
                <text x={x + 5} y={y + 26} fontSize={8} fill={c}>{Number(value).toLocaleString()}</text>
              )}
            </g>
          );
        }) as any} />
    </ResponsiveContainer>
  );
}

export function GaugeC({ value, max = 100, target, color = DASH_C.cyan, suffix = '%', label }: {
  value: number; max?: number; target?: number; color?: string; suffix?: string; label?: string;
}) {
  const data = [{ name: 'v', value, fill: color }];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={data} startAngle={210} endAngle={-30} innerRadius="68%" outerRadius="100%" barSize={12}>
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'rgba(148,163,184,0.1)' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color, textShadow: `0 0 16px rgba(${rgbOf(color)},0.5)` }}>{value}{suffix}</div>
        {target !== undefined && <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>Target: {target}{suffix}</div>}
        {label && <div style={{ fontSize: 7.5, color: 'rgba(100,116,139,0.7)', marginTop: 1 }}>{label}</div>}
      </div>
    </div>
  );
}

export function FunnelC({ data, colors = REGION_COLORS }: { data: { name: string; value: number }[]; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: number) => v.toLocaleString()} />
        <Funnel dataKey="value" data={data.map((d, i) => ({ ...d, fill: colors[i % colors.length] }))} isAnimationActive animationDuration={500}>
          <LabelList position="right" dataKey="name" fill="rgba(148,163,184,0.8)" stroke="none" fontSize={8.5} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

export function RadarTile({ data, series, maxValue = 100 }: {
  data: any[]; series: BarSeries[]; maxValue?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgba(148,163,184,0.15)" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 8, fill: 'rgba(148,163,184,0.7)' }} />
        <PolarRadiusAxis domain={[0, maxValue]} tick={{ fontSize: 7, fill: 'rgba(148,163,184,0.4)' }} />
        {series.map(s => (
          <Radar key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.18} strokeWidth={2} isAnimationActive animationDuration={600} />
        ))}
        <Tooltip contentStyle={TIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.7)' }} iconSize={8} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Sunburst approximation: two concentric donut rings (inner = parent totals, outer = children). */
export function SunburstApprox({ inner, outer }: { inner: Slice[]; outer: Slice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={inner} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={26} outerRadius={48} stroke="#020508" strokeWidth={1}>
          {inner.map((d, i) => <Cell key={i} fill={d.color ?? REGION_COLORS[i % REGION_COLORS.length]} />)}
        </Pie>
        <Pie data={outer} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={74} stroke="#020508" strokeWidth={1}>
          {outer.map((d, i) => <Cell key={i} fill={d.color ?? REGION_COLORS[i % REGION_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={TIP_STYLE} formatter={(v: number) => v.toLocaleString()} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Box-plot approximation: composed bar (min–max whisker via stacked transparent base + range bar) plus a median tick. */
export function BoxPlotApprox({ data, unit }: {
  data: { name: string; min: number; q1: number; median: number; q3: number; max: number; color: string }[]; unit?: string;
}) {
  const chartData = data.map(d => ({
    name: d.name, base: d.min, whiskerLow: d.q1 - d.min, box: d.q3 - d.q1, whiskerHigh: d.max - d.q3, color: d.color, median: d.median,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} unit={unit} width={unit ? 44 : 34} />
        <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(0,245,255,0.05)' }} />
        <Bar dataKey="base" stackId="box" fill="transparent" isAnimationActive animationDuration={500} />
        <Bar dataKey="whiskerLow" stackId="box" fill="rgba(148,163,184,0.25)" isAnimationActive animationDuration={500} />
        <Bar dataKey="box" stackId="box" radius={[2, 2, 2, 2]} isAnimationActive animationDuration={500}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.55} />)}
        </Bar>
        <Bar dataKey="whiskerHigh" stackId="box" fill="rgba(148,163,184,0.25)" isAnimationActive animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Waterfall approximation: a bar chart with an invisible offset "base" series stacked under each visible delta. */
export function WaterfallC({ steps, unit }: {
  steps: { name: string; delta: number; isTotal?: boolean }[]; unit?: string;
}) {
  let running = 0;
  const chartData = steps.map(s => {
    if (s.isTotal) {
      const row = { name: s.name, base: 0, value: s.delta, color: DASH_C.green };
      running = s.delta;
      return row;
    }
    const start = running;
    running += s.delta;
    const base = Math.min(start, running);
    const value = Math.abs(s.delta);
    return { name: s.name, base, value, color: s.delta >= 0 ? DASH_C.cyan : DASH_C.orange };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 7.5, fill: 'rgba(148,163,184,0.6)' }} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={36} />
        <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'rgba(148,163,184,0.22)' }} tickLine={false} unit={unit} width={unit ? 44 : 34} />
        <Tooltip contentStyle={TIP_STYLE} cursor={{ fill: 'rgba(0,245,255,0.05)' }} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive animationDuration={500} />
        <Bar dataKey="value" stackId="w" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={500}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
