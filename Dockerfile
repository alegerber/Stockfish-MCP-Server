FROM node:24-slim

# Install Stockfish
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Environment
ENV STOCKFISH_PATH=/usr/games/stockfish
ENV STOCKFISH_THREADS=2
ENV STOCKFISH_HASH=128

# MCP uses stdio transport
CMD ["node", "dist/index.js"]
