const i=[{id:"Central",label:"Central Region",headquarters:"Kampala",roadKm:4760},{id:"Northern",label:"Northern Region",headquarters:"Gulu",roadKm:4595},{id:"Eastern",label:"Eastern Region",headquarters:"Mbale",roadKm:2775},{id:"Western",label:"Western Region",headquarters:"Fort Portal",roadKm:2768},{id:"Southern",label:"Southern Region",headquarters:"Mbarara",roadKm:3546},{id:"North Eastern",label:"North Eastern Region",headquarters:"Moroto",roadKm:2716}],s=[{patterns:["what is link","tell me about link","show link","link id","road link","section"],queryId:"LINK_DETAIL",description:"Full history and attributes for a specific link_id",extractLinkId:e=>{const a=e.match(/([A-Z]\d{1,3}[A-Z]?\d*_Link\d{2,})/i)??e.match(/([A-Z]\d{1,3}[A-Z]?\d*Int\d+_S\d+)/i);return a?a[1].toUpperCase():null}},{patterns:["all links on road","links on","sections of","road a0","road b","entire road","road c"],queryId:"ROAD_ALL_LINKS",description:"All links on a named road",extractRoadNumber:e=>{const a=e.match(/\b([A-Z]\d{1,3}[A-Z]?\d*)\b/i);return a?a[1].toUpperCase().replace(/^([A-Z])(\d{1,2})$/,(t,n,r)=>`${n}${r.padStart(3,"0")}`):null}},{patterns:["chainage","km marker","km post","location referencing","at km","from km","to km"],queryId:"CHAINAGE_LOOKUP",description:"Find link by chainage location on a road"},{patterns:["bridge on","culvert on","structures on","bridge at link","crossing at"],queryId:"LINK_STRUCTURES",description:"Bridges and culverts on a specific road link"}],d=`
Uganda Department of National Roads uses a LINEAR REFERENCING SYSTEM (LRS) where each road is divided into
LINKS — management sections defined by nodes (intersections, towns, boundaries).

LINK ID FORMAT: [Road Number]_Link[Sequence Number]
  • A001_Link01 = First link on the A001 Kampala-Gulu highway
  • B101_Link02 = Second link on road B101
  • C261_Link01 = First link on road C261 (Matte-Sekanyonyi)
  • M3_Link01   = First link on M3 (Kampala Northern Bypass)

ROAD NUMBER FORMAT: Class letter + 3-digit zero-padded number
  • A001, A002, A003 ... (NOT the old "A1", "A2" shorthand)
  • B100, B101, B102 ...
  • C003, C150, C261 ...
  • M3, M20 (municipal roads may use shorter codes)

ROAD CLASSIFICATION:
  • Class A: International/trunk roads — 2,615 km (e.g. A001, A002, A004)
  • Class B: Secondary national roads — 2,863 km (e.g. B100, B101, B150)
  • Class C: Regional roads — 15,537 km (e.g. C003, C150, C261)
  • Class M: Municipal/urban classified roads — 145 km

CHAINAGE: Distance measured in km from the road datum (start of road).
  • Stored as decimal km in fields chainage_f and chainage_t
  • Example: chainage_f = 0.0, chainage_t = 32.27 means link spans 0 to 32.27 km

Total network: 21,160 km (mapped) across 1,013 links — Data: DNR GIS Jun 2025

To look up a specific road or link, say:
  "Show me link A001_Link01"
  "What is the condition of road A002?"
  "List all links in Northern Region"
`;export{d as L,i as M,s as a};
