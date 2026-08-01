FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY api-server/package.json api-server/package-lock.json ./api-server/
RUN npm ci && npm --prefix api-server ci

COPY . .
RUN npm run broadcaster:build && npm run api:build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY api-server/package.json api-server/package-lock.json ./api-server/
RUN npm ci --omit=dev \
  && npm --prefix api-server ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/dist-broadcaster ./dist-broadcaster
COPY --from=build /app/api-server/dist ./api-server/dist
COPY api-server/migrations ./api-server/migrations
COPY api-server/scripts ./api-server/scripts
COPY api-server/src ./api-server/src
COPY data/maps/original ./data/maps/original

RUN chown -R node:node /app

USER node

CMD ["npm", "run", "api:start"]
