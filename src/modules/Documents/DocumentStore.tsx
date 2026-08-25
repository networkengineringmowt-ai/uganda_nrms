import { useState, useMemo, useRef } from 'react';
import {
  FolderOpen, Search, Plus, FileText, Image, File, Download, Upload,
  X, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Tag,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { BridgeDocument, DocumentCategory } from '../../types';
import { formatDate } from '../../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { useVirtualRows } from '../../shared/useVirtualRows';
import { useSortableColumns, sortRows, SortArrow, type ColumnType } from '../../shared/useSortableColumns';

const DOC_ROW_HEIGHT = 56;
const DOC_COLUMN_COUNT = 7;

type DocSortKey = 'name' | 'structureName' | 'category' | 'wordCount' | 'fileSize' | 'uploadedAt';
const DOC_SORT_TYPES: Partial<Record<DocSortKey, ColumnType>> = {
  wordCount: 'numeric', uploadedAt: 'date',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Design Drawing':     <FileText size={14} className="text-blue-400" />,
  'Inspection Report':  <FileText size={14} className="text-green-400" />,
  'As-Built':           <FileText size={14} className="text-cyan-400" />,
  'Contract':           <FileText size={14} className="text-purple-400" />,
  'Photo':              <Image size={14} className="text-amber-400" />,
  'Maintenance Record': <FileText size={14} className="text-orange-400" />,
  'Environmental':      <FileText size={14} className="text-emerald-400" />,
  'Other':              <File size={14} className="text-slate-400" />,
};

const CATEGORIES: DocumentCategory[] = [
  'Design Drawing', 'Inspection Report', 'As-Built', 'Contract',
  'Photo', 'Maintenance Record', 'Environmental', 'Other',
];

// ─── PDF.js loader (CDN, no bundler dependency) ────────────────────────────────
// Loaded lazily on first extraction so the app shell stays light. Cached as a
// module-level promise so repeated uploads reuse the same instance.
let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) { resolve(w.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = w.pdfjsLib;
      if (!lib) { reject(new Error('pdf.js failed to initialize')); return; }
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Could not load pdf.js from CDN'));
    document.head.appendChild(script);
  });
  return pdfjsPromise;
}

const PAGE_BREAK = '\f';

async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
    pages.push(text);
  }
  return { text: pages.join(PAGE_BREAK), pageCount: doc.numPages };
}

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','was','with','this','that',
  'from','have','has','been','were','will','shall','when','where','which','while',
  'their','they','them','than','then','into','onto','also','such','each','any','per',
  'these','those','its','his','her','our','your','out','over','under','more','most',
  'other','some','only','own','same','both','after','before','above','below','off',
  'again','further','once','here','there','who','whom','how','what','why','being',
  'does','did','doing','because','until','through','during','between','about','against',
]);

function topKeywords(text: string, n = 8): string[] {
  const freq = new Map<string, number>();
  const words = text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentStore() {
  const { state, dispatch } = useBMS();
  const { documents, structures } = state;

  const [query,     setQuery]     = useState('');
  const [catFilter, setCat]       = useState<'all' | DocumentCategory>('all');
  const [typeFilter, setType]     = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [reading,  setReading]    = useState<BridgeDocument | null>(null);
  const [processing, setProcessing] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const fileTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.fileType));
    return ['all', ...Array.from(types).sort()];
  }, [documents]);

  const filtered = useMemo(() => {
    let list = [...documents].sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
    if (catFilter !== 'all') list = list.filter(d => d.category === catFilter);
    if (typeFilter !== 'all') list = list.filter(d => d.fileType === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.structureName.toLowerCase().includes(q) ||
        (d.extractedText || '').toLowerCase().includes(q) ||
        (d.keywords || []).some(k => k.includes(q)),
      );
    }
    return list;
  }, [documents, catFilter, typeFilter, query]);

  const { sortKey: docSortKey, sortDir: docSortDir, cycleSort: cycleDocSort } = useSortableColumns<DocSortKey>();
  const sortedDocs = useMemo(() => sortRows(
    filtered, docSortKey, docSortDir, docSortKey ? (DOC_SORT_TYPES[docSortKey] ?? 'text') : 'text',
    (row, key) => key === 'wordCount' ? (row.wordCount ?? 0) : (row as any)[key],
  ), [filtered, docSortKey, docSortDir]);
  const { containerRef, visibleRows, topSpacerHeight, bottomSpacerHeight } =
    useVirtualRows(sortedDocs, { rowHeight: DOC_ROW_HEIGHT });

  const DocTh = ({ label, k }: { label: string; k: DocSortKey }) => (
    <th className="dt-sticky-th px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 cursor-pointer select-none"
      style={{ color: docSortKey === k ? '#ffd23f' : undefined }}
      onClick={() => cycleDocSort(k)}>
      {label}<SortArrow active={docSortKey === k} dir={docSortDir} />
    </th>
  );

  // Stats by category
  const catStats = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
    return counts;
  }, [documents]);

  const extractedCount = useMemo(
    () => documents.filter(d => d.extractionStatus === 'ok' && d.extractedText).length,
    [documents],
  );

  async function handleFiles(fileList: FileList, meta: { structureId: string; category: DocumentCategory; description: string }) {
    const files = Array.from(fileList);
    for (const file of files) {
      setProcessing(prev => [...prev, file.name]);
      const ext = (file.name.split('.').pop() || 'FILE').toUpperCase();
      let extractedText = '';
      let pageCount = 0;
      let extractionStatus: 'ok' | 'unsupported' | 'failed' = 'unsupported';
      try {
        if (ext === 'PDF') {
          const res = await extractPdfText(file);
          extractedText = res.text;
          pageCount = res.pageCount;
          extractionStatus = 'ok';
        } else if (ext === 'TXT' || ext === 'MD' || ext === 'CSV') {
          extractedText = await file.text();
          pageCount = 1;
          extractionStatus = 'ok';
        }
      } catch (e) {
        extractionStatus = 'failed';
        setUploadErrors(prev => [...prev, `${file.name}: could not extract text (${(e as Error).message})`]);
      }
      const wordCount = extractedText.trim()
        ? extractedText.replace(/\f/g, ' ').trim().split(/\s+/).length
        : 0;
      const keywords = extractedText ? topKeywords(extractedText.replace(/\f/g, ' ')) : [];
      const struct = structures.find(s => s.id === meta.structureId);
      const doc: BridgeDocument = {
        id: uuidv4(),
        structureId: meta.structureId,
        structureName: struct?.name || meta.structureId || 'Unassigned',
        name: file.name,
        category: meta.category,
        description: meta.description,
        fileType: ext,
        fileSize: formatBytes(file.size),
        uploadedBy: 'DNR User',
        uploadedAt: new Date().toISOString(),
        version: '1.0',
        extractedText: extractedText || undefined,
        pageCount: pageCount || undefined,
        wordCount: wordCount || undefined,
        keywords: keywords.length ? keywords : undefined,
        extractionStatus,
      };
      dispatch({ type: 'ADD_DOCUMENT', payload: doc });
      setProcessing(prev => prev.filter(n => n !== file.name));
    }
  }

  // Note: this component is now embedded as the "Exhaustive Tables" content
  // for the "documents" section hub (SectionDashboard) - it no longer owns its
  // own tab bar or a nested dashboard view; that lives in the shared hub.
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-blue-400" />
            <h2 className="text-sm font-bold text-slate-100">Document Store</h2>
            <span className="text-xs text-slate-500">
              {documents.length} document{documents.length === 1 ? '' : 's'} · {extractedCount} with searchable text
            </span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <Upload size={13} /> Upload manual / PDF
          </button>
        </div>
        {processing.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
            <Loader2 size={12} className="animate-spin" /> Extracting text: {processing.join(', ')}…
          </div>
        )}
        {uploadErrors.length > 0 && (
          <div className="mt-2 space-y-1">
            {uploadErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle size={12} /> {e}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2 overflow-x-auto border-b border-slate-700/40">
        <button
          onClick={() => setCat('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
            ${catFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
        >
          All ({documents.length})
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCat(cat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
              ${catFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            {CATEGORY_ICONS[cat]} {cat} ({catStats[cat] || 0})
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700/60 bg-slate-900/30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Search titles, descriptions - and the full text inside manuals/PDFs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <select className="bms-input py-1.5 text-xs" value={typeFilter} onChange={e => setType(e.target.value)}>
            {fileTypes.map(t => <option key={t} value={t}>{t === 'all' ? 'All file types' : t}</option>)}
          </select>
          <span className="record-badge ml-auto">{filtered.length.toLocaleString()} of {documents.length.toLocaleString()} shown</span>
        </div>
      </div>

      {/* Document list - fixed-height virtualized scroll container, sticky header */}
      <div className="flex-1 p-4">
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            {documents.length === 0
              ? 'No documents yet - upload a manual or PDF to extract its content for search and reporting.'
              : 'No documents match the current search/filter.'}
          </div>
        ) : (
          <div ref={containerRef} className="dt-scroll">
          <table className="bms-table w-full">
            <thead>
              <tr>
                <DocTh label="Document" k="name" />
                <DocTh label="Structure" k="structureName" />
                <DocTh label="Category" k="category" />
                <DocTh label="Content" k="wordCount" />
                <DocTh label="Size" k="fileSize" />
                <DocTh label="Uploaded" k="uploadedAt" />
                <th className="dt-sticky-th px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 && (
                <tr aria-hidden style={{ height: topSpacerHeight }}><td colSpan={DOC_COLUMN_COUNT} style={{ padding: 0, border: 'none' }} /></tr>
              )}
              {visibleRows.map(doc => (
                <DocRow key={doc.id} doc={doc} query={query} onOpen={() => setReading(doc)} />
              ))}
              {bottomSpacerHeight > 0 && (
                <tr aria-hidden style={{ height: bottomSpacerHeight }}><td colSpan={DOC_COLUMN_COUNT} style={{ padding: 0, border: 'none' }} /></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Upload form */}
      {showForm && (
        <DocUploadForm
          structures={structures.map(s => ({ id: s.id, name: s.name }))}
          onUpload={async (fileList, meta) => { setShowForm(false); await handleFiles(fileList, meta); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Reader panel */}
      {reading && <DocReader doc={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function DocRow({ doc, query, onOpen }: { doc: BridgeDocument; query: string; onOpen: () => void }) {
  const hasContent = doc.extractionStatus === 'ok' && !!doc.extractedText;
  const matchedInContent = !!query.trim() &&
    !doc.name.toLowerCase().includes(query.toLowerCase()) &&
    hasContent && (doc.extractedText || '').toLowerCase().includes(query.toLowerCase());

  function downloadText() {
    if (!doc.extractedText) return;
    const blob = new Blob([doc.extractedText.replace(/\f/g, '\n\n- page break -\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name.replace(/\.[^.]+$/, '') + '_extracted.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <tr className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={hasContent ? onOpen : undefined}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {CATEGORY_ICONS[doc.category] ?? <File size={14} className="text-slate-400" />}
          <div>
            <div className="text-xs font-medium text-slate-200 max-w-[260px] truncate">{doc.name}</div>
            {doc.description && <div className="text-[10px] text-slate-500 max-w-[260px] truncate">{doc.description}</div>}
            {matchedInContent && (
              <div className="text-[10px] text-emerald-400 mt-0.5">match found inside document text</div>
            )}
            {doc.keywords && doc.keywords.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {doc.keywords.slice(0, 4).map(k => (
                  <span key={k} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
                    <Tag size={8} />{k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.structureName}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.category}</td>
      <td className="px-4 py-3 text-xs">
        {doc.extractionStatus === 'ok' ? (
          <span className="text-emerald-400">{doc.pageCount ?? 1} page{(doc.pageCount ?? 1) === 1 ? '' : 's'} · {(doc.wordCount ?? 0).toLocaleString()} words</span>
        ) : doc.extractionStatus === 'failed' ? (
          <span className="text-red-400">extraction failed</span>
        ) : (
          <span className="text-slate-500">{doc.fileType} - not extractable</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{doc.fileSize}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(doc.uploadedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {hasContent && (
            <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="bms-btn-secondary text-[10px] py-1 px-2">
              Read
            </button>
          )}
          {hasContent && (
            <button onClick={(e) => { e.stopPropagation(); downloadText(); }} className="bms-btn-secondary text-[10px] py-1 px-2 flex items-center gap-1">
              <Download size={11} /> .txt
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Reader panel ───────────────────────────────────────────────────────────────
function DocReader({ doc, onClose }: { doc: BridgeDocument; onClose: () => void }) {
  const pages = useMemo(() => (doc.extractedText || '').split(PAGE_BREAK), [doc.extractedText]);
  const [pageIdx, setPageIdx] = useState(0);
  const [search, setSearch] = useState('');

  const pageText = pages[pageIdx] || '';
  const highlighted = useMemo(() => {
    if (!search.trim()) return pageText;
    const re = new RegExp(`(${search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return pageText.split(re);
  }, [pageText, search]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(2,6,15,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div
        style={{ width: 'min(900px, 100%)', height: '85vh', background: '#0b1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-900/60 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-slate-100">{doc.name}</div>
            <div className="text-[10px] text-slate-500">{doc.structureName} · {doc.category} · {doc.pageCount ?? 1} page{(doc.pageCount ?? 1) === 1 ? '' : 's'} · {(doc.wordCount ?? 0).toLocaleString()} words</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-700/40 flex-shrink-0">
          <Search size={13} className="text-slate-500" />
          <input
            className="bms-input py-1 text-xs flex-1"
            placeholder="Search within this document…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {pages.length > 1 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button disabled={pageIdx === 0} onClick={() => setPageIdx(p => Math.max(0, p - 1))} className="bms-btn-secondary text-[10px] py-1 px-2 disabled:opacity-30">
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] text-slate-400 w-16 text-center">Page {pageIdx + 1} / {pages.length}</span>
              <button disabled={pageIdx === pages.length - 1} onClick={() => setPageIdx(p => Math.min(pages.length - 1, p + 1))} className="bms-btn-secondary text-[10px] py-1 px-2 disabled:opacity-30">
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.7, color: '#cbd5e1' }}>
            {Array.isArray(highlighted)
              ? highlighted.map((chunk, i) =>
                  i % 2 === 1
                    ? <mark key={i} style={{ background: '#f59e0b', color: '#020202', padding: '0 2px', borderRadius: 2 }}>{chunk}</mark>
                    : <span key={i}>{chunk}</span>,
                )
              : (pageText || 'No text on this page.')}
          </pre>
        </div>

        {doc.keywords && doc.keywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-5 py-2.5 border-t border-slate-700/40 flex-shrink-0">
            <span className="text-[10px] text-slate-500 mr-1">Key terms:</span>
            {doc.keywords.map(k => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">{k}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload form ──────────────────────────────────────────────────────────────
function DocUploadForm({
  structures, onUpload, onClose,
}: {
  structures: { id: string; name: string }[];
  onUpload: (files: FileList, meta: { structureId: string; category: DocumentCategory; description: string }) => void;
  onClose: () => void;
}) {
  const [structureId, setStructureId] = useState(structures[0]?.id || '');
  const [category, setCategory] = useState<DocumentCategory>('Inspection Report');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function submitFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onUpload(files, { structureId, category, description });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(2,6,15,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div
        style={{ width: 'min(520px, 100%)', background: '#0b1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-900/60">
          <div className="text-sm font-semibold text-slate-100">Upload manual / PDF</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Structure (optional)</label>
            <select className="bms-input text-xs" value={structureId} onChange={e => setStructureId(e.target.value)}>
              <option value="">Unassigned / general reference</option>
              {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Category</label>
            <select className="bms-input text-xs" value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500 block mb-1">Description (optional)</label>
            <input className="bms-input text-xs" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. FWD testing manual, 2024 revision" />
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); submitFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#3b82f6' : 'rgba(148,163,184,0.3)'}`,
              borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(59,130,246,0.08)' : 'transparent',
            }}
          >
            <Upload size={22} className="mx-auto mb-2 text-slate-500" />
            <div className="text-xs text-slate-300 font-medium">Drop PDF or text files here, or click to browse</div>
            <div className="text-[10px] text-slate-500 mt-1">Text is extracted in your browser - nothing is sent to a server. PDF and TXT/MD/CSV are fully searchable; other file types are stored as metadata only.</div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.doc,.docx,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={e => submitFiles(e.target.files)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
