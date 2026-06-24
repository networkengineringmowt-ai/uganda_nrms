"""
arcgis_rest.py — ArcGIS Server REST API emulation for GeoNode/PostGIS.

Exposes a subset of the Esri ArcGIS REST "FeatureService / MapServer" query API
so that ArcGIS-compatible clients (ArcGIS JS API, ArcGIS Pro, QGIS "ArcGIS REST
Connector") can consume the Uganda road-network layers straight from PostGIS.

URL shape (matches Esri):
    /arcgis/rest/services/<service>/MapServer/<layerId>/query
        ?where=<sql>&outFields=*&geometry=<xmin,ymin,xmax,ymax>
        &spatialRel=esriSpatialRelIntersects&f=json|geojson

Supported params: where, outFields, geometry (envelope), inSR/outSR (4326 only),
returnGeometry, resultRecordCount, resultOffset, f (json|geojson|pbf-not-impl),
orderByFields, returnCountOnly.

The layer registry maps Esri layerIds → PostGIS tables (published by
import_layers.sh / layers_config.yml). Keep this list in step with the imported
datasets. Geometry is read as GeoJSON via ST_AsGeoJSON and reshaped to Esri JSON.

This is a read/query implementation (no editing). It is deliberately defensive:
`where` is sanitised against a column allow-list to avoid SQL injection.
"""
from __future__ import annotations

import json
import re
from django.db import connection
from django.http import JsonResponse, HttpResponseBadRequest

# ── Layer registry: Esri layerId → (table, id column, geometry column, fields) ──
# Tables are created by the import script in the GeoNode data schema.
LAYERS = {
    0: {"name": "national_road_network", "table": "national_road_network",
        "id": "ogc_fid", "geom": "wkb_geometry",
        "fields": ["ogc_fid", "link_id", "road_no", "road_name", "road_class",
                   "surface_type", "length_km", "region"]},
    1: {"name": "road_condition", "table": "road_condition",
        "id": "ogc_fid", "geom": "wkb_geometry",
        "fields": ["ogc_fid", "link_id", "iri", "condition_rating", "surface_type"]},
    2: {"name": "bridges", "table": "bridges",
        "id": "ogc_fid", "geom": "wkb_geometry",
        "fields": ["ogc_fid", "bridge_no", "bridge_name", "condition", "road_no", "span_m"]},
    3: {"name": "traffic_count_stations", "table": "traffic_count_stations",
        "id": "ogc_fid", "geom": "wkb_geometry",
        "fields": ["ogc_fid", "station_id", "type", "aadt", "road_no"]},
    4: {"name": "weighbridges", "table": "weighbridges",
        "id": "ogc_fid", "geom": "wkb_geometry",
        "fields": ["ogc_fid", "name", "status", "road_no"]},
}

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
# Allow a constrained WHERE grammar: <col> <op> <value> [AND/OR ...]
_WHERE_TOKEN = re.compile(
    r"^[A-Za-z0-9_\s'\"%<>=!.,()\-]+$"
)


def _service_root(request, service: str):
    """Esri MapServer service descriptor (so clients can introspect layers)."""
    layers = [{"id": lid, "name": meta["name"], "geometryType": "esriGeometryAny",
               "defaultVisibility": True, "minScale": 0, "maxScale": 0}
              for lid, meta in LAYERS.items()]
    return JsonResponse({
        "currentVersion": 11.2,
        "serviceDescription": "Uganda National Roads — GIS Enterprise (GeoNode)",
        "mapName": service,
        "copyrightText": "Ministry of Works and Transport · DNR / UNRA",
        "spatialReference": {"wkid": 4326, "latestWkid": 4326},
        "singleFusedMapCache": False,
        "capabilities": "Map,Query,Data",
        "supportedQueryFormats": "JSON, geoJSON",
        "layers": layers,
    })


def _safe_where(where: str, allowed_cols) -> str:
    where = (where or "").strip()
    if not where or where == "1=1":
        return "TRUE"
    if not _WHERE_TOKEN.match(where):
        raise ValueError("Unsupported characters in 'where'")
    # Every bare identifier referenced must be in the allow-list.
    idents = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", where))
    sql_words = {"AND", "OR", "NOT", "LIKE", "IN", "IS", "NULL", "TRUE", "FALSE"}
    for ident in idents:
        if ident.upper() in sql_words:
            continue
        if ident not in allowed_cols:
            raise ValueError(f"Unknown field in 'where': {ident}")
    return where


def _envelope_clause(geom_param: str, geom_col: str):
    """Parse 'xmin,ymin,xmax,ymax' → a ST_MakeEnvelope intersects clause."""
    try:
        xmin, ymin, xmax, ymax = (float(v) for v in geom_param.split(","))
    except Exception:
        return None
    return (f"ST_Intersects({geom_col}, "
            f"ST_MakeEnvelope({xmin},{ymin},{xmax},{ymax}, 4326))")


def query(request, service: str, layer_id: str):
    """ArcGIS REST /query endpoint for one layer."""
    try:
        lid = int(layer_id)
    except ValueError:
        return HttpResponseBadRequest("bad layerId")
    meta = LAYERS.get(lid)
    if not meta:
        return JsonResponse({"error": {"code": 400, "message": "Layer not found"}}, status=400)

    p = request.GET
    fmt = (p.get("f") or "json").lower()
    return_geometry = p.get("returnGeometry", "true").lower() != "false"
    count_only = p.get("returnCountOnly", "false").lower() == "true"
    limit = min(int(p.get("resultRecordCount", 2000)), 5000)
    offset = int(p.get("resultOffset", 0))

    out_fields = p.get("outFields", "*")
    cols = meta["fields"] if out_fields in ("*", "") else \
        [c.strip() for c in out_fields.split(",") if c.strip() in meta["fields"]]
    if not cols:
        cols = [meta["id"]]

    try:
        where = _safe_where(p.get("where", ""), set(meta["fields"]))
    except ValueError as e:
        return JsonResponse({"error": {"code": 400, "message": str(e)}}, status=400)

    clauses = [where]
    if p.get("geometry"):
        env = _envelope_clause(p["geometry"], meta["geom"])
        if env:
            clauses.append(env)
    where_sql = " AND ".join(c for c in clauses if c and c != "TRUE") or "TRUE"

    if count_only:
        with connection.cursor() as cur:
            cur.execute(f'SELECT count(*) FROM "{meta["table"]}" WHERE {where_sql}')
            return JsonResponse({"count": cur.fetchone()[0]})

    order = ""
    if p.get("orderByFields"):
        ob = [c.strip() for c in p["orderByFields"].split(",")
              if c.strip().split(" ")[0] in meta["fields"]]
        if ob:
            order = "ORDER BY " + ", ".join(ob)

    col_sql = ", ".join(f'"{c}"' for c in cols)
    geom_sql = f', ST_AsGeoJSON("{meta["geom"]}") AS __geojson' if return_geometry else ""
    sql = (f'SELECT {col_sql}{geom_sql} FROM "{meta["table"]}" '
           f'WHERE {where_sql} {order} LIMIT {limit} OFFSET {offset}')

    with connection.cursor() as cur:
        cur.execute(sql)
        colnames = [d[0] for d in cur.description]
        rows = cur.fetchall()

    features = []
    for row in rows:
        rec = dict(zip(colnames, row))
        gj = rec.pop("__geojson", None)
        attrs = {k: v for k, v in rec.items()}
        if fmt == "geojson":
            features.append({"type": "Feature",
                             "geometry": json.loads(gj) if gj else None,
                             "properties": attrs})
        else:
            feat = {"attributes": attrs}
            if return_geometry and gj:
                feat["geometry"] = _esri_geometry(json.loads(gj))
            features.append(feat)

    if fmt == "geojson":
        return JsonResponse({"type": "FeatureCollection", "features": features})

    return JsonResponse({
        "objectIdFieldName": meta["id"],
        "globalIdFieldName": "",
        "geometryType": "esriGeometryPolyline",
        "spatialReference": {"wkid": 4326, "latestWkid": 4326},
        "fields": [{"name": c, "type": "esriFieldTypeString", "alias": c} for c in cols],
        "features": features,
    })


def _esri_geometry(geojson: dict):
    """Convert a GeoJSON geometry to Esri JSON geometry (paths/points/rings)."""
    t = geojson.get("type")
    coords = geojson.get("coordinates")
    if t == "Point":
        return {"x": coords[0], "y": coords[1], "spatialReference": {"wkid": 4326}}
    if t in ("LineString", "MultiLineString"):
        paths = [coords] if t == "LineString" else coords
        return {"paths": paths, "spatialReference": {"wkid": 4326}}
    if t in ("Polygon", "MultiPolygon"):
        rings = coords if t == "Polygon" else [r for poly in coords for r in poly]
        return {"rings": rings, "spatialReference": {"wkid": 4326}}
    return None


# Wire these in uganda_roads/urls.py:
#   path("arcgis/rest/services/<str:service>/MapServer", _service_root),
#   path("arcgis/rest/services/<str:service>/MapServer/<str:layer_id>/query", query),
