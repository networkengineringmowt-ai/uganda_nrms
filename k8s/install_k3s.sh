#!/usr/bin/env bash
# One-time setup of the NRMS backend on the ministry server (Linux or WSL2).
# Run as root/sudo:  bash install_k3s.sh
set -euo pipefail

echo "── 1. Install k3s (lightweight Kubernetes, single node) ──"
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

echo "── 2. Create secrets (EDIT THE VALUES FIRST) ──"
kubectl create namespace nrms --dry-run=client -o yaml | kubectl apply -f -
kubectl -n nrms create secret generic nrms-api-secrets \
  --from-literal=SUPABASE_URL='https://YOUR-PROJECT.supabase.co' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='PASTE_SERVICE_ROLE_KEY' \
  --from-literal=ANTHROPIC_API_KEY='PASTE_IF_USED_ELSE_DELETE_LINE' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n nrms create secret generic nrms-db-secrets \
  --from-literal=POSTGRES_USER=nrms \
  --from-literal=POSTGRES_PASSWORD='CHOOSE_STRONG_PASSWORD' \
  --from-literal=POSTGRES_DB=nrms_gis \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n nrms create secret generic nrms-geoserver-secrets \
  --from-literal=GEOSERVER_ADMIN_USER=admin \
  --from-literal=GEOSERVER_ADMIN_PASSWORD='CHOOSE_STRONG_PASSWORD' \
  --dry-run=client -o yaml | kubectl apply -f -

echo "── 3. Build the API image into k3s ──"
# needs docker OR nerdctl on the box; simplest with docker:
docker build -t nrms/api:latest ../server
docker save nrms/api:latest | k3s ctr images import -

echo "── 4. Deploy everything ──"
kubectl apply -k base/

echo "── 5. Status ──"
kubectl -n nrms get pods,svc,ingress
echo "Done. API at http://<this-server>/api · GeoServer at http://<this-server>/geoserver"
