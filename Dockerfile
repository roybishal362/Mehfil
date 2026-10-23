# syntax=docker/dockerfile:1.7
# Portable container image (Cloud Run, Render, Fly, any OCI host).
# The primary deployment is Vercel (see docs/DEPLOYMENT.md); this image runs the same app via the Node entry.

# ---- build stage --------------------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage: distroless, non-root, no shell, no package manager ---------------------
FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    MEHFIL_DISABLE_ENV_FILE=1
# The server bundle is self-contained (dependencies are bundled by esbuild), so no node_modules.
COPY --from=build /app/dist ./dist
EXPOSE 8080
USER nonroot
CMD ["dist/server/node.mjs"]
