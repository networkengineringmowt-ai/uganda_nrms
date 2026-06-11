/**
 * RoadsAPI — typed data-access layer over the canonical Supabase client.
 * This is the reconciled successor of the legacy root-level `supabaseClient.js`
 * (G:/…/supabaseClient.js, now deprecated): same query surface, but importing
 * the single shared client from src/lib/supabase.ts so the app has exactly one
 * Supabase integration.
 *
 * All methods return [] / null on error so callers can fall back to bundled JSON.
 */
import { supabase } from './supabase';

export interface StationRow {
  station_id: string; station_name: string | null; link_id: string | null;
  link_name: string | null; latitude: number | null; longitude: number | null;
  station_type: string | null; district: string | null; region: string | null;
  tcs_no: number | null;
}

export const RoadsAPI = {
  /** All traffic count stations (traffic_count_stations — 298 rows live). */
  async getStations(): Promise<StationRow[]> {
    const { data, error } = await supabase.from('traffic_count_stations').select('*').order('tcs_no');
    return error ? [] : (data as StationRow[]);
  },

  /** AADT projections for one link across all years. */
  async getLinkTrend(linkId: string) {
    const { data, error } = await supabase.from('aadt_projections')
      .select('year,aadt').eq('link_id', linkId).order('year');
    return error ? [] : data;
  },

  /** All link projections for a given year (map snapshot). */
  async getProjectionsByYear(year: number) {
    const { data, error } = await supabase.from('aadt_projections')
      .select('link_id,link_name,region,aadt').eq('year', year);
    return error ? [] : data;
  },

  /** Monthly ATC AADT for one station. */
  async getAtcStation(stationId: string) {
    const { data, error } = await supabase.from('atc_monthly_summary')
      .select('year,month,aadt').eq('station_id', stationId).order('year').order('month');
    return error ? [] : data;
  },

  /** TIS counts for a link in a survey year. */
  async getTisByLinkYear(linkId: string, surveyYear: number) {
    const { data, error } = await supabase.from('tis_counts')
      .select('*').eq('link_id', linkId).eq('survey_year', surveyYear);
    return error ? [] : data;
  },

  /** Per-link latest condition incl. VCI + official rating band. */
  async getLinkCondition(linkId: string) {
    const { data, error } = await supabase.from('road_link_condition')
      .select('survey_year,iri,rut_mm,cracking,pci,vci,vci_rating')
      .eq('link_id', linkId).order('survey_year', { ascending: false }).limit(1);
    return error || !data?.length ? null : data[0];
  },

  /** MOWT bridges development projects (Apr 2026 status report). */
  async getBridgeWorks() {
    const { data, error } = await supabase.from('bridge_works').select('*').order('id');
    return error ? [] : data;
  },
};
