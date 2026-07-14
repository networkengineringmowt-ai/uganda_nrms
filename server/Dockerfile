# NRMS Express API
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js ./
EXPOSE 8787
USER node
CMD ["node", "index.js"]
