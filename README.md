# l2h-server (Link to Host Server)

l2h-server 是 l2h 系统的中央信令与网关服务器。它负责管理 WebRTC 连接、处理公网 HTTP 请求并将其精准路由到对应的客户端。

## 功能特性

- **WebRTC 信令服务**：协调客户端与服务端的对等连接。
- **反向代理网关**：透明地将公网流量转发至内网客户端。
- **管理后台 (PrimeVue)**：提供可视化的路径管理、用户设置及统计仪表盘。
- **多用户隔离**：基于 API Key 的安全隔离机制，确保数据隐私。
- **多平台支持**：支持 Docker (x86/ARM) 及 CloudFlare Pages 部署。

## 快速开始

### 1. 一键脚本手动安装

在您的 Linux 服务器上运行：

```bash
curl -fsSL https://raw.githubusercontent.com/Kaiyuan/l2h-server/main/install.sh | bash
```

### 2. Docker Compose 手动部署

创建 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  l2h-server:
    image: ghcr.io/kaiyuan/l2h-server:latest
    container_name: l2h-server
    ports:
      - "52331:52331"
    volumes:
      - ./data:/app/data
    environment:
      - DB_PATH=/app/data/l2h.db
      - JWT_SECRET=YOUR_RANDOM_SECRET
    restart: unless-stopped
```
使用 Docker 和 CloudFlare Pages 部署使用可以设置常量
```
ADMIN_PATH=dashboard
ADMIN_USER=l2hadmin
ADMIN_PASSWORD=l2hpassword
```

### 3. Cloudflare Pages 部署 (D1 数据库)

l2h-server 已适配同构架构，支持通过 Cloudflare D1 进行无服务器部署。

- **详细教程**：[Cloudflare Pages 部署指南](docs/cloudflare-pages.md)
- **数据库**：需绑定 Cloudflare D1 实例至 `DB` 环境变量。

## 开发与贡献

该项目使用 Node.js 开发。

```bash
npm install
npm run dev
```

## 开源协议

MIT
