FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app
COPY src/admin/package*.json ./src/admin/
RUN cd src/admin && npm ci
COPY src/admin/ ./src/admin/
RUN cd src/admin && npm run build

FROM node:20-bookworm-slim
WORKDIR /app

# Install native compilation dependencies for better-sqlite3 and node-datachannel
RUN apt-get update && apt-get install -y python3 make g++ libsqlite3-dev && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
# Copy pre-built frontend
COPY --from=frontend-builder /app/src/admin/dist ./src/admin/dist

EXPOSE 52331
CMD ["npx", "tsx", "src/index.ts"]
