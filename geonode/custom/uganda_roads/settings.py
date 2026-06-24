"""
Uganda National Roads Management System — GIS Enterprise
Custom GeoNode settings: extends GeoNode defaults and applies MoWT branding.

Activated via DJANGO_SETTINGS_MODULE=uganda_roads.settings (see .env / compose).
"""
import os
from geonode.settings import *          # noqa: F401,F403  (inherit all GeoNode defaults)

# ── Identity / branding ───────────────────────────────────────────────────────
SITE_NAME = "Uganda National Roads Management System — GIS Enterprise"
PROJECT_NAME = os.getenv("GEONODE_INSTANCE_NAME", "uganda_nrms")

# Surfaced in templates (see templates/ overrides)
THEME = {
    "title": os.getenv("GEONODE_THEME_TITLE", SITE_NAME),
    "organisation": os.getenv("GEONODE_THEME_ORG",
                              "Ministry of Works and Transport · Directorate of National Roads"),
    "primary": os.getenv("GEONODE_PRIMARY_COLOR", "#00f5ff"),
    "accent": os.getenv("GEONODE_ACCENT_COLOR", "#ffd23f"),
    "logo": "uganda_roads/img/mowt.jpg",
    "footer": "Ministry of Works and Transport · UNRA · Directorate of National Roads",
}

# Register the branding app + tell Django where our templates/static live.
if "uganda_roads" not in INSTALLED_APPS:                 # noqa: F405
    INSTALLED_APPS = ("uganda_roads",) + tuple(INSTALLED_APPS)  # noqa: F405

TEMPLATES[0]["DIRS"] = [                                  # noqa: F405
    os.path.join(os.path.dirname(__file__), "templates"),
] + TEMPLATES[0].get("DIRS", [])                          # noqa: F405

STATICFILES_DIRS = [                                      # noqa: F405
    os.path.join(os.path.dirname(__file__), "static"),
] + list(globals().get("STATICFILES_DIRS", []))

# ── Default map view → centred on Uganda ──────────────────────────────────────
DEFAULT_MAP_CENTER = (
    float(os.getenv("DEFAULT_MAP_CENTER_X", "32.29")),
    float(os.getenv("DEFAULT_MAP_CENTER_Y", "1.37")),
)
DEFAULT_MAP_ZOOM = int(os.getenv("DEFAULT_MAP_ZOOM", "7"))

# Map client (MapStore) preview library
GEONODE_CLIENT_LAYER_PREVIEW_LIBRARY = os.getenv(
    "GEONODE_CLIENT_LAYER_PREVIEW_LIBRARY", "mapstore")

# Default metadata defaults for imported road datasets
DEFAULT_KEYWORDS = ["Uganda", "roads", "MoWT", "DNR", "transport", "NRMS"]
DEFAULT_DATASET_CATEGORY = "transportation"

# Allow the React NRMS platform (GitHub Pages) to call GeoServer/GeoNode OGC APIs.
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL", "True") == "True"
CORS_ORIGIN_WHITELIST = (
    "https://networkengineringmowt-ai.github.io",
    "https://priscananjehe1996.github.io",
    "http://localhost:5173",
    "http://localhost:5174",
)
