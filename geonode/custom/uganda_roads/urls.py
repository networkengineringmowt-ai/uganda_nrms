"""
urls.py — URL wiring for the Uganda NRMS enterprise app. Include this from the
GeoNode root urlconf:  path("", include("uganda_roads.urls"))
"""
from django.urls import path, include
from django.views.generic import TemplateView
from .views import arcgis_rest, routing, print_service

urlpatterns = [
    # MoWT portal home (ArcGIS "Portal" equivalent)
    path("", TemplateView.as_view(template_name="geonode/index.html"), name="mowt_home"),

    # ArcGIS Server REST API emulation
    path("arcgis/rest/services/<str:service>/MapServer", arcgis_rest._service_root),
    path("arcgis/rest/services/<str:service>/MapServer/<str:layer_id>/query", arcgis_rest.query),

    # pgRouting network analysis
    path("routing/nearest-node/", routing.nearest_node),
    path("routing/shortest-path/", routing.shortest_path),
    path("routing/isochrone/", routing.isochrone),

    # MoWT-branded printing (MapFish proxy)
    path("print/capabilities.json", print_service.capabilities),
    path("print/report.pdf", print_service.report_pdf),

    # Everything else falls through to GeoNode (catalogue, maps, api, admin, …).
    path("", include("geonode.urls")),
]
