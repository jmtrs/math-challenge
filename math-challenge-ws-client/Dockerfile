# syntax=docker/dockerfile:1

# Build estatico (vite lee .env.production -> VITE_WS_URL=wss://math-ws.jmtrs.uk).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Servido por nginx (SPA: fallback a index.html).
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
