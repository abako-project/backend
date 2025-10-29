FROM rust:slim-bookworm AS rust-builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN rustup install nightly && rustup default nightly

WORKDIR /build

# Copy subskribinto from git submodule instead of cloning
# Note: docker-compose must be run from backend/ root with proper context
COPY external/subskribinto ./subskribinto

WORKDIR /build/subskribinto
RUN cargo build --release

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    jq \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

WORKDIR /zombienet

RUN npm install -g @zombienet/cli@latest

RUN mkdir -p /zombienet/bin

RUN yes | zombienet setup polkadot polkadot-parachain

RUN mv /zombienet/polkadot* /zombienet/bin/ && \
    chmod +x /zombienet/bin/*

COPY --from=rust-builder /build/subskribinto/target/release/subskribinto /usr/local/bin/subskribinto
RUN chmod +x /usr/local/bin/subskribinto

ENV PATH="/zombienet/bin:${PATH}"

COPY infrastructure/kreivo-rococo-local.toml .
COPY infrastructure/chain_spec.json .
COPY infrastructure/contracts/projects_kreivo_local.dat ./contracts/projects_kreivo_local.dat
COPY infrastructure/contracts/calendar_kreivo_local.dat ./contracts/calendar_kreivo_local.dat
COPY infrastructure/contracts/ratings_kreivo_local.dat ./contracts/ratings_kreivo_local.dat
COPY infrastructure/start.sh .
RUN chmod +x start.sh

EXPOSE 10000 20000 21000 22000 23000

CMD ["./start.sh"]
