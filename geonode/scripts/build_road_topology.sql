-- ════════════════════════════════════════════════════════════════════════════
-- build_road_topology.sql — pgRouting network topology for the Uganda road network
-- Run inside the PostGIS container after national_road_network is imported:
--   docker compose exec -T db psql -U geonode -d geonode -f - < scripts/build_road_topology.sql
-- (or: docker compose cp + psql -f). Builds a noded, routable graph.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- 1) Noded copy of the network (split lines at intersections so routing works).
DROP TABLE IF EXISTS road_network_noded CASCADE;
CREATE TABLE road_network_noded AS
SELECT (ST_Dump(ST_Node(ST_Collect(wkb_geometry)))).geom AS geom
FROM national_road_network;

ALTER TABLE road_network_noded ADD COLUMN id BIGSERIAL PRIMARY KEY;
ALTER TABLE road_network_noded ADD COLUMN source INTEGER;
ALTER TABLE road_network_noded ADD COLUMN target INTEGER;
-- cost = length in metres (geography); reverse_cost equal (undirected network)
ALTER TABLE road_network_noded ADD COLUMN cost DOUBLE PRECISION;
ALTER TABLE road_network_noded ADD COLUMN reverse_cost DOUBLE PRECISION;
UPDATE road_network_noded
   SET cost = ST_Length(geom::geography),
       reverse_cost = ST_Length(geom::geography);

CREATE INDEX road_network_noded_geom_idx ON road_network_noded USING GIST (geom);

-- 2) Build the vertices table + wire source/target (tolerance ~1 m in degrees).
SELECT pgr_createTopology('road_network_noded', 0.00001, 'geom', 'id');

CREATE INDEX IF NOT EXISTS road_network_noded_source_idx ON road_network_noded (source);
CREATE INDEX IF NOT EXISTS road_network_noded_target_idx ON road_network_noded (target);

-- 3) Sanity report
SELECT 'edges'    AS item, count(*) FROM road_network_noded
UNION ALL
SELECT 'vertices' AS item, count(*) FROM road_network_vertices_pgr;

-- 4) (Optional) analyse graph connectivity for dead-ends / isolated components
-- SELECT pgr_analyzeGraph('road_network_noded', 0.00001, 'geom', 'id');
