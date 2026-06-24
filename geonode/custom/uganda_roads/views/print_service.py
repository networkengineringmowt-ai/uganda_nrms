"""
print_service.py — MoWT-branded PDF map printing.

Thin Django proxy in front of GeoServer's MapFish Print module (printing-ng),
adding the Uganda NRMS letterhead template. The actual rasterisation is done by
GeoServer/MapFish; this view validates the request, injects the MoWT template
name, and streams the PDF back.

    POST /print/report.pdf   body: MapFish print spec JSON (layers, bbox, dpi)
    GET  /print/capabilities.json   → available layouts (A4/A3 × portrait/landscape)

Requires GeoServer started with the printing extension and the template at
geoserver/printing/config.yaml (mounted into the GeoServer data dir).
"""
from __future__ import annotations

import json
import os
import urllib.request
from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt

GEOSERVER = os.getenv("GEOSERVER_LOCATION", "http://geoserver:8080/geoserver/")
PRINT_APP = "uganda_nrms"   # MapFish print app name (config.yaml)

LAYOUTS = [
    {"name": "A4 portrait",  "page": "A4",  "orientation": "portrait"},
    {"name": "A4 landscape", "page": "A4",  "orientation": "landscape"},
    {"name": "A3 portrait",  "page": "A3",  "orientation": "portrait"},
    {"name": "A3 landscape", "page": "A3",  "orientation": "landscape"},
]


def capabilities(request):
    return JsonResponse({
        "app": PRINT_APP,
        "title": "Uganda National Roads — GIS Enterprise",
        "layouts": LAYOUTS,
        "dpiSuggestions": [96, 150, 300],
        "formats": ["pdf", "png"],
    })


@csrf_exempt
def report_pdf(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST a MapFish print spec")
    try:
        spec = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("invalid JSON spec")

    # Inject MoWT branding defaults into the spec attributes.
    attrs = spec.setdefault("attributes", {})
    attrs.setdefault("title", "Uganda National Roads Management System")
    attrs.setdefault("subtitle", "Ministry of Works and Transport · Directorate of National Roads")
    attrs.setdefault("credits", "GeoNode · GeoServer · MoWT/UNRA")
    spec.setdefault("layout", "A4 landscape")
    spec["outputFormat"] = "pdf"

    url = f"{GEOSERVER.rstrip('/')}/pdf/print/{PRINT_APP}/buildreport.pdf"
    req = urllib.request.Request(
        url, data=json.dumps(spec).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            pdf = r.read()
    except Exception as e:  # surface GeoServer/print errors to the client
        return JsonResponse({"error": "print backend failed", "detail": str(e)}, status=502)

    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = 'attachment; filename="uganda-nrms-map.pdf"'
    return resp

# Wire in uganda_roads/urls.py:
#   path("print/capabilities.json", capabilities),
#   path("print/report.pdf", report_pdf),
