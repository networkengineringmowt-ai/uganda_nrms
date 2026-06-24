#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# import_layers.sh — stage Uganda road-network spatial data from the G: repository
# into GeoNode and publish each as a dataset with the right style + metadata.
#
# Run from the host (Docker Desktop running, stack up):
#   bash scripts/import_layers.sh
#
# It (1) copies the shapefiles listed in layers_config.yml from G: into ./data/,
# (2) runs GeoNode's importlayers inside the container, (3) syncs SLD styles into
# GeoServer, (4) stamps title/abstract/keywords/category on each dataset.
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

G_REPO="${G_REPO:-/g/My Drive/MOWT/Uganda National Road Network Repository}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$HERE/data"
GEONODE_SVC="geonode"
GEOSERVER_SVC="geoserver"

echo "▶ Staging spatial data from: $G_REPO"
mkdir -p "$STAGE"

# Shapefile groups to stage (folder under '8. Shapefiles' → staged basename).
# Add/adjust to match layers_config.yml.
declare -A SHP=(
  ["8. Shapefiles/Roads"]="national_road_network"
  ["8. Shapefiles/District Roads"]="district_roads"
  ["8. Shapefiles/Bridges"]="bridges"
  ["8. Shapefiles/Major Culverts"]="major_culverts"
  ["8. Shapefiles/Traffic count stations"]="traffic_count_stations"
  ["8. Shapefiles/Weighbridges"]="weighbridges"
  ["8. Shapefiles/MoWT_Stations"]="mowt_stations"
  ["8. Shapefiles/Districts"]="districts"
  ["8. Shapefiles/Towns"]="towns"
  ["8. Shapefiles/Protected areas"]="protected_areas"
  ["8. Shapefiles/Ferry"]="ferries"
  ["8. Shapefiles/Airport"]="airports"
)

# Copy each shapefile sidecar set (.shp/.shx/.dbf/.prj/.cpg) into ./data
for src in "${!SHP[@]}"; do
  name="${SHP[$src]}"
  full="$G_REPO/$src"
  [ -d "$full" ] || { echo "  ! missing: $src (skipping)"; continue; }
  shp=$(find "$full" -maxdepth 1 -iname '*.shp' | head -1)
  [ -n "$shp" ] || { echo "  ! no .shp in $src"; continue; }
  base="${shp%.shp}"
  for ext in shp shx dbf prj cpg qpj; do
    [ -f "$base.$ext" ] && cp -f "$base.$ext" "$STAGE/$name.$ext" 2>/dev/null || true
  done
  echo "  ✓ staged $name"
done

# Also stage the committed GeoJSON condition layer from the React app
if [ -f "$HERE/../public/data/gisnetwork18062025.geojson" ]; then
  cp -f "$HERE/../public/data/gisnetwork18062025.geojson" "$STAGE/road_condition.geojson"
  echo "  ✓ staged road_condition (GeoJSON)"
fi

echo "▶ Importing into GeoNode (importlayers)…"
docker compose exec -T "$GEONODE_SVC" python manage.py importlayers /import_data \
  -v 2 -i -o --keywords "Uganda,roads,MoWT,DNR" --category transportation || {
    echo "  importlayers reported issues — check 'docker compose logs $GEONODE_SVC'"; }

echo "▶ Publishing SLD styles to GeoServer…"
for sld in "$HERE"/styles/*.sld; do
  style="$(basename "${sld%.sld}")"
  docker compose exec -T "$GEOSERVER_SVC" sh -c "true" >/dev/null 2>&1 || true
  curl -s -u "${GEOSERVER_ADMIN_USER:-admin}:${GEOSERVER_ADMIN_PASSWORD:-geoserver}" \
    -XPOST -H 'Content-type: application/vnd.ogc.sld+xml' \
    -d @"$sld" "http://localhost/geoserver/rest/styles?name=$style" \
    && echo "  ✓ style $style published" || echo "  ! style $style may already exist"
done

echo "✔ Done. Open http://localhost/ → Datasets to review titles, styles and metadata."
echo "  Tip: set each dataset's default style in GeoServer → Layers → <layer> → Publishing."
