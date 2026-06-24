# Uganda NRMS — GIS Enterprise (GeoNode from source, ArcGIS-Enterprise parity)

This is the **enterprise** build: GeoNode 4.4.x **built from source** (not the
pre-built image) and extended to mimic the ArcGIS Enterprise feature set for the
Uganda National Road Network. For the simpler pre-built quickstart, see
[`README.md`](README.md).

> ⚠️ Authored and build-validated as configuration; it has **not** been run here
> (no Docker in the authoring environment). First run + verification is on a
> machine with Docker Desktop. Treat the interactive builders (symbology editor,
> Web-AppBuilder composer) as **foundations**, not finished UIs — see *Status*.

## What's included (ArcGIS Enterprise → GeoNode mapping)

| ArcGIS Enterprise capability | This implementation | File |
|---|---|---|
| ArcGIS Server REST (FeatureService/MapServer query) | REST emulation over PostGIS | `custom/uganda_roads/views/arcgis_rest.py` |
| Network analysis (routing, service areas) | pgRouting shortest-path + isochrone | `custom/uganda_roads/views/routing.py`, `scripts/build_road_topology.sql` |
| Print Service (layout templates) | MapFish print proxy + MoWT letterhead | `custom/uganda_roads/views/print_service.py`, `geoserver/printing/config.yaml` |
| Portal for ArcGIS (home) | MoWT neon-dark portal landing | `custom/templates/geonode/index.html`, `custom/static/css/mowt-portal.css` |
| Living Atlas / basemaps | Dark/OSM/Satellite/Topo switcher (MapStore) | configured in `.env` map client |
| Enterprise auth (LDAP/SSO) | `django-auth-ldap` + `social-auth` (Google) | `Dockerfile.custom` deps + settings |
| WPS / WMTS / CSW | enabled on GeoServer | `docker-compose.source.yml` env flags |
| Uganda CRS (UTM 36N / EPSG:32636) | declared for layer groups | set in GeoServer on import |

URL routing for the custom endpoints: `custom/uganda_roads/urls.py` (include it
from the GeoNode root urlconf, or it's auto-included via the `uganda_roads` app).

## Prerequisites
- Docker Desktop (WSL2), ≥ 10 GB RAM, ~25 GB disk.
- The `G:` data repository for `scripts/import_layers.sh`.

## 1. Clone GeoNode source
```bash
cd geonode
git clone -b 4.4.x https://github.com/GeoNode/geonode.git geonode-source
```

## 2. Configure + build from source
```bash
# regenerate SECRET_KEY + change passwords in .env first
docker compose -f docker-compose.source.yml up -d --build
docker compose -f docker-compose.source.yml logs -f geonode
```
The `geonode` image builds via `Dockerfile.custom` (GDAL, pgRouting client, Node,
the uganda_roads app). The DB image is **pgRouting/PostGIS** so routing works.

## 3. Superuser + import layers
```bash
docker compose -f docker-compose.source.yml exec geonode python manage.py createsuperuser
bash scripts/import_layers.sh
```

## 4. Build the routing topology (pgRouting)
After `national_road_network` is imported:
```bash
docker compose -f docker-compose.source.yml exec -T db \
  psql -U geonode -d geonode -f /scripts/build_road_topology.sql
```
Then test:
```
GET /routing/nearest-node/?lon=32.58&lat=0.31
GET /routing/shortest-path/?from=<vid>&to=<vid>&f=geojson
GET /routing/isochrone/?lon=32.58&lat=0.31&minutes=30
```

## 5. ArcGIS-compatible clients
Point ArcGIS Pro / ArcGIS JS API / QGIS "ArcGIS REST Connector" at:
```
http://localhost/arcgis/rest/services/uganda_nrms/MapServer
```
Query example:
```
/arcgis/rest/services/uganda_nrms/MapServer/0/query?where=road_class='A'&outFields=*&f=geojson
```

## 6. Printing
```
GET  /print/capabilities.json            → layouts (A4/A3 × portrait/landscape)
POST /print/report.pdf  (MapFish spec)   → MoWT-letterhead PDF
```

## 7. GeoServer enterprise services (enabled in compose)
- **WPS** — spatial analysis processes (`/geoserver/ows?service=WPS&request=GetCapabilities`)
- **WMTS** via GeoWebCache — fast cached tiles (`/geoserver/gwc/service/wmts`)
- **CSW** — ISO 19115 catalogue (`/geoserver/csw`)
- Set the **Uganda CRS** EPSG:32636 (UTM 36N) as the declared SRS on projected layers, and create layer groups: *Uganda Road Network*, *Condition Survey*, *Bridge Inventory*.

## Status — what's complete vs foundational
**Complete & functional (pending a Docker run):**
- ArcGIS REST query emulation (where/outFields/geometry/returnCountOnly/geojson) with SQL-injection guards.
- pgRouting topology SQL + shortest-path / nearest-node / isochrone endpoints.
- MapFish print proxy + 4 MoWT letterhead layouts.
- Neon-dark MoWT portal home with live counts via the REST API.
- Build-from-source Dockerfile + compose (pgRouting DB, WPS/WMTS/CSW enabled, LDAP/SSO deps).

**Foundational (scaffolded, needs further build):**
- **Web-AppBuilder composer** (drag-drop widget canvas) — not built; MapStore's
  existing map composer covers most of this in the interim.
- **Visual SLD symbology editor UI** — the 4 SLD styles + GeoServer REST style API
  are in place; the in-browser classification editor UI is not yet built.
- LDAP/SSO are dependency-installed but need your directory/OAuth credentials wired in settings.

These foundational items are genuinely large frontend builds; flag which you want
prioritised and they can be implemented incrementally.
