# AI 沙海小镇

独立、自托管的沙漠自治开拓游戏。产品总纲见根目录 v2.0 计划；当前正在按 M0→M9 实现，完成范围与实际验证见 docs/reports。

## 本地开发

需要 Node.js 22、pnpm 9、Docker。先安装依赖：`pnpm install`。首次运行 `python3 scripts/seed-m0.py`（已有 Seed 无需重复生成）；生成的 `.env` 为本机配置，勿提交或分享其中密码。

`docker compose up -d postgres` 启动独立数据库。`node --env-file=.env --import tsx packages/db/src/migrate.ts` 执行迁移。

两个终端分别运行 `node --env-file=.env --import tsx apps/server/src/main.ts` 与 `node --env-file=.env --import tsx apps/server/src/worker.ts`，第三个终端 `pnpm dev:web`。打开 http://localhost:5188，用自己 `.env` 的 MAYOR_PASSWORD 登录。建议直接编辑 `.env` 设置自己记得的密码。

## 容器部署

自行设置 `.env` 中 MAYOR_PASSWORD 与随机 SESSION_SECRET 后，`docker compose up -d --build`，打开 http://localhost:5188。数据库卷 frontier-v2-db 持久化，不执行 `down -v`；移除卷会丢失存档。生产反向代理启用 HTTPS、设置 APP_ORIGIN 与 COOKIE_SECURE=true。

## 检查

`pnpm typecheck`、`pnpm build`、`pnpm test:m0`（需要本地数据库54329）。测试使用独立随机世界，不删除已有世界。浏览器检查使用 Playwright。
