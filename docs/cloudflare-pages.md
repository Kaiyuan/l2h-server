# Cloudflare Pages 部署教程 (l2h-server)

l2h-server 支持部署在 Cloudflare Pages 上，利用 Cloudflare D1 数据库实现高性能、分布式的 WebRTC 信令与网关服务。

## 1. 准备工作

- **Cloudflare 账号**：拥有活跃的 Cloudflare 账号。
- **Wrangler CLI**：本地安装了 `wrangler` (可选，推荐)。

## 2. 创建 D1 数据库

在 Cloudflare 控制台或通过命令行创建数据库：

```bash
npx wrangler d1 create l2h-db
```

记下控制台输出的 `database_id`。

## 3. 配置项目

修改 `wrangler.toml` (如果您使用 Wrangler 部署) 或在 Cloudflare Pages 仪表盘中设置：

### 环境变量 (Environment Variables)
- `ADMIN_PATH`: 管理后台路径（默认 `dashboard`）。
- `JWT_SECRET`: 随机字符串，用于身份验证。

### 数据库绑定 (D1 Bindings)
将 D1 数据库绑定到名为 `DB` 的变量上。

## 4. 源码适配说明

本项目采用了同构设计：
- **数据库**：在 Cloudflare 环境下会自动连接 `c.env.DB` (D1)，在 Node 环境下使用本机的 `l2h.db` (SQLite)。
- **WebRTC**：在 Cloudflare 环境下将调用原生的 `RTCPeerConnection`，不再依赖本地的 `node-datachannel`。

## 5. 部署步骤

### 方法 A: 通过 GitHub 自动部署 (推荐)
1. 将代码推送到您的 GitHub 仓库。
2. 在 Cloudflare Pages 中创建新项目，连接该仓库。
3. **框架预设**：选择 `Hono` 或 `None`。
4. **构建命令**：`npm install && npm run build`（确保 build 脚本包含编译 Worker）。
5. **输出目录**：`dist`。
6. **添加绑定**：在项目设置 -> 函数 -> D1 数据库绑定中，将您的 `l2h-db` 绑定为 `DB`。

### 方法 B: 使用 Wrangler 手动部署
```bash
npm run build
npx wrangler pages deploy dist --project-name l2h-server
```

## 6. 初始化数据库

由于 Cloudflare D1 需要初始化表结构。在部署完成后，首次访问项目会自动检测并提示。您也可以手动运行 SQL：

```bash
npx wrangler d1 execute l2h-db --file=./src/db/schema.sql
```

## 7. 常见问题

- **WebRTC 兼容性**：Cloudflare Workers 的 WebRTC 目前处于测试阶段，确保您的 Worker 开启了相关的 Compatibility Flag。
- **静态资源**：管理后台的静态文件需要通过 `dist` 目录正确托管。
