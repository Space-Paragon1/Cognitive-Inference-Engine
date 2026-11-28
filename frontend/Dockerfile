# The CLR web app: built with Vite, served as static files by Caddy.
# Railway builds this with the service's Root Directory set to /frontend
# (settings in the README's Deployment section).

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# The engine the app talks to. Railway passes a service variable of the same name
# as a build argument, so it can be changed without editing this file.
ARG VITE_API_URL=https://cognitive-inference-engine-production.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

# Railway sets PORT; Caddy reads it in the Caddyfile.
ENV PORT=8080
EXPOSE 8080
