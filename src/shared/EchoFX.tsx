/**
 * EchoFX — ambient "alive" effects for the Echo design language.
 *   • <AmbientParticles/>   slow-moving glowing dots behind the app
 *   • useEchoRipple()       global click-ripple on buttons/cards (mount once)
 *   • useCountUp(target)    count-up animation when the element scrolls into view
 * Mount AmbientParticles + useEchoRipple once at the app root.
 */
import { useEffect, useRef, useState } from 'react';

// Multicolored neon palette (matches the neon-dark theme) — rgb triples.
const PALETTE = ['0,245,255', '0,255,136', '191,0,255', '255,0,110', '255,238,0', '0,136,255', '255,102,0'];

// Pre-render one soft glow sprite per palette colour (cheap drawImage instead of
// per-frame createRadialGradient).
function makeSprite(rgb: string): HTMLCanvasElement {
  const s = 48; const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${rgb},0.6)`); grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  return c;
}

export function AmbientParticles({ count = 22 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let w = 0; let h = 0; let last = 0; let hidden = false;
    const sprites = PALETTE.map(makeSprite);
    const dots = Array.from({ length: count }, (_, i) => ({
      x: Math.random(), y: Math.random(),
      r: 8 + Math.random() * 22,
      vx: (Math.random() - 0.5) * 0.00016,
      vy: (Math.random() - 0.5) * 0.00016,
      s: sprites[i % sprites.length],
      a: 0.25 + Math.random() * 0.4,
    }));
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const paint = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const px = d.x * w, py = d.y * h;
        ctx.globalAlpha = d.a;
        ctx.drawImage(d.s, px - d.r, py - d.r, d.r * 2, d.r * 2);
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (hidden || t - last < 33) return;   // ~30fps cap
      last = t;
      if (!reduce) for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > 1) d.vx *= -1;
        if (d.y < 0 || d.y > 1) d.vy *= -1;
      }
      paint();
    };
    paint();
    if (!reduce) raf = requestAnimationFrame(loop);
    const onVis = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [count]);
  return <canvas ref={ref} className="echo-particles" aria-hidden="true" />;
}

/** Global click ripple — attaches one delegated listener. */
export function useEchoRipple() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const onDown = (e: PointerEvent) => {
      const t = (e.target as HTMLElement)?.closest('button,[role="button"],[class*="card"],[class*="Card"],[role="tab"]') as HTMLElement | null;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ink = document.createElement('span');
      ink.className = 'echo-ripple-ink';
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${e.clientX - rect.left - size / 2}px`;
      ink.style.top = `${e.clientY - rect.top - size / 2}px`;
      const prevPos = getComputedStyle(t).position;
      if (prevPos === 'static') t.style.position = 'relative';
      if (getComputedStyle(t).overflow !== 'hidden') t.classList.add('echo-ripple');
      t.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
}

/**
 * useMetallizeObserver — platform-wide liquid-metal shimmer that survives React
 * re-renders. A MutationObserver watches the whole app subtree; on any change it
 * (debounced) re-tags leaf text nodes:
 *   • numbers / stat values         → .metallic-chrome
 *   • headings (H1–H6 / STRONG /     → .metallic-gold
 *     bold text > 16px)
 * Idempotent (re-applies if React drops the class), and excludes maps, SVG,
 * inputs and any .no-metal subtree so legibility + semantic colours are kept.
 */
const NUMERIC = /^[~<>≈]?\s*\$?€?\d[\d, ]*\.?\d*\s*(%|km|m\/km|k|M|B|bn|t|vpd|yrs?|UGX)?$/i;

export function useMetallizeObserver() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number;
    const scan = () => {
      const root = document.querySelector('main'); if (!root) return;
      const els = root.querySelectorAll('span,div,p,strong,b,h1,h2,h3,h4,h5,h6,td,th,li,a');
      els.forEach((el) => {
        const e = el as HTMLElement;
        if (e.children.length > 0) return;                                  // leaf text only
        if (e.closest('.leaflet-container,svg,input,textarea,.no-metal')) return;
        const txt = (e.textContent || '').trim();
        if (!txt || txt.length > 26) return;
        if (NUMERIC.test(txt)) {
          if (!e.classList.contains('metallic-chrome')) e.classList.add('metallic-chrome');
          return;
        }
        const tag = e.tagName;
        if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6' || tag === 'STRONG' || tag === 'B') {
          if (!e.classList.contains('metallic-gold')) e.classList.add('metallic-gold');
          return;
        }
        const cs = getComputedStyle(e);
        if (parseFloat(cs.fontSize) > 16 && (parseInt(cs.fontWeight) || 400) >= 600) {
          if (!e.classList.contains('metallic-gold')) e.classList.add('metallic-gold');
        }
      });
    };
    timer = window.setTimeout(scan, 400);
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(scan, 120); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { clearTimeout(timer); mo.disconnect(); };
  }, []);
}

/** Count-up to a numeric target once the element enters the viewport. */
export function useCountUp(target: number, { duration = 1100, decimals = 0 }: { duration?: number; decimals?: number } = {}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !done.current) {
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(target * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);
  return { ref, display: val.toFixed(decimals) };
}
