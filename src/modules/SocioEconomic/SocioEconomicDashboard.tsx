/**
 * SocioEconomicDashboard - Socio-Economic Analysis "Dashboard" tab.
 * Recovered from the pre-deletion SocioEconomicSection.tsx (commit 5f049e5^),
 * re-ported onto the shared dashboardKit design system so it fits the platform's
 * "one uniform, continuously scrolling pane of charts" rule: prose + KPI tiles +
 * charts only, no internal tab-switcher, no <table> elements, and no chart ever
 * plots latitude/longitude - those live only on the Interactive Map tab.
 */
import {
  DASH_C, KpiStrip, StatMini, SectionHdr, ChartGrid, ChartBox,
  DonutChart, BarV, BarH, LineMulti,
} from '../../shared/dashboardKit';

// ─── Economic composition (Overview) ──────────────────────────────────────
// Matches GDP_BY_SECTOR below (same UBOS GDP-by-sector split) so the Overview
// donut and the Economy section donut never disagree on Uganda's GDP composition.
const GDP_SECTORS = [
  { name: 'Services', value: 46, color: DASH_C.blue },
  { name: 'Agriculture', value: 24, color: DASH_C.green },
  { name: 'Industry', value: 27, color: DASH_C.purple },
  { name: 'Taxes', value: 3, color: DASH_C.yellow },
];
// All 6 UBOS statistical regions (matches the Regional Demographic
// Vulnerability table in the Deep Analytics tab and ACCESS_BY_REG below -
// West Nile/Karamoja poverty figures are carried over from that table
// rather than a separate, possibly-inconsistent estimate).
const REGIONS = [
  { region: 'Central', poverty: 14, elec: 42 },
  { region: 'Eastern', poverty: 26, elec: 18 },
  { region: 'Northern', poverty: 32, elec: 14 },
  { region: 'Western', poverty: 19, elec: 22 },
  { region: 'West Nile', poverty: 50, elec: 18 },
  { region: 'Karamoja', poverty: 77, elec: 9 },
];

// ─── Energy ────────────────────────────────────────────────────────────────
const ENERGY_MIX = [
  { name: 'Hydropower', value: 94, color: DASH_C.cyan },
  { name: 'Solar', value: 3, color: DASH_C.yellow },
  { name: 'Biomass', value: 2, color: DASH_C.green },
  { name: 'Thermal', value: 1, color: DASH_C.orange },
];
const CAP_TREND = [
  { yr: '2015', mw: 856 }, { yr: '2016', mw: 862 }, { yr: '2017', mw: 1006 }, { yr: '2018', mw: 1010 },
  { yr: '2019', mw: 1804 }, { yr: '2020', mw: 1820 }, { yr: '2021', mw: 1960 }, { yr: '2022', mw: 2050 },
  { yr: '2023', mw: 2180 }, { yr: '2024', mw: 2320 },
];
const ACCESS_BY_REG = [
  { name: 'Central', pct: 72 }, { name: 'Eastern', pct: 38 }, { name: 'Western', pct: 32 },
  { name: 'Northern', pct: 21 }, { name: 'West Nile', pct: 18 }, { name: 'Karamoja', pct: 9 },
];

// ─── Agriculture ───────────────────────────────────────────────────────────
const CROP_REV = [
  { name: 'Coffee', rev: 610 }, { name: 'Gold', rev: 1140 }, { name: 'Fish', rev: 420 }, { name: 'Maize', rev: 380 },
  { name: 'Tea', rev: 210 }, { name: 'Sugar', rev: 195 }, { name: 'Vanilla', rev: 145 }, { name: 'Cotton', rev: 95 },
];
const AGRI_GDP = [
  { yr: '2019', v: 22.8 }, { yr: '2020', v: 23.5 }, { yr: '2021', v: 23.9 }, { yr: '2022', v: 24.1 },
  { yr: '2023', v: 24.4 }, { yr: '2024', v: 24.0 },
];
const CROP_PROD = [
  { crop: 'Plantain', prod: 9800 }, { crop: 'Cassava', prod: 7400 }, { crop: 'Maize', prod: 3800 },
  { crop: 'Sweet Pot.', prod: 3200 }, { crop: 'Sugarcane', prod: 2900 }, { crop: 'Beans', prod: 1800 },
  { crop: 'Coffee', prod: 960 }, { crop: 'Millet', prod: 820 },
];

// ─── Environment ───────────────────────────────────────────────────────────
const PA_TYPES = [
  { name: 'National Parks', value: 10, color: DASH_C.green },
  { name: 'Forest Reserves', value: 506, color: DASH_C.teal },
  { name: 'Game Reserves', value: 12, color: DASH_C.cyan },
  { name: 'Wildlife Sanctuaries', value: 9, color: DASH_C.purple },
  { name: 'Ramsar Wetlands', value: 12, color: DASH_C.blue },
];
const FOREST_TREND = [
  { yr: '2000', v: 4.9 }, { yr: '2005', v: 4.3 }, { yr: '2010', v: 3.8 }, { yr: '2015', v: 3.4 },
  { yr: '2020', v: 3.2 }, { yr: '2024', v: 3.1 },
];
const WATER_AREA = [
  { name: 'L. Victoria', v: 31093 }, { name: 'L. Albert', v: 5347 }, { name: 'L. Kyoga', v: 2700 },
  { name: 'L. Edward', v: 2325 }, { name: 'Others', v: 2763 },
];

// ─── Education & Health ──────────────────────────────────────────────────
const EDU_LVL = [
  { name: 'Pre-Primary', v: 12842 }, { name: 'Primary', v: 17000 }, { name: 'Secondary', v: 3500 },
  { name: 'Vocational', v: 780 }, { name: 'University', v: 53 },
];
const HEALTH_TREND = [
  { yr: '2005', imr: 70 }, { yr: '2010', imr: 60 }, { yr: '2015', imr: 54 }, { yr: '2019', imr: 45 },
  { yr: '2022', imr: 41 }, { yr: '2024', imr: 37 },
];
const HEALTH_FAC = [
  { type: 'HC II', n: 2640 }, { type: 'HC III', n: 1250 }, { type: 'HC IV', n: 190 },
  { type: 'Gen. Hospital', n: 82 }, { type: 'Regional Hosp.', n: 14 }, { type: 'Natl. Referral', n: 4 },
];

// ─── Demographics ──────────────────────────────────────────────────────────
const POP_BY_AGE = [
  { age: '0-4', v: 17.2 }, { age: '5-14', v: 26.1 }, { age: '15-24', v: 21.3 }, { age: '25-34', v: 14.9 },
  { age: '35-44', v: 9.8 }, { age: '45-54', v: 5.9 }, { age: '55-64', v: 3.2 }, { age: '65+', v: 1.6 },
];
const POP_GROWTH = [
  { yr: '2000', v: 23.3 }, { yr: '2005', v: 27.8 }, { yr: '2010', v: 33.8 }, { yr: '2015', v: 39.6 },
  { yr: '2020', v: 45.7 }, { yr: '2024', v: 49.9 }, { yr: '2030', v: 56.8 }, { yr: '2035', v: 65.0 }, { yr: '2040', v: 74.2 },
];
const URBAN_RURAL = [
  { name: 'Rural', value: 76, color: DASH_C.green },
  { name: 'Urban', value: 24, color: DASH_C.cyan },
];
const ETHNIC_GROUPS = [
  { name: 'Baganda', v: 16.5 }, { name: 'Banyankole', v: 9.6 }, { name: 'Basoga', v: 8.8 }, { name: 'Bakiga', v: 7.1 },
  { name: 'Iteso', v: 7.0 }, { name: 'Langi', v: 6.3 }, { name: 'Acholi', v: 4.7 }, { name: 'Others', v: 40.0 },
];

// ─── Economy ───────────────────────────────────────────────────────────────
const GDP_BY_SECTOR = [
  { name: 'Services', value: 46, color: DASH_C.blue },
  { name: 'Industry', value: 27, color: DASH_C.purple },
  { name: 'Agriculture', value: 24, color: DASH_C.green },
  { name: 'Taxes', value: 3, color: DASH_C.yellow },
];
const EXPORTS_TREND = [
  { yr: '2018', v: 3.3 }, { yr: '2019', v: 3.6 }, { yr: '2020', v: 3.2 }, { yr: '2021', v: 3.9 },
  { yr: '2022', v: 4.5 }, { yr: '2023', v: 5.1 }, { yr: '2024', v: 5.8 },
];
const EZ_INVEST = [
  { name: 'Namanve', invest: 850 }, { name: 'KIBP', invest: 320 }, { name: 'Jinja', invest: 180 },
  { name: 'Luzira Free Z.', invest: 95 }, { name: 'Kasese', invest: 45 }, { name: 'Gulu', invest: 38 },
  { name: 'Mbale', invest: 42 }, { name: 'Mbarara', invest: 35 },
];

// ─── Natural Resources ───────────────────────────────────────────────────
const MINERAL_TYPES = [
  { name: 'Phosphate', value: 3, color: DASH_C.yellow }, { name: 'Iron Ore', value: 2, color: DASH_C.gray },
  { name: 'Gold', value: 3, color: DASH_C.orange }, { name: 'Copper/Co', value: 1, color: DASH_C.pink },
  { name: 'Limestone', value: 2, color: DASH_C.teal }, { name: 'REE', value: 1, color: DASH_C.purple },
  { name: 'Nickel', value: 1, color: DASH_C.cyan }, { name: 'Other', value: 7, color: DASH_C.green },
];
const RESERVES_VAL = [
  { name: 'Phosphate', v: 1990 }, { name: 'Iron Ore', v: 2100 }, { name: 'Gold', v: 300 },
  { name: 'Copper', v: 320 }, { name: 'REE', v: 210 }, { name: 'Nickel', v: 85 },
];
const MINERAL_EXPORT_TREND = [
  { yr: '2019', v: 680 }, { yr: '2020', v: 520 }, { yr: '2021', v: 890 }, { yr: '2022', v: 1240 },
  { yr: '2023', v: 1380 }, { yr: '2024', v: 1520 },
];

export default function SocioEconomicDashboard() {
  return (
    <div>
      <div style={{
        background: 'rgba(100, 210, 255,0.04)', border: '1px solid rgba(100, 210, 255,0.14)',
        borderRadius: 12, padding: '14px 18px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#e2e8f0', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Uganda - Socio-Economic Analysis
        </div>
        <p style={{ fontSize: 11.5, color: 'rgba(148,163,184,0.8)', lineHeight: 1.65, margin: 0 }}>
          Population, land use, agriculture, energy, environment, and economic indicators across Uganda's 146 districts,
          aligned with NDPIV goals and World Bank / UBOS frameworks - read against the classified road network to inform
          investment prioritisation.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {['UBOS 2024', 'NDPIV Aligned', '146 Districts', 'World Bank Data', 'UNHS Sourced'].map(b => (
            <span key={b} style={{
              fontSize: 9, fontWeight: 700, color: '#64d2ff', background: 'rgba(100, 210, 255,0.07)',
              border: '1px solid rgba(100, 210, 255,0.18)', borderRadius: 20, padding: '2px 8px',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>{b}</span>
          ))}
        </div>
      </div>

      <KpiStrip>
        <StatMini value="48.5M" label="Population" color={DASH_C.cyan} />
        <StatMini value="5.8%" label="GDP Growth" color={DASH_C.green} />
        <StatMini value="21.4%" label="Poverty Rate" color={DASH_C.pink} />
        <StatMini value="76%" label="Rural Population" color={DASH_C.yellow} />
        <StatMini value="146" label="Admin Districts" color={DASH_C.blue} />
        <StatMini value="48.4%" label="Electrification" color={DASH_C.purple} />
        <StatMini value="USD 38.1B" label="GDP (2024)" color={DASH_C.green} />
        <StatMini value="79.0%" label="Literacy Rate" color={DASH_C.cyan} />
        <StatMini value="67.4 yr" label="Life Expectancy" color={DASH_C.teal} />
        <StatMini value="24.0%" label="Agricultural GDP" color={DASH_C.orange} />
        <StatMini value="3.1M ha" label="Forest Cover" color={DASH_C.pink} />
        <StatMini value="USD 1.52B" label="Mineral Exports" color={DASH_C.yellow} />
      </KpiStrip>

      <SectionHdr accent={DASH_C.cyan}>Economic Composition</SectionHdr>
      <ChartGrid cols="2">
        <ChartBox title="GDP Sector Share" subtitle="% of GDP" accent={DASH_C.blue} height={220}>
          <DonutChart data={GDP_SECTORS} />
        </ChartBox>
        <ChartBox title="Regional Development Indicators" subtitle="poverty vs electrification, %" accent={DASH_C.purple} height={220}>
          <BarH data={REGIONS} yKey="region" series={[
            { key: 'poverty', name: 'Poverty %', color: DASH_C.pink },
            { key: 'elec', name: 'Electrification %', color: DASH_C.purple },
          ]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.blue}>Energy</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Generation Mix" subtitle="% installed capacity" accent={DASH_C.cyan} height={200}>
          <DonutChart data={ENERGY_MIX} />
        </ChartBox>
        <ChartBox title="Installed Capacity Trend" subtitle="MW, 2015–2024" accent={DASH_C.blue} height={200}>
          <LineMulti data={CAP_TREND} xKey="yr" series={[{ key: 'mw', name: 'Capacity (MW)', color: DASH_C.blue }]} area />
        </ChartBox>
        <ChartBox title="Electrification Rate by Region" subtitle="%" accent={DASH_C.green} height={200}>
          <BarV data={ACCESS_BY_REG} xKey="name" series={[{ key: 'pct', name: 'Access %', color: DASH_C.green }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.green}>Agriculture</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Top Export Commodity Revenue" subtitle="USD M" accent={DASH_C.green} height={200}>
          <BarV data={CROP_REV} xKey="name" series={[{ key: 'rev', name: 'Revenue (USD M)', color: DASH_C.green }]} />
        </ChartBox>
        <ChartBox title="Agricultural GDP Share Trend" subtitle="%, 2019–2024" accent={DASH_C.teal} height={200}>
          <LineMulti data={AGRI_GDP} xKey="yr" series={[{ key: 'v', name: 'Agri GDP %', color: DASH_C.teal }]} unit="%" area />
        </ChartBox>
        <ChartBox title="Top Crops by Production" subtitle="000 tonnes" accent={DASH_C.yellow} height={200}>
          <BarH data={CROP_PROD} yKey="crop" series={[{ key: 'prod', name: 'Production (000t)', color: DASH_C.yellow }]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.teal}>Environment</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Protected Areas by Category" subtitle="site count" accent={DASH_C.green} height={200}>
          <DonutChart data={PA_TYPES} />
        </ChartBox>
        <ChartBox title="Forest Cover Loss" subtitle="M ha, 2000–2024" accent={DASH_C.pink} height={200}>
          <LineMulti data={FOREST_TREND} xKey="yr" series={[{ key: 'v', name: 'Forest Cover (M ha)', color: DASH_C.pink }]} area />
        </ChartBox>
        <ChartBox title="Major Lakes Area" subtitle="km²" accent={DASH_C.cyan} height={200}>
          <BarV data={WATER_AREA} xKey="name" series={[{ key: 'v', name: 'Area (km²)', color: DASH_C.cyan }]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.purple}>Education &amp; Health</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Schools by Education Level" subtitle="count" accent={DASH_C.blue} height={200}>
          <BarV data={EDU_LVL} xKey="name" series={[{ key: 'v', name: 'Schools', color: DASH_C.blue }]} />
        </ChartBox>
        <ChartBox title="Infant Mortality Rate Trend" subtitle="per 1,000 live births" accent={DASH_C.pink} height={200}>
          <LineMulti data={HEALTH_TREND} xKey="yr" series={[{ key: 'imr', name: 'IMR', color: DASH_C.pink }]} area />
        </ChartBox>
        <ChartBox title="Health Facilities by Level" subtitle="count" accent={DASH_C.cyan} height={200}>
          <BarH data={HEALTH_FAC} yKey="type" series={[{ key: 'n', name: 'Facilities', color: DASH_C.cyan }]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.pink}>Demographics</SectionHdr>
      <ChartGrid cols="4">
        <ChartBox title="Population by Age Group" subtitle="%" accent={DASH_C.blue} height={200}>
          <BarV data={POP_BY_AGE} xKey="age" series={[{ key: 'v', name: 'Share %', color: DASH_C.blue }]} unit="%" />
        </ChartBox>
        <ChartBox title="Urban vs Rural Split" subtitle="%" accent={DASH_C.green} height={200}>
          <DonutChart data={URBAN_RURAL} />
        </ChartBox>
        <ChartBox title="Population Growth Projection" subtitle="millions, 2000–2040" accent={DASH_C.purple} height={200}>
          <LineMulti data={POP_GROWTH} xKey="yr" series={[{ key: 'v', name: 'Population (M)', color: DASH_C.purple }]} area />
        </ChartBox>
        <ChartBox title="Largest Ethnic Groups" subtitle="% of population" accent={DASH_C.orange} height={200}>
          <BarV data={ETHNIC_GROUPS} xKey="name" series={[{ key: 'v', name: 'Share %', color: DASH_C.orange }]} unit="%" />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.orange}>Economy</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="GDP by Sector" subtitle="%" accent={DASH_C.blue} height={200}>
          <DonutChart data={GDP_BY_SECTOR} />
        </ChartBox>
        <ChartBox title="Total Export Revenue Trend" subtitle="USD B, 2018–2024" accent={DASH_C.green} height={200}>
          <LineMulti data={EXPORTS_TREND} xKey="yr" series={[{ key: 'v', name: 'Exports (USD B)', color: DASH_C.green }]} area />
        </ChartBox>
        <ChartBox title="Top Economic Zones - Investment" subtitle="USD M" accent={DASH_C.orange} height={200}>
          <BarV data={EZ_INVEST} xKey="name" series={[{ key: 'invest', name: 'Investment (USD M)', color: DASH_C.orange }]} />
        </ChartBox>
      </ChartGrid>

      <SectionHdr accent={DASH_C.yellow}>Natural Resources</SectionHdr>
      <ChartGrid cols="3">
        <ChartBox title="Mineral Types" subtitle="documented sites" accent={DASH_C.yellow} height={200}>
          <DonutChart data={MINERAL_TYPES} />
        </ChartBox>
        <ChartBox title="Estimated Reserves Value" subtitle="USD M" accent={DASH_C.gray} height={200}>
          <BarV data={RESERVES_VAL} xKey="name" series={[{ key: 'v', name: 'Value (USD M)', color: DASH_C.yellow }]} />
        </ChartBox>
        <ChartBox title="Mineral Export Revenue Trend" subtitle="USD M, 2019–2024" accent={DASH_C.orange} height={200}>
          <LineMulti data={MINERAL_EXPORT_TREND} xKey="yr" series={[{ key: 'v', name: 'Exports (USD M)', color: DASH_C.orange }]} area />
        </ChartBox>
      </ChartGrid>
    </div>
  );
}
