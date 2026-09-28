# adapter-api — build reproducible desde el lockfile del monorepo.
#
# Contexto: la raíz del repo (ahí viven pnpm-lock.yaml y pnpm-workspace.yaml).
#
# --frozen-lockfile es el punto de este fichero: los Dockerfiles anteriores
# hacían `npm install --legacy-peer-deps` dentro de un monorepo pnpm, ignorando
# el lockfile, así que dos builds del mismo commit podían dar árboles distintos.
#
# `pnpm deploy` produce un node_modules autocontenido y ya podado de
# dependencias de desarrollo. Se usa en vez de copiar node_modules a mano
# porque el layout de pnpm son symlinks relativos al workspace: al moverlos
# se rompen. Tampoco se fuerza --node-linker=hoisted, que cambia el
# anidamiento y rompe resoluciones reales (comprobado en virto-api, donde
# @polkadot-api/substrate-bindings acababa viendo un @noble/hashes sin el
# subpath './blake2b').

FROM node:22-alpine AS builder

RUN corepack enable
# pnpm se niega a recrear node_modules sin TTY si no se declara entorno de CI.
ENV CI=true
# Cadena de compilación para better-sqlite3, que trae binding nativo.
RUN apk add --no-cache python3 make g++

WORKDIR /repo

# Primero solo los manifiestos: mientras no cambien, Docker reutiliza la capa
# de dependencias y no reinstala en cada cambio de código.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# pnpm construye el grafo del workspace entero antes de filtrar, así que
# necesita el manifiesto de cada paquete aunque solo instalemos uno.
COPY packages/adapter-api/package.json ./packages/adapter-api/
COPY packages/bramp/package.json ./packages/bramp/
COPY packages/contracts-api/package.json ./packages/contracts-api/
COPY packages/virto-api/package.json ./packages/virto-api/
COPY packages/mock-api/package.json ./packages/mock-api/
COPY packages/bramp/.papi/descriptors/package.json ./packages/bramp/.papi/descriptors/
COPY packages/contracts-api/.papi/descriptors/package.json ./packages/contracts-api/.papi/descriptors/
COPY packages/virto-api/.papi/descriptors/package.json ./packages/virto-api/.papi/descriptors/
COPY packages/adapter-api/fix-webauthn.js ./packages/adapter-api/

RUN pnpm install --frozen-lockfile --filter abako-adapter...

COPY packages/adapter-api ./packages/adapter-api

RUN pnpm --filter abako-adapter build

# --legacy: pnpm 10 solo despliega workspaces con inject-workspace-packages,
# que aquí no aplica. --prod deja fuera las dependencias de desarrollo.
RUN pnpm deploy --legacy --filter=abako-adapter --prod /out


FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_NO_WARNINGS=1

COPY --from=builder --chown=node:node /out/node_modules ./node_modules
# pnpm deploy selecciona ficheros como npm pack, y dist está en .gitignore:
# se copia del árbol del builder.
COPY --from=builder --chown=node:node /repo/packages/adapter-api/dist ./dist
COPY --from=builder --chown=node:node /out/package.json ./package.json

# Sin src/ ni tsconfig: en producción se ejecuta el compilado, no se compila.
USER node

EXPOSE 4000

CMD ["node", "dist/main.js"]
