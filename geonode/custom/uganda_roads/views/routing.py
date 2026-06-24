"""
routing.py — road-network routing & isochrones over pgRouting.

Backed by the topology built in scripts/build_road_topology.sql
(`road_network_noded` + `road_network_vertices_pgr`). Endpoints:

    /routing/shortest-path/?from=<vid>&to=<vid>[&f=geojson]
    /routing/nearest-node/?lon=<x>&lat=<y>
    /routing/isochrone/?lon=<x>&lat=<y>&minutes=<n>

Distances/costs are in metres (cost column = ST_Length(geom::geography)).
Isochrone uses pgr_drivingDistance on a time-cost (assumes ~50 km/h; tune the
SPEED_KMH constant or store per-link speeds for accuracy).
"""
from __future__ import annotations

import json
from django.db import connection
from django.http import JsonResponse, HttpResponseBadRequest

SPEED_KMH = 50.0  # default network speed for time-cost; replace with per-link speeds


def _rows(sql, params):
    with connection.cursor() as cur:
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def nearest_node(request):
    try:
        lon = float(request.GET["lon"]); lat = float(request.GET["lat"])
    except (KeyError, ValueError):
        return HttpResponseBadRequest("lon & lat required")
    rows = _rows(
        """
        SELECT id, ST_X(the_geom) AS lon, ST_Y(the_geom) AS lat,
               ST_Distance(the_geom::geography, ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography) AS dist_m
        FROM road_network_vertices_pgr
        ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%s,%s),4326)
        LIMIT 1
        """,
        [lon, lat, lon, lat],
    )
    return JsonResponse(rows[0] if rows else {}, safe=False)


def shortest_path(request):
    try:
        src = int(request.GET["from"]); dst = int(request.GET["to"])
    except (KeyError, ValueError):
        return HttpResponseBadRequest("from & to (vertex ids) required")
    rows = _rows(
        """
        SELECT d.seq, d.node, d.edge, d.cost AS length_m,
               ST_AsGeoJSON(e.geom) AS geojson
        FROM pgr_dijkstra(
               'SELECT id, source, target, cost, reverse_cost FROM road_network_noded',
               %s, %s, true) AS d
        JOIN road_network_noded e ON e.id = d.edge
        ORDER BY d.seq
        """,
        [src, dst],
    )
    total = sum(r["length_m"] or 0 for r in rows)
    coords = []
    for r in rows:
        gj = json.loads(r["geojson"]) if r["geojson"] else None
        if gj and gj.get("type") == "LineString":
            coords.extend(gj["coordinates"])
    feature = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": {"length_m": round(total, 1),
                       "length_km": round(total / 1000, 2),
                       "minutes": round(total / 1000 / SPEED_KMH * 60, 1),
                       "edges": len(rows)},
    }
    return JsonResponse({"type": "FeatureCollection", "features": [feature]})


def isochrone(request):
    try:
        lon = float(request.GET["lon"]); lat = float(request.GET["lat"])
        minutes = float(request.GET.get("minutes", 30))
    except (KeyError, ValueError):
        return HttpResponseBadRequest("lon, lat, minutes required")
    max_m = minutes / 60.0 * SPEED_KMH * 1000.0
    rows = _rows(
        """
        WITH start AS (
          SELECT id FROM road_network_vertices_pgr
          ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%s,%s),4326) LIMIT 1
        ),
        reach AS (
          SELECT dd.node FROM start,
            pgr_drivingDistance(
              'SELECT id, source, target, cost FROM road_network_noded',
              (SELECT id FROM start), %s, false) AS dd
        )
        SELECT ST_AsGeoJSON(ST_ConcaveHull(ST_Collect(v.the_geom), 0.85)) AS hull
        FROM reach r JOIN road_network_vertices_pgr v ON v.id = r.node
        """,
        [lon, lat, max_m],
    )
    hull = json.loads(rows[0]["hull"]) if rows and rows[0]["hull"] else None
    return JsonResponse({
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": hull,
                      "properties": {"minutes": minutes, "max_m": round(max_m)}}] if hull else [],
    })

# Wire in uganda_roads/urls.py:
#   path("routing/nearest-node/", nearest_node),
#   path("routing/shortest-path/", shortest_path),
#   path("routing/isochrone/", isochrone),
