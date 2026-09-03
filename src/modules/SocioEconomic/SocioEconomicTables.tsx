/**
 * SocioEconomicTables - Socio-Economic Analysis "Exhaustive Tables" tab.
 * Recovered from the pre-deletion SocioEconomicSection.tsx (commit 5f049e5^):
 * the district-level and sector registries that were originally spread across
 * the Resources / Energy / Agriculture / Environment / Demographics / Economy
 * internal tabs, restacked here as one continuous scroll of data tables (no
 * internal tab-switcher - each registry is just another card in the scroll).
 */
import { DASH_C } from '../../shared/dashboardKit';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { PercentCell, NULL_ZERO_STYLE } from '../../shared/tableFormatting';

const CARD: React.CSSProperties = {
  background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: '12px 14px', marginBottom: 14,
};

function Hdr({ children, accent = DASH_C.cyan }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 800, color: accent, letterSpacing: '0.08em',
      textTransform: 'uppercase', marginBottom: 10,
    }}>{children}</div>
  );
}

// ─── Conditional formatting for the short enum/status columns that recur
// across these registries (Status, UNESCO WHS, etc.) - vivid traffic-light
// colouring, same hexes as aadtHeat/percentageColor in tableFormatting.tsx.
const STATUS_COLORS: Record<string, string> = {
  operational: DASH_C.green, active: DASH_C.green, yes: DASH_C.green,
  commissioning: DASH_C.yellow, developing: DASH_C.yellow, 'under dev': DASH_C.yellow,
  'under construction': DASH_C.yellow, 'early production': DASH_C.yellow,
  planned: DASH_C.blue, exploration: DASH_C.blue, 'exploration complete': DASH_C.blue,
  appraisal: DASH_C.blue, explored: DASH_C.blue,
  standby: DASH_C.orange, mothballed: '#ff3366', no: DASH_C.gray,
};
function statusColor(text: string): string | undefined {
  return STATUS_COLORS[text.trim().toLowerCase()];
}
function StatusCell({ value }: { value: string }) {
  const color = statusColor(value);
  if (!color) return <>{value}</>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
      background: `${color}1f`, border: `1px solid ${color}55`, color, fontSize: 10, fontWeight: 800,
    }}>{value}</span>
  );
}
function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const NUMERIC_RE = /^-?[\d,]+(\.\d+)?$/;
const PERCENT_RE = /^-?\d+(\.\d+)?%$/;

/**
 * Registry - builds an STColumn set from plain cols[]/rows[][] matrices and
 * renders through the shared SortableFilterableTable (sortable headers with
 * visible sort arrows, live search/filter, CSV+Excel export) so every
 * registry on this tab gets the platform's standard table behaviour without
 * hand-rolling markup per table.
 */
function Registry({ title, cols, rows, accent }: { title: string; cols: string[]; rows: (string | number)[][]; accent?: string }) {
  const columns: STColumn<Record<string, string | number>>[] = cols.map((label, i) => {
    const key = `c${i}`;
    const raw = rows.map(r => String(r[i] ?? '').trim());
    const isPercent = raw.every(v => v === '' || PERCENT_RE.test(v));
    const isNumeric = !isPercent && raw.every(v => v === '' || NUMERIC_RE.test(v));
    return {
      key, label, numeric: isPercent || isNumeric,
      render: (row) => {
        const v = row[key];
        if (v === '' || v == null) return <span style={NULL_ZERO_STYLE}>No data</span>;
        if (isPercent) return <PercentCell value={v as number} />;
        if (isNumeric) return <>{(v as number).toLocaleString()}</>;
        return <StatusCell value={String(v)} />;
      },
    };
  });

  const dataRows = rows.map(row => Object.fromEntries(cols.map((_, i) => {
    const key = `c${i}`;
    const cell = String(row[i] ?? '').trim();
    if (PERCENT_RE.test(cell)) return [key, parseFloat(cell)];
    if (NUMERIC_RE.test(cell)) return [key, parseFloat(cell.replace(/,/g, ''))];
    return [key, row[i]];
  })));

  return (
    <div style={CARD}>
      <Hdr accent={accent}>{title} ({rows.length.toLocaleString()} records)</Hdr>
      <SortableFilterableTable columns={columns} rows={dataRows} accent={accent ?? DASH_C.cyan} exportName={kebab(title)} />
    </div>
  );
}

// ─── Static datasets (source: UBOS / MEMD / NEMA / UIA curated figures) ────
const MINERALS: (string | number)[][] = [
  ['Kilembe Mine', 'Copper/Cobalt', 'Explored', 'Kasese', '4.5Mt ore', '1.8% Cu', 320],
  ['Muko Iron Ore', 'Iron Ore', 'Explored', 'Kabale', '162Mt', '42% Fe', 2100],
  ['Sukulu Phosphates', 'Phosphate', 'Active', 'Tororo', '230Mt', '12% P2O5', 890],
  ['Busia Gold', 'Gold', 'Active', 'Busia', '1.2Mt ore', '3.5g/t Au', 180],
  ['Hima Limestone', 'Limestone', 'Active', 'Kasese', '500Mt', 'CaCO3 90%', 95],
  ['Lake Katwe Salt', 'Salt/Evaporites', 'Active', 'Kasese', 'Perennial', 'NaCl 85%', 12],
  ['Moroto Marble', 'Marble', 'Explored', 'Moroto', '80Mt', 'High purity', 55],
  ['Tororo Rock Phosphate', 'Phosphate', 'Active', 'Tororo', '280Mt', '14% P2O5', 1100],
  ['Kitgum Vermiculite', 'Vermiculite', 'Explored', 'Kitgum', '2.5Mt', 'High grade', 35],
  ['Mubende Gold', 'Gold', 'Active', 'Mubende', '0.8Mt ore', '2.8g/t Au', 120],
  ['Kigezi Wolfram', 'Tungsten', 'Explored', 'Kabale', '0.5Mt', '0.3% WO3', 28],
  ['Rwimi Beryllium', 'Beryllium', 'Explored', 'Kabarole', 'Artisanal', 'Moderate', 15],
  ['Tiira Nickel', 'Nickel', 'Explored', 'Tororo', '4Mt ore', '0.6% Ni', 85],
  ['Kabale Tin', 'Tin/Tantalum', 'Active', 'Kabale', 'Artisanal', 'Mixed', 22],
  ['Luwero Cobalt', 'Cobalt', 'Explored', 'Luwero', '2Mt ore', '0.3% Co', 65],
  ['Agago Rare Earths', 'REE', 'Explored', 'Agago', '1.8Mt ore', '1.2% TREO', 210],
  ['Buhweju Diatomite', 'Diatomite', 'Explored', 'Buhweju', '15Mt', 'High silica', 18],
  ['Namanve Clay', 'Clay/Ceramics', 'Active', 'Mukono', 'Abundant', 'Ceramic grade', 8],
  ['Kibuku Graphite', 'Graphite', 'Explored', 'Kibuku', '3Mt ore', '8% Cg', 42],
  ['Karamoja Gemstones', 'Gemstones', 'Active', 'Moroto', 'Artisanal', 'Mixed', 30],
];

const OIL_BLOCKS: (string | number)[][] = [
  ['EA1 Kingfisher', 'CNOOC Uganda', 'Development', 'Kingfisher', '600M bbl recoverable', '2025'],
  ['EA2 Tilenga', 'TotalEnergies EP Uganda', 'Development', 'Tilenga (Jobi-Rii + 5 fields)', '1.2B bbl', '2026'],
  ['EA1A Jobi-Rii', 'TotalEnergies EP Uganda', 'Development', 'Jobi-Rii', '200M bbl', '2026'],
  ['EA3A Mputa', 'TotalEnergies EP Uganda', 'Appraisal', 'Mputa-Waraga', '100M bbl', '2027'],
  ['EA3B Avivi', 'TotalEnergies EP Uganda', 'Exploration', 'Avivi', 'TBD', '2028+'],
  ['EACOP Terminal', 'EACOP Ltd Consortium', 'Under Construction', 'Pipeline to Tanga', 'N/A - export corridor', '2026'],
];

const POWER_PLANTS: (string | number)[][] = [
  ['Karuma HPP', 'Hydro', 600, 'Commissioning', 'Victoria Nile', 2024],
  ['Bujagali HPP', 'Hydro', 250, 'Operational', 'Victoria Nile', 2012],
  ['Nalubaale HPP', 'Hydro', 180, 'Operational', 'Victoria Nile', 1954],
  ['Kiira HPP', 'Hydro', 200, 'Operational', 'Victoria Nile', 2003],
  ['Isimba HPP', 'Hydro', 183, 'Operational', 'Victoria Nile', 2019],
  ['Muzizi HPP', 'Hydro', 44, 'Under Dev', 'Muzizi', 2025],
  ['Kikagati HPP', 'Hydro', 16, 'Operational', 'Kagera', 2020],
  ['Nyagak HPP', 'Hydro', 3.5, 'Operational', 'Nyagak', 2012],
  ['Agago HPP', 'Hydro', 84, 'Under Dev', 'Agago', 2026],
  ['Kiba HPP', 'Hydro', 380, 'Planned', 'Muzizi', 2028],
  ['Kabale Solar Farm', 'Solar', 10, 'Operational', 'N/A', 2021],
  ['Soroti Solar Farm', 'Solar', 10, 'Operational', 'N/A', 2021],
  ['Tororo Thermal', 'Thermal', 50, 'Operational', 'N/A', 2007],
  ['Namanve Thermal', 'Thermal', 50, 'Standby', 'N/A', 2009],
  ['Ayago HPP', 'Hydro', 840, 'Planned', 'Victoria Nile', 2030],
];

const AGRI_ZONES: (string | number)[][] = [
  ['Buganda Basin', 'Banana, Coffee, Maize, Beans', '3,800,000', '9,800,000', 1200, 'Ferralsol/Nitisol', 'Coffee (Robusta)', '820,000'],
  ['Ankole Highlands', 'Coffee, Sorghum, Maize, Dairy', '1,800,000', '3,200,000', 1050, 'Andosol/Nitisol', 'Coffee (Arabica)', '380,000'],
  ['Nile Valley North', 'Sesame, Maize, Millet, Cotton', '2,200,000', '3,800,000', 980, 'Vertisol/Arenosol', 'Sesame/Sunflower', '420,000'],
  ['Karamoja Arid Zone', 'Sorghum, Millet, Livestock', '1,900,000', '620,000', 480, 'Lixisol/Arenosol', 'Livestock', '95,000'],
  ['Busoga Sugarbelt', 'Sugarcane, Maize, Beans, Cassava', '1,400,000', '5,800,000', 1150, 'Ferralsol/Gleysol', 'Sugar/Fish', '310,000'],
  ['Rwenzori Slopes', 'Tea, Vanilla, Arabica Coffee, Banana', '800,000', '1,200,000', 1400, 'Andosol/Histosol', 'Tea/Vanilla', '190,000'],
  ['West Nile Corridor', 'Tobacco, Maize, Cassava, Sesame', '1,100,000', '2,100,000', 1100, 'Ferralsol/Luvisol', 'Tobacco/Sesame', '240,000'],
  ['Teso Cotton Belt', 'Cotton, Millet, Sorghum, Groundnuts', '1,600,000', '2,900,000', 1050, 'Vertisol/Ferralsol', 'Cotton/Sunflower', '350,000'],
];

const PROTECTED_AREAS: (string | number)[][] = [
  ['Murchison Falls NP', 'National Park', '3,840', 'Elephant, Lion, Buffalo, Nile Croc, Shoebill', 1952, 'No'],
  ['Queen Elizabeth NP', 'National Park', '1,978', 'Hippo, Elephant, Tree-climbing Lion, Chimpanzee', 1954, 'No'],
  ['Kibale NP', 'National Park', '766', 'Chimpanzee (1,500+), Red Colobus, Forest Elephant', 1993, 'No'],
  ['Bwindi Impenetrable NP', 'National Park', '321', "Mountain Gorilla (459+), L'Hoest Monkey", 1991, 'Yes'],
  ['Kidepo Valley NP', 'National Park', '1,442', 'Lion, Cheetah, Ostrich, Eland, Rotschild Giraffe', 1962, 'No'],
  ['Lake Mburo NP', 'National Park', '370', 'Zebra, Hippo, Impala, Eland, Waterbuck', 1983, 'No'],
  ['Mt Rwenzori NP', 'National Park', '996', "Chimpanzee, L'Hoest, Forest Elephant, Afropavo", 1991, 'Yes'],
  ['Mgahinga Gorilla NP', 'National Park', '33.7', 'Mountain Gorilla, Golden Monkey', 1991, 'No'],
  ['Semuliki NP', 'National Park', '220', 'Chimpanzee, Pygmy Hippo, Forest species', 1993, 'No'],
  ['Mt Elgon NP', 'National Park', '1,279', 'Elephant, Buffalo, Forest Hog, Sitatunga', 1993, 'No'],
];

const WETLANDS: (string | number)[][] = [
  ['Lake Victoria (UGA portion)', 'Lake', '31,093', 83, 'Kenya/Tanzania'],
  ['Lake Albert', 'Lake', '5,347', 51, 'DRC'],
  ['Lake Edward', 'Lake', '2,325', 112, 'DRC'],
  ['Lake Kyoga', 'Lake/Swamp', '2,700', 6, 'Uganda only'],
  ['Lake George', 'Lake', '250', 3, 'Uganda only'],
  ['Lutembe Wetland', 'Ramsar Wetland', '11', 2, 'Uganda only'],
  ['Mabamba Wetland', 'Ramsar Wetland', '64', 2, 'Uganda only'],
  ['Opeta-Bisina Wetland', 'Ramsar Wetland', '900', 3, 'Uganda only'],
];

const ECONOMIC_ZONES: (string | number)[][] = [
  ['Namanve Industrial & Business Park', 'Industrial Park', 'Operational', '1,000', 850, '28,000', 'Manufacturing, Logistics, Assembly'],
  ['Kampala Industrial & Business Park (KIBP)', 'Industrial Park', 'Operational', '120', 320, '8,500', 'Light manufacturing, Garments, Food processing'],
  ['Jinja Industrial & Business Park', 'Industrial Park', 'Operational', '250', 180, '6,200', 'Steel, Textiles, Chemicals, Cement'],
  ['Luzira Free Zone', 'Free Zone', 'Operational', '40', 95, '2,400', 'Warehousing, Re-export, Electronics assembly'],
  ['Kasese Industrial Park', 'Industrial Park', 'Operational', '80', 45, '1,800', 'Copper processing, Mining services, Cement'],
  ['Gulu Industrial Park', 'Industrial Park', 'Developing', '65', 38, '1,200', 'Agro-processing, Food, Textiles'],
  ['Mbale Industrial Park', 'Industrial Park', 'Developing', '75', 42, '1,500', 'Coffee processing, Textiles, Packaging'],
  ['Buikwe SEZ', 'SEZ', 'Developing', '200', 120, '4,500', 'Sugar, Textiles, Chemical inputs'],
  ['Masindi Petroleum Zone', 'SEZ', 'Planned', '150', 240, '3,200', 'Oil services, Refinery inputs, Gas processing'],
];

const DISTRICTS: (string | number)[][] = [
  ['Kampala', 'Central', '3,600,000', '189', '19048', 12400, '8%', '90%'],
  ['Wakiso', 'Central', '2,200,000', '2,807', '784', 3200, '12%', '87%'],
  ['Mukono', 'Central', '950,000', '4,958', '192', 850, '21%', '82%'],
  ['Mbarara', 'Western', '700,000', '1,846', '379', 680, '24%', '78%'],
  ['Gulu', 'Northern', '580,000', '3,446', '168', 420, '41%', '70%'],
  ['Lira', 'Northern', '620,000', '2,988', '208', 380, '45%', '67%'],
  ['Mbale', 'Eastern', '530,000', '249', '2129', 350, '32%', '74%'],
  ['Jinja', 'Eastern', '490,000', '2,534', '193', 620, '26%', '80%'],
  ['Kasese', 'Western', '890,000', '3,044', '292', 310, '38%', '68%'],
  ['Arua', 'West Nile', '980,000', '3,439', '285', 290, '52%', '62%'],
  ['Soroti', 'Eastern', '430,000', '4,229', '102', 220, '39%', '71%'],
  ['Kabale', 'Western', '550,000', '1,937', '284', 280, '30%', '76%'],
  ['Hoima', 'Western', '580,000', '3,609', '161', 890, '29%', '73%'],
  ['Tororo', 'Eastern', '520,000', '1,783', '292', 340, '28%', '75%'],
  ['Moroto', 'Karamoja', '210,000', '3,571', '59', 82, '78%', '38%'],
  ['Kitgum', 'Northern', '370,000', '7,200', '51', 140, '55%', '58%'],
  ['Iganga', 'Eastern', '680,000', '1,731', '393', 260, '35%', '72%'],
  ['Fort Portal', 'Western', '410,000', '1,593', '257', 310, '27%', '77%'],
  ['Masaka', 'Central', '760,000', '2,721', '279', 490, '22%', '83%'],
  ['Nebbi', 'West Nile', '460,000', '2,067', '223', 165, '49%', '60%'],
];

export default function SocioEconomicTables() {
  return (
    <div>
      <Registry title="Mineral Deposits - Complete Registry" accent={DASH_C.yellow}
        cols={['Name', 'Type', 'Status', 'District', 'Reserves', 'Grade', 'Est. Value (USD M)']}
        rows={MINERALS} />
      <Registry title="Oil &amp; Gas Blocks - Albertine Rift" accent={DASH_C.blue}
        cols={['Block Name', 'Operator', 'Status', 'Field(s)', 'Reserves', 'First Oil/Gas']}
        rows={OIL_BLOCKS} />
      <Registry title="Power Plants - Complete Registry" accent={DASH_C.cyan}
        cols={['Plant Name', 'Type', 'Capacity (MW)', 'Status', 'River/Source', 'Year Commissioned']}
        rows={POWER_PLANTS} />
      <Registry title="Agricultural Zones - Detailed Production Data" accent={DASH_C.green}
        cols={['Zone', 'Main Crops', 'Area (ha)', 'Production (t/yr)', 'Rainfall (mm)', 'Soil Type', 'Export Crop', 'Farm Households']}
        rows={AGRI_ZONES} />
      <Registry title="Protected Areas - Complete Registry" accent={DASH_C.teal}
        cols={['Name', 'Type', 'Area (km²)', 'Key Wildlife', 'Established', 'UNESCO WHS']}
        rows={PROTECTED_AREAS} />
      <Registry title="Major Water Bodies &amp; Wetlands" accent={DASH_C.cyan}
        cols={['Name', 'Type', 'Area (km²)', 'Max Depth (m)', 'Shared With']}
        rows={WETLANDS} />
      <Registry title="Economic Zones &amp; Industrial Parks - Full Registry" accent={DASH_C.orange}
        cols={['Name', 'Type', 'Status', 'Area (ha)', 'Investment (USD M)', 'Jobs Created', 'Key Sectors']}
        rows={ECONOMIC_ZONES} />
      <Registry title="District-Level Demographics - Sample Districts" accent={DASH_C.purple}
        cols={['District', 'Region', 'Population', 'Area (km²)', 'Density/km²', 'GDP (USD M)', 'Poverty %', 'Literacy %']}
        rows={DISTRICTS} />
    </div>
  );
}
