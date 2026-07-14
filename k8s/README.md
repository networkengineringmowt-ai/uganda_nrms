# NRMS backend on Kubernetes (k3s, single ministry server)

## What runs where
| Component | Kind | Purpose |
|---|---|---|
| nrms-api | Deployment ×2 | Express API — Supabase write-back (surveys, data entry) |
| postgis | StatefulSet + 50Gi PVC | Enterprise geodatabase (PostGIS 16) |
| geoserver | Deployment + 20Gi PVC | WMS/WFS-T/WMTS over PostGIS |
| npms-data-engine | CronJob 02:00 nightly | Pavement ETL (`scripts/pavement_data_engine.py`) |
| Traefik (built-in) | Ingress | `/api` → API, `/geoserver` → GeoServer |

## Requirements
A Linux server (or WSL2 on Windows Server) with 8 GB+ RAM, Docker installed.

## Install (once)
1. Copy the `ugnrms` repo to the server (e.g. `/srv/ugnrms`).
2. Edit `install_k3s.sh` — paste real secret values (Supabase URL + service-role key, DB and GeoServer passwords).
3. `cd /srv/ugnrms/k8s && sudo bash install_k3s.sh`

## Day-2 operations
- Status: `kubectl -n nrms get pods`
- Logs: `kubectl -n nrms logs deploy/nrms-api`
- Update API after code change: rebuild image (step 3 of the script) then `kubectl -n nrms rollout restart deploy/nrms-api`
- Run ETL now: `kubectl -n nrms create job --from=cronjob/npms-data-engine etl-manual`

## Pointing the live site at it
Set the API base URL used by the frontend to `http://<server-ip>/api`
(only reachable inside the ministry network unless you expose it; for
public access put it behind a domain + TLS, e.g. cloudflared tunnel).
