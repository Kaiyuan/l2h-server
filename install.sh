#!/usr/bin/env bash
# l2h-server one-click install script
# Usage: curl -fsSL https://raw.githubusercontent.com/Kaiyuan/l2h-server/main/install.sh | bash

set -euo pipefail

REPO="Kaiyuan/l2h-server"
INSTALL_DIR="/opt/l2h-server"
DATA_DIR="/opt/l2h-data"
SERVICE_FILE="/etc/systemd/system/l2h-server.service"
PORT="${PORT:-52331}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Root check
[ "$(id -u)" -eq 0 ] || error "Please run as root (sudo)."

# Dependency check
command -v docker >/dev/null 2>&1 || error "Docker is not installed. Please install Docker first: https://docs.docker.com/get-docker/"

info "Installing l2h-server..."

# Create directories
mkdir -p "$INSTALL_DIR" "$DATA_DIR"

# Write docker-compose.yml
cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
version: "3.8"
services:
  l2h-server:
    image: ghcr.io/${REPO}:latest
    container_name: l2h-server
    ports:
      - "${PORT}:52331"
    volumes:
      - ${DATA_DIR}:/app/data
    environment:
      - DB_PATH=/app/data/l2h.db
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_PATH=dashboard
    restart: unless-stopped
EOF

# Write env file for reference
cat > "$INSTALL_DIR/.env" <<EOF
PORT=${PORT}
JWT_SECRET=${JWT_SECRET}
EOF
chmod 600 "$INSTALL_DIR/.env"

# Pull and start
info "Pulling Docker image..."
docker compose -f "$INSTALL_DIR/docker-compose.yml" pull

info "Starting l2h-server..."
docker compose -f "$INSTALL_DIR/docker-compose.yml" up -d

# Optional: write systemd service
if command -v systemctl >/dev/null 2>&1; then
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=l2h-server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=docker compose -f ${INSTALL_DIR}/docker-compose.yml up -d
ExecStop=docker compose -f ${INSTALL_DIR}/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable l2h-server.service >/dev/null 2>&1 && info "Systemd service enabled." || warn "Could not enable systemd service."
fi

info "====================================="
info "l2h-server installed successfully!"
info "  URL   : http://$(curl -sf ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):${PORT}/dashboard/"
info "  Config: ${INSTALL_DIR}/.env"
info "====================================="
warn "Keep JWT_SECRET in .env safe — it authenticates all admin access."
