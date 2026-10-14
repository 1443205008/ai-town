# M0 实施报告

已完成 pnpm TypeScript monorepo、Vue/Phaser 可拖动缩放并点选的 Seed 沙漠地图、Fastify HTTP/WS cookie鉴权、PostgreSQL/Drizzle schema与迁移、世界创建加载、暂停/恢复/倍速、快照、独立 Worker 与事务锁。Compose 项目 frontier-v2 实际构建并运行，未修改机器上的旧 ai-frontier-town 容器。

重要文件：apps/server/src/app.ts、worker.ts；packages/db/src/store.ts、schema.ts、migrations/0001_world.sql；packages/world-core/src/world.ts；apps/web/src/TownMap.vue、App.vue；seed/maps/starter.json、seed/scenarios/starter.json；compose.yaml。

验证：`pnpm typecheck` 通过；`pnpm build` 通过；`pnpm test` 13文件24测试通过；`pnpm test:browser` 2/2通过（桌面登录/WS/暂停/重载、390px移动端财政管理）；`tests/reliability.test.ts` 覆盖恢复边界、决策对比端点、指标及20/50居民负载。截图 M0-browser.png、mobile-finance.png。

恢复实测：`node --env-file=.env scripts/m0-restart.mjs before` 暂停并记录地图SHA256/时间；`docker compose restart server worker`；`node --env-file=.env scripts/m0-restart.mjs after` 核对完全一致并恢复模拟，PASS。

限制：Phaser生产包约1.58MB，构建有大 chunk 提示；实时性能仅在当前开发容器和模拟负载实测，未作生产容量承诺。Native 独立验收尚待复核。后续可拆包并补一次完整人工六场景试玩。
