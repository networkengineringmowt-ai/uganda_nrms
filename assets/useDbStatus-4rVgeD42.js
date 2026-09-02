import{c as o}from"./createLucideIcon-GDS-gBuX.js";import{r}from"./vendor-recharts-8XnV5sKi.js";import{s as d}from"./supabase-CA2jDV0z.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=o("Route",[["circle",{cx:"6",cy:"19",r:"3",key:"1kj8tv"}],["path",{d:"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15",key:"1d8sl"}],["circle",{cx:"18",cy:"5",r:"3",key:"gq8acd"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=o("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]),b={tabId:"dashboard",tabLabel:"Dashboard",sectionId:""};let a=b;const n=new Set;function S(t){a.tabId===t.tabId&&a.tabLabel===t.tabLabel&&a.sectionId===t.sectionId||(a=t,n.forEach(e=>e()))}function T(){return a}function E(t){return n.add(t),()=>n.delete(t)}const l=6e4,f=6e3;async function h(){try{const t=d.from("road_links").select("link_id",{count:"exact",head:!0}),e=new Promise(c=>setTimeout(()=>c(null),f));return await Promise.race([t,e])!==null}catch{return!1}}function v(){const[t,e]=r.useState("checking");return r.useEffect(()=>{let s=!1;const c=async()=>{const i=await h();s||e(i?"connected":"offline")};c();const u=setInterval(c,l);return()=>{s=!0,clearInterval(u)}},[]),t}export{p as R,y as X,S as a,T as g,E as s,v as u};
