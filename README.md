# l2h-server (Link to Host Server)

l2h-server 是 l2h 系统的中央信令与网关服务器。它负责管理 WebRTC 连接、处理公网 HTTP 请求并将其精准路由到对应的客户端。

## 功能特性

- **WebRTC 信令服务**：协调客户端与服务端的对等连接。
- **反向代理网关**：透明地将公网流量转发至内网客户端。
- **管理后台 (PrimeVue)**：提供可视化的路径管理、用户设置及统计仪表盘。
- **多用户隔离**：基于 API Key 的安全隔离机制，确保数据隐私。
- **多平台支持**：支持 Docker (x86/ARM) 及 CloudFlare Pages 部署。

## 🚀 部署指南

### 1. Docker 部署 (最推荐)

这是最简单、最稳健的部署方式，尤其是对于 NAS、VPS 等环境。

#### 快速启动
```bash
docker run -d \
  --name l2h-server \
  -p 52331:52331 \
  -e ADMIN_USER=l2hadmin \
  -e ADMIN_PASSWORD=l2hpassword \
  -v ./data:/app/data \
  -e DB_PATH=/app/data/l2h.db \
  kaiyuan/l2h-server:latest
```

#### 关键配置参数 (Environment Variables)
- `ADMIN_USER`: 第一次启动时自动创建的管理员用户名。
- `ADMIN_PASSWORD`: 第一次启动时自动创建的管理员密码 (环境变量设定后无需手动初始化)。
- `JWT_SECRET`: 签名令牌的私钥 (建议设置一个长随机字符串)。
- `PORT`: 服务监听端口 (默认 52331)。
- `DB_PATH`: 数据库文件存储路径 (建议挂载宿主机目录 `/app/data/l2h.db` 以实现持久化)。

#### ⚡ WebRTC 网络优化 (重要)
如果您的服务端处于复杂的局域网或内网环境下，建议使用 **`host` 网络模式** 以获得最佳的 WebRTC 穿透成功率：
```bash
docker run -d --name l2h-server --net=host \
  -e ADMIN_USER=admin -e ADMIN_PASSWORD=password \
  kaiyuan/l2h-server:latest
```

---

### 2. 管理后台访问
访问 `http://YOUR_IP:52331/dashboard/` 即可进入管理后台。首次登录后，您可以在后台设置中配置自定义的 STUN/TURN 服务器以增强连通性。

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
