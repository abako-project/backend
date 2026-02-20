FROM node:22-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy all files first (includes .papi directory with metadata)
COPY . .

RUN npm install

# Generate polkadot-api descriptors
RUN npx papi

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

# Run migrations and start the app
CMD sh -c "npx prisma migrate deploy && npm run start:prod"
