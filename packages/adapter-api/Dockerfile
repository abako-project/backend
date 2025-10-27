# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY packages/adapter-api/package.json ./

COPY packages/adapter-api/ .

RUN npm install --legacy-peer-deps 

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/nest-cli.json ./nest-cli.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

ENV NODE_NO_WARNINGS=1

CMD ["npm", "run", "start:dev"]
