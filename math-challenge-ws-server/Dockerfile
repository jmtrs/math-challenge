# syntax=docker/dockerfile:1

# Etapa de deps: instala solo dependencias de produccion con lockfile (npm ci
# = build reproducible). Las herramientas de build quedan fuera de la imagen
# final.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Etapa runtime: alpine minimo, sin npm/herramientas, proceso como usuario
# no-root (node) ya incluido en la imagen oficial.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY index.js package.json ./
USER node
EXPOSE 3000
CMD ["node", "index.js"]
