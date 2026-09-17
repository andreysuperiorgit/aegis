# AEGIS — server image
#
# better-sqlite3 is a native module, so it is built in a stage that has
# a toolchain and then copied into a slim runtime. Keeping the compiler
# out of the final image saves roughly 300 MB.

FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts


FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The memory database lives here. Mount a volume on it or the run's
# history is lost every time the container is replaced.
RUN mkdir -p /data && chown node:node /data
ENV AEGIS_MEMORY_PATH=/data/memory.db

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --chown=node:node package.json ./

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/aegis/index.js"]
