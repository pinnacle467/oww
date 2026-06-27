# Frontend: builds the React (CRA) bundle and serves it with the Express
# server in server.js. Single stage on purpose so the built bundle is baked
# into the image (it can never go missing -> no 502 on restart).
FROM node:20-bookworm-slim

WORKDIR /app/frontend

# Public backend URL is baked in at BUILD time by CRA. Leave EMPTY to call the
# API via same-origin "/api" through the nginx reverse proxy (recommended).
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Install ALL deps (express/compression/craco live in devDependencies and are
# needed for both build and runtime) — do NOT set NODE_ENV=production here or
# yarn would skip them.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

EXPOSE 3000
CMD ["node", "server.js"]
