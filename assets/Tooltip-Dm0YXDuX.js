import{c as p,r as f}from"./index.nrms-DjWbTlri.js";import{c as u,l as y,a as T}from"./leaflet-BZuhjBta.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=p("Pause",[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=p("Play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]]),v=u(function(i,t){const e=new y.Tooltip(i,t.overlayContainer);return T(e,t)},function(i,t,{position:e},a){f.useEffect(function(){const o=t.overlayContainer;if(o==null)return;const{instance:n}=i,r=l=>{l.tooltip===n&&(e!=null&&n.setLatLng(e),n.update(),a(!0))},c=l=>{l.tooltip===n&&a(!1)};return o.on({tooltipopen:r,tooltipclose:c}),o.bindTooltip(n),function(){o.off({tooltipopen:r,tooltipclose:c}),o._map!=null&&o.unbindTooltip()}},[i,t,a,e])});export{g as P,v as T,x as a};
