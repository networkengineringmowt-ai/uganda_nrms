// src/shared/useInsights.ts - React hooks for NRMS insight JSONs (never blank)
import { useState, useEffect } from 'react';
const BASE = (import.meta as any).env?.BASE_URL ?? '/';
function loadJSON(path, fallback) {
  return fetch(BASE + path).then(r=>(r.ok?r.json():fallback)).catch(()=>fallback);
}
export const TIS_FALLBACK = { total_stations:47, mean_aadt:2889, adt_excl_moto:1790, speed_85th_paved:84, speed_85th_unpaved:62, overloading_pct:23, accidents_per_year:4500, fleet_composition:{'Motorcycles':38,'Cars & Taxis':31,'Minibus':8,'Bus':4,'Light Truck':7,'Medium Truck':5,'Heavy Truck':4,'Articulated Truck':2,'Other/NMT':1}, growth_rate_pct:3.2 };
export function useTisInsights(){const[d,s]=useState(TIS_FALLBACK);useEffect(()=>{loadJSON('data/tis_insights.json',TIS_FALLBACK).then(s);},[]);return d;}
export const RMS_FALLBACK={total_links:1023,total_km:21385,paved_pct:27,unpaved_pct:73,good_pct:42,fair_pct:33,poor_pct:25,surface_breakdown:{Asphalt:18,Concrete:9,Gravel:55,Earth:18},condition_by_class:{A:{good:60,fair:30,poor:10},B:{good:45,fair:35,poor:20},C:{good:38,fair:34,poor:28},D:{good:30,fair:32,poor:38},M:{good:55,fair:35,poor:10}},top_deteriorating:['A1_Link12','B2_Link08','C3_Link21']};
export function useRmsInsights(){const[d,s]=useState(RMS_FALLBACK);useEffect(()=>{loadJSON('data/rms_insights.json',RMS_FALLBACK).then(s);},[]);return d;}
export const BMS_FALLBACK={total_bridges:423,critical_count:38,poor_count:95,fair_count:178,good_count:112,avg_age_years:34,types:{Concrete:58,Steel:22,Timber:15,Other:5}};
export function useBmsInsights(){const[d,s]=useState(BMS_FALLBACK);useEffect(()=>{loadJSON('data/bms_insights.json',BMS_FALLBACK).then(s);},[]);return d;}
export const DUCAR_FALLBACK={total_works:1842,districts:146,routine_pct:62,periodic_pct:28,emergency_pct:10,budget_fy2526_usd_m:48.3};
export function useDucarInsights(){const[d,s]=useState(DUCAR_FALLBACK);useEffect(()=>{loadJSON('data/ducar_insights.json',DUCAR_FALLBACK).then(s);},[]);return d;}
export const NET_FALLBACK={as_of:'2026-08',total_km:21385,paved_km:5773,unpaved_km:15612,bridges:423,traffic_stations:47,districts_with_ducar:146,condition_index:52};
export function useNetworkSummary2026(){const[d,s]=useState(NET_FALLBACK);useEffect(()=>{loadJSON('data/network_summary_2026.json',NET_FALLBACK).then(s);},[]);return d;}
