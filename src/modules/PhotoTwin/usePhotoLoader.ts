/**
 * Discovers real photos for a structure by probing /s-photos/ (served from S:\PHOTOS by Vite middleware).
 *
 * Naming conventions observed in S:\PHOTOS:
 *   B001_08_01.JPG      → bridge B001, 2008, photo 01 (leading zero, uppercase ext)
 *   B001_09_1.JPG       → bridge B001, 2009, photo 1  (no leading zero)
 *   B001_17_01.jpg.JPG  → 2017 scans have double extension
 *   B001_22_01.jpg      → 2022 scans use lowercase .jpg
 *   C001_17_01.JPG      → culvert C001
 *   X100_08_01.JPG      → special structure X100
 *   SQ-01/...           → square culvert
 *
 * Strategy: generate ~200 candidate URLs per structure, render hidden <img> elements,
 * collect onLoad successes, deduplicate, sort by year → photo number.
 */

import { useState, useEffect, useRef } from 'react';

export interface BridgePhoto {
  url:      string;
  year:     string;  // full e.g. "2008"
  yearCode: string;  // short e.g. "08"
  index:    number;
  filename: string;
}

// ─── Derive folder name from structure ID ─────────────────────────────────────
function folderFromId(structureId: string): string | null {
  // BRG-B001 → B001   CUL-C001 → C001   BRG-X100 → X100   BRG-B00Z → B00Z
  const m = structureId.match(/^(?:BRG|CUL)-(.+)$/);
  if (m) return m[1];
  // bare IDs like B001
  if (/^[A-Z]/.test(structureId)) return structureId;
  return null;
}

// ─── Generate candidate URLs ──────────────────────────────────────────────────
const YEAR_CODES = ['08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24'];
const MAX_PHOTOS_PER_YEAR = 12; // typical field survey captures ≤ 12 per visit

function generateCandidates(folder: string): { url: string; year: string; yearCode: string; index: number; filename: string }[] {
  const candidates: { url: string; year: string; yearCode: string; index: number; filename: string }[] = [];

  for (const yc of YEAR_CODES) {
    const fullYear = `20${yc}`;
    for (let n = 1; n <= MAX_PHOTOS_PER_YEAR; n++) {
      const pad  = n.toString().padStart(2, '0');
      const bare = n.toString();

      // Pattern 1: B001_08_01.JPG  (uppercase, padded)
      candidates.push({ url: `/s-photos/${folder}/${folder}_${yc}_${pad}.JPG`, year: fullYear, yearCode: yc, index: n, filename: `${folder}_${yc}_${pad}.JPG` });
      // Pattern 2: B001_09_1.JPG   (uppercase, no-pad)
      candidates.push({ url: `/s-photos/${folder}/${folder}_${yc}_${bare}.JPG`, year: fullYear, yearCode: yc, index: n, filename: `${folder}_${yc}_${bare}.JPG` });
      // Pattern 3: B001_17_01.jpg.JPG (double ext)
      candidates.push({ url: `/s-photos/${folder}/${folder}_${yc}_${pad}.jpg.JPG`, year: fullYear, yearCode: yc, index: n, filename: `${folder}_${yc}_${pad}.jpg.JPG` });
      // Pattern 4: B001_22_01.jpg  (lowercase)
      candidates.push({ url: `/s-photos/${folder}/${folder}_${yc}_${pad}.jpg`, year: fullYear, yearCode: yc, index: n, filename: `${folder}_${yc}_${pad}.jpg` });
      // Pattern 5: B001_22_1.jpg   (lowercase, no-pad)
      candidates.push({ url: `/s-photos/${folder}/${folder}_${yc}_${bare}.jpg`, year: fullYear, yearCode: yc, index: n, filename: `${folder}_${yc}_${bare}.jpg` });
    }
  }

  return candidates;
}

// ─── Cache: avoid re-probing the same bridge ─────────────────────────────────
const photoCache = new Map<string, BridgePhoto[]>();

// ─── Photo manifest (deployed site) ──────────────────────────────────────────
// public/data/photo_manifest.json lists the thumbnails shipped under
// public/s-photos/ (built by scripts/build_photo_album.py from S:\PHOTOS).
// Manifest-first means exact files everywhere — including GitHub Pages,
// where the old S:-drive probing always 404ed.
type ManifestEntry = { f: string; y: number };
let manifestPromise: Promise<Record<string, ManifestEntry[]> | null> | null = null;
function loadManifest(): Promise<Record<string, ManifestEntry[]> | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${import.meta.env.BASE_URL}data/photo_manifest.json`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return manifestPromise;
}
function photosFromManifest(folder: string, entries: ManifestEntry[]): BridgePhoto[] {
  return entries.map((e, i) => ({
    url: `${import.meta.env.BASE_URL}s-photos/${folder}/${e.f}`,
    year: String(e.y), yearCode: String(e.y).slice(2),
    index: i + 1, filename: e.f,
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePhotoLoader(structureId: string | null): {
  photos:  BridgePhoto[];
  loading: boolean;
  byYear:  Record<string, BridgePhoto[]>;
  folder:  string | null;
} {
  const [photos,  setPhotos]  = useState<BridgePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const probeCount = useRef(0);

  const folder = structureId ? folderFromId(structureId) : null;

  useEffect(() => {
    if (!folder) { setPhotos([]); return; }

    // Return from cache immediately — no loading state needed
    if (photoCache.has(folder)) {
      setPhotos(photoCache.get(folder)!);
      return;
    }

    // Debounce: wait 250ms before launching probe storm (handles rapid list scrolling)
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      // Manifest-first: exact shipped thumbnails (works on the deployed site)
      setLoading(true);
      void loadManifest().then(manifest => {
        if (cancelled) return;
        const entries = manifest?.[folder];
        if (entries?.length) {
          const ph = photosFromManifest(folder, entries);
          photoCache.set(folder, ph);
          setPhotos(ph);
          setLoading(false);
          return;
        }
        runProbe();
      });

      function runProbe() {
      if (cancelled) return;

      setLoading(true);
      setPhotos([]);
      probeCount.current = 0;

      const candidates = generateCandidates(folder);
      const found: BridgePhoto[] = [];
      let completed = 0;
      const seen = new Set<string>();
      const imgs: HTMLImageElement[] = [];

      const finish = () => {
        if (cancelled) return;
        completed++;
        if (completed === candidates.length) {
          const deduped: BridgePhoto[] = [];
          const seenKey = new Set<string>();
          found
            .sort((a, b) => a.year.localeCompare(b.year) || a.index - b.index)
            .forEach(p => {
              const k = `${p.year}-${p.index}`;
              if (!seenKey.has(k)) { seenKey.add(k); deduped.push(p); }
            });
          photoCache.set(folder, deduped);
          setPhotos(deduped);
          setLoading(false);
        }
      };

      candidates.forEach(c => {
        if (seen.has(c.url)) { finish(); return; }
        seen.add(c.url);

        const img = new Image();
        imgs.push(img);
        img.onload = () => {
          found.push({ url: c.url, year: c.year, yearCode: c.yearCode, index: c.index, filename: c.filename });
          finish();
        };
        img.onerror = finish;
        img.src = c.url;
      });
      } // end runProbe
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [folder]);

  const byYear: Record<string, BridgePhoto[]> = {};
  photos.forEach(p => {
    if (!byYear[p.year]) byYear[p.year] = [];
    byYear[p.year].push(p);
  });

  return { photos, loading, byYear, folder };
}
