# Build stage
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY packages/contracts-api/package.json ./
COPY packages/contracts-api/.papi ./.papi

RUN npm install --legacy-peer-deps

COPY packages/contracts-api/ .

# Create contracts directory if it doesn't exist
RUN mkdir -p contracts

EXPOSE 3010

CMD ["npm", "run", "server"]

