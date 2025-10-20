default:
    @just --list

install:
    npm ci

build:
    npm run build

dev:
    SEED="//Alice" PORT=3000 NODE_ENV=development npm run start:dev

start:
    SEED="//Alice" PORT=3000 NODE_ENV=production npm run start:prod

test-unit:
    npm run test:unit

test-integration:
    npm run test:integration

test-e2e:
    SEED="//Alice" PORT=3000 NODE_ENV=test npm run test:e2e
