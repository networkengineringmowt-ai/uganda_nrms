# Uganda NRMS — GIS Enterprise (GeoNode)

A fully-branded **GeoNode 4.x** enterprise GIS platform for the Uganda National
Road Network — Django + GeoServer + PostGIS + NGINX + Celery + Redis, serving
**WMS/WFS/WCS** OGC services, a web map editor (MapStore), metadata management,
user/role management and a REST API. It publishes the road-network layers held in
`G:\My Drive\MOWT\Uganda National Road Network Repository` and feeds them into the
React NRMS platform as live WMS layers.

> This folder is configuration + scripts. GeoNode runs in Docker; the React
> platform consumes its WMS endpoint via `VITE_GEOSERVER_WMS_URL`.

## Prerequisites
- **Docker Desktop for Windows** (WSL2 backend) running, ≥ 8 GB RAM allocated.
- ~20 GB free disk for images + PostGIS + GeoServer data.
- Access to the `G:` data repository (for `scripts/import_layers.sh`).

## 1. Configure
Edit **`.env`**. At minimum, before anything non-local:
- Regenerate `SECRET_KEY`:
  `python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"`
- Change `POSTGRES_PASSWORD` and `GEOSERVER_ADMIN_PASSWORD`.

## 2. Start the stack
```bash
cd geonode
docker compose up -d
docker compose logs -f geonode      # wait for "Booting worker" / migrations done
```
First boot takes several minutes (pulls images, runs migrations, initialises
GeoServer). Then:
- **Portal:** http://localhost/
- **GeoServer:** http://localhost/geoserver/  (admin / `GEOSERVER_ADMIN_PASSWORD`)

## 3. Create the Django superuser
```bash
docker compose exec geonode python manage.py createsuperuser
```
Log in at http://localhost/ with that account.

## 4. Import the road-network layers from G:
```bash
bash scripts/import_layers.sh
```
This stages the shapefiles listed in `layers_config.yml` from the G: repository
into `./data`, imports them as GeoNode datasets, publishes the SLD styles to
GeoServer, and stamps metadata (title, abstract, keywords, category =
*transportation*). Review the result at http://localhost/ → **Datasets**, then set
each dataset's default style in **GeoServer → Layers → _layer_ → Publishing**:

| Dataset | Default style |
|---|---|
| National Road Network, District Roads | `road_network` |
| Pavement Condition (IRI) | `road_condition` |
| Bridges, Major Culverts | `bridges` |
| Traffic Count Stations, Weighbridges, Maintenance Stations | `traffic_stations` |

## 5. Connect GeoServer WMS to the React NRMS platform
The React app reads `VITE_GEOSERVER_WMS_URL`. Set it for a build:

- **Local GeoNode:** `VITE_GEOSERVER_WMS_URL=http://localhost/geoserver/ows`
- **Cloud GeoNode:** point it at your deployed host, e.g.
  `https://gis.unra.go.ug/geoserver/ows`

In the React platform (already wired — see `src/shared/geoserver.ts` and the GIS
section), GeoNode layers appear as an optional WMS overlay. When the env var is
unset or GeoNode is offline, the app silently falls back to the bundled
GeoJSON layers — nothing breaks.

Add it as a GitHub Actions repo secret (`VITE_GEOSERVER_WMS_URL`) once GeoNode is
hosted, and the deployed site will use it.

## Branding (already applied)
- `custom/uganda_roads/settings.py` — extends GeoNode, registers the branding app,
  centres the default map on Uganda, sets CORS for the GitHub Pages origins.
- `custom/uganda_roads/templates/site_base.html` — MoWT logo + title header, DNR/UNRA footer.
- `custom/uganda_roads/static/css/mowt-theme.css` — palette matching the React platform.
- `custom/uganda_roads/static/uganda_roads/img/mowt.jpg` — Ministry logo.

## Layout
```
geonode/
├── docker-compose.yml      # full stack (geonode, geoserver, db, nginx, celery, redis)
├── .env                    # all config + MoWT branding vars
├── layers_config.yml       # layer inventory (from the G: shapefiles)
├── styles/                 # GeoServer SLD styles
│   ├── road_network.sld    road_condition.sld  bridges.sld  traffic_stations.sld
├── scripts/import_layers.sh
├── custom/uganda_roads/    # MoWT branding Django app (settings, templates, static)
└── data/                   # staging area (populated by import script; git-ignored)
```

## Troubleshooting
- **GeoServer 500 / blank:** wait — it initialises after the DB is healthy. `docker compose logs -f geoserver`.
- **importlayers can't see files:** confirm `./data` has the staged `*.shp` sets and that the `geonode` service mounts it at `/import_data`.
- **CORS errors from the React app:** add your origin to `CORS_ORIGIN_WHITELIST` in `settings.py`.
- **Ports busy (80/8080/8000):** stop conflicting services or remap in `docker-compose.yml`.
