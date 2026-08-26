# bramp — build reproducible desde el lockfile del monorepo.
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
#
# Postgres-only: Prisma no admite provider dual (ADR-002, enmienda 2).
# El contexto antes era el propio directorio de bramp, con un COPY . . sin
# .dockerignore que metía node_modules y .env en la imagen.

FROM node:22-alpine AS builder

RUN corepack enable
# pnpm se niega a recrear node_modules sin TTY si no se declara entorno de CI.
ENV CI=true
# openssl lo necesita Prisma para generar su cliente.
RUN apk add --no-cache openssl python3 make g++

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
COPY packages/contracts-api/.papi/descriptors/package.json ./packages/contracts-api/.papi/descriptors/
COPY packages/virto-api/.papi/descriptors/package.json ./packages/virto-api/.papi/descriptors/
COPY packages/bramp/.papi ./packages/bramp/.papi

RUN pnpm install --frozen-lockfile --filter bramp...

COPY packages/bramp ./packages/bramp

# bramp no tiene postinstall de papi: hay que generar los descriptors a mano.
WORKDIR /repo/packages/bramp
RUN pnpm exec papi generate
RUN pnpm exec prisma generate
WORKDIR /repo

RUN pnpm --filter bramp build

# --legacy: pnpm 10 solo despliega workspaces con inject-workspace-packages,
# que aquí no aplica. --prod deja fuera las dependencias de desarrollo.
RUN pnpm deploy --legacy --filter=bramp --prod /out

# El cliente de Prisma se genera dentro de node_modules, así que hay que
# regenerarlo sobre el árbol desplegado.
RUN cd /out && ./node_modules/.bin/prisma generate


FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production
ENV NODE_NO_WARNINGS=1

COPY --from=builder --chown=node:node /out/node_modules ./node_modules
# pnpm deploy selecciona ficheros como npm pack, y dist está en .gitignore:
# se copia del árbol del builder.
COPY --from=builder --chown=node:node /repo/packages/bramp/dist ./dist
COPY --from=builder --chown=node:node /out/package.json ./package.json
# Las migraciones las aplica el contenedor al arrancar.
COPY --from=builder --chown=node:node /repo/packages/bramp/prisma ./prisma

# Sin src/ ni tsconfig: en producción se ejecuta el compilado, no se compila.
USER node

EXPOSE 3001

# Sin pnpm en el runtime: se invoca el binario de prisma directamente.
# migrate deploy aplica lo pendiente sin generar nada, que es el comando
# pensado para producción a diferencia de `migrate dev`.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
