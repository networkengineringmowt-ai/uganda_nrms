# NRMS Express API
#
# Node 22+ is required: index.js does a top-level `import { DatabaseSync }
# from 'node:sqlite'` for the read-only NPMS analytics routes. node:sqlite
# does not exist at all on Node 20, so that import throws at startup and the
# whole server (not just the PMS routes) crashes before it can listen. Node
# 22 ships node:sqlite (experimental, but present and working without any
# extra flag), so 20-alpine -> 22-alpine here is a required fix, not a nicety.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js ./
# index.js listens on process.env.PORT || 3001 - bare local dev (npm run dev,
# no Docker) uses 3001 per server/.env.example, but the actual containerized
# deployment (k8s/base/api-deployment.yaml) sets PORT=8787 and maps
# containerPort 8787. Set the same default here so the image is
# self-consistent no matter how it's run: `docker run` with no -e PORT still
# listens on the port this file advertises, instead of silently listening on
# 3001 while EXPOSE/any -p mapping assumes 8787.
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "index.js"]
