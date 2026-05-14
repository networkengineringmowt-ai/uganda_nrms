import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, X } from 'lucide-react';

interface MediaItem {
  id: string;
  file: string;
  type: 'image' | 'video' | 'pdf';
  title: string;
  source: string;
  category: string;
}

const CAT_COLOR: Record<string, string> = {
  drone: '#00f5ff', landmark: '#ff6b35', structures: '#3B82F6',
  condition: '#ffd23f', reports: '#b967ff', 'field-video': '#00ff88',
  traffic: '#4d9fff', documents: '#94a3b8', investment: '#ffd23f',
  admin: '#64748b', general: '#64748b',
};

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ items, index, onClose, onNav }: {
  items: MediaItem[]; index: number;
  onClose: () => void; onNav: (d: number) => void;
}) {
  const item = items[index];
  const url = `${import.meta.env.BASE_URL}media/${item.file}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNav(-1);
      if (e.key === 'ArrowRight') onNav(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, onNav]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', maxWidth: '92vw', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {item.type === 'video' ? (
          <video src={url} controls autoPlay
            style={{ maxWidth: '90vw', maxHeight: '82vh', borderRadius: 12,
              boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
        ) : (
          <img src={url} alt={item.title} loading="lazy"
            style={{ maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain',
              borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />
        )}

        {/* Caption + controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '4px 8px' }}>
          <span style={{ color: 'rgba(226,234,244,0.8)', fontSize: 12, fontWeight: 600 }}>
            {item.title}
            <span style={{ marginLeft: 8, color: 'rgba(148,163,184,0.45)', fontSize: 10 }}>
              {index + 1} / {items.length}
            </span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={url} download={item.file}
              style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 12px',
                color: 'white', fontSize: 12, textDecoration: 'none', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
              <Download size={11}/> Download
            </a>
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '4px 12px', color: 'white', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <X size={11}/> Close
            </button>
          </div>
        </div>

        {/* Prev / Next */}
        <button onClick={e => { e.stopPropagation(); onNav(-1); }} style={{
          position: 'absolute', left: -52, top: '42%',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', width: 44, height: 44,
          color: 'white', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <button onClick={e => { e.stopPropagation(); onNav(1); }} style={{
          position: 'absolute', right: -52, top: '42%',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', width: 44, height: 44,
          color: 'white', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>
    </div>
  );
}

// ── Media card ────────────────────────────────────────────────────────────────
function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const [hov, setHov] = useState(false);
  const url = `${import.meta.env.BASE_URL}media/${item.file}`;
  const accent = CAT_COLOR[item.category] ?? '#94a3b8';
  const isPdf = item.type === 'pdf';

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${hov ? accent + '55' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.22s ease',
        boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${accent}22` : '0 4px 16px rgba(0,0,0,0.3)',
        position: 'relative',
      }}>

      {/* Thumbnail */}
      <div style={{ height: 150, position: 'relative', overflow: 'hidden', background: 'rgba(2,5,8,0.8)' }}>
        {isPdf ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, rgba(0,0,0,0.6), rgba(15,23,42,0.9))`,
            fontSize: 40, opacity: 0.5 }}>📄</div>
        ) : item.type === 'video' ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 18, marginLeft: 3 }}>▶</span>
            </div>
          </div>
        ) : (
          <img src={url} alt={item.title} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: hov ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.4s ease',
              filter: `brightness(${hov ? 0.8 : 0.65})` }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
          opacity: hov ? 1 : 0.4 }} />
        {/* Type badge */}
        <div style={{ position: 'absolute', top: 8, right: 8,
          fontSize: 8, fontWeight: 800, color: accent, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: 'rgba(0,0,0,0.6)',
          padding: '2px 6px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
          {item.type}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#e2eaf4', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4 }}>
          {item.title.length > 52 ? item.title.slice(0, 50) + '…' : item.title}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accent,
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {item.category}
          </span>
          {isPdf && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 9, fontWeight: 800, color: accent, textDecoration: 'none',
                background: `${accent}18`, border: `1px solid ${accent}33`,
                padding: '2px 7px', borderRadius: 4 }}>
              Open ↗
            </a>
          )}
        </div>
      </div>

      {/* Download on hover */}
      {hov && (
        <a href={url} download={item.file} onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 116, left: 8,
            background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '3px 8px',
            color: '#e2eaf4', fontSize: 9, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
          <Download size={9}/> Save
        </a>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MediaSection() {
  const [items,    setItems]    = useState<MediaItem[]>([]);
  const [typeF,    setTypeF]    = useState<string>('all');
  const [catF,     setCatF]     = useState<string>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}media/manifest.json`)
      .then(r => r.json())
      .then((data: MediaItem[]) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() =>
    Array.from(new Set(items.map(i => i.category))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let list = items;
    if (typeF !== 'all') list = list.filter(i => i.type === typeF);
    if (catF  !== 'all') list = list.filter(i => i.category === catF);
    return list;
  }, [items, typeF, catF]);

  // Lightbox only navigates through non-PDF items in filtered list
  const lbItems = useMemo(() => filtered.filter(i => i.type !== 'pdf'), [filtered]);

  const navigate = useCallback((d: number) =>
    setLightbox(prev => prev === null ? null : (prev + d + lbItems.length) % lbItems.length),
    [lbItems.length]
  );

  const typeCounts = useMemo(() => ({
    all: items.length,
    image: items.filter(i => i.type === 'image').length,
    video: items.filter(i => i.type === 'video').length,
    pdf:   items.filter(i => i.type === 'pdf').length,
  }), [items]);

  const PILL_COLOR: Record<string, string> = {
    all: '#94a3b8', image: '#00f5ff', video: '#00ff88', pdf: '#ff6b35',
  };

  return (
    <section style={{ padding: '28px 24px', minHeight: '100vh', color: 'white' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#e2eaf4', margin: 0,
          letterSpacing: '0.02em' }}>Media Gallery</h2>
        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
          Road network imagery, field videos &amp; annual monitoring reports ·{' '}
          <span style={{ color: '#00f5ff', fontWeight: 700 }}>{typeCounts.image}</span> images ·{' '}
          <span style={{ color: '#00ff88', fontWeight: 700 }}>{typeCounts.video}</span> videos ·{' '}
          <span style={{ color: '#ff6b35', fontWeight: 700 }}>{typeCounts.pdf}</span> PDFs
        </p>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', 'image', 'video', 'pdf'] as const).map(t => {
          const active = typeF === t;
          const col = PILL_COLOR[t];
          return (
            <button key={t} onClick={() => setTypeF(t)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              background: active ? `${col}20` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? col : 'rgba(255,255,255,0.1)'}`,
              color: active ? col : 'rgba(148,163,184,0.55)',
              textTransform: 'capitalize',
            }}>
              {t === 'all' ? `All (${typeCounts.all})` : `${t.charAt(0).toUpperCase() + t.slice(1)}s (${typeCounts[t]})`}
            </button>
          );
        })}
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setCatF('all')} style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 800,
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
          background: catF === 'all' ? 'rgba(148,163,184,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${catF === 'all' ? '#94a3b8' : 'rgba(255,255,255,0.08)'}`,
          color: catF === 'all' ? '#94a3b8' : 'rgba(148,163,184,0.45)',
        }}>All categories</button>
        {categories.map(cat => {
          const active = catF === cat;
          const col = CAT_COLOR[cat] ?? '#94a3b8';
          const cnt = items.filter(i => i.category === cat).length;
          return (
            <button key={cat} onClick={() => setCatF(cat)} style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 800,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              background: active ? `${col}18` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? col : 'rgba(255,255,255,0.08)'}`,
              color: active ? col : 'rgba(148,163,184,0.45)',
            }}>{cat} ({cnt})</button>
          );
        })}
      </div>

      {/* Grid */}
      {loading && (
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>Loading media…</p>
      )}
      {!loading && filtered.length === 0 && (
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>
          No items match the selected filter.
        </p>
      )}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 14,
        }}>
          {filtered.map((item, i) => {
            const lbIdx = lbItems.indexOf(item);
            return (
              <MediaCard
                key={item.id}
                item={item}
                onOpen={() => {
                  if (item.type === 'pdf') {
                    window.open(`${import.meta.env.BASE_URL}media/${item.file}`, '_blank');
                  } else {
                    setLightbox(lbIdx >= 0 ? lbIdx : 0);
                  }
                }}
              />
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && lbItems.length > 0 && (
        <Lightbox
          items={lbItems}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={navigate}
        />
      )}
    </section>
  );
}
