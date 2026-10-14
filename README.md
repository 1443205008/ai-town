# AI 沙海小镇

AI 沙海小镇是一个可自托管的沙漠聚落模拟器。玩家以镇长身份管理一个由 20 位居民组成的边境小镇；居民拥有独立档案、技能、记忆、关系和隐私边界，会在规则系统约束下工作、交往、提出议案并参与建设。

项目包含 Vue 3 管理界面、Phaser 地图渲染、Fastify API、PostgreSQL 持久化和独立 Worker。AI Provider 是可选增强层；没有外部模型时，小镇仍通过确定性的规则模拟继续运行。

## 功能范围

- **居民与记忆**：20 位种子居民，私有记忆与公开事件分离，社交和关系变化可追溯。
- **经济系统**：现金账本、库存、工资、交易、建设预留和幂等流水。
- **治理系统**：自然语言议案解析、讨论、意见、修订、限水政策和资金审批。
- **城市规划与建设**：水塔、住宅、农田、道路，包含选址、预算、工人、材料、暂停、恢复、取消和竣工。
- **环境模拟**：热浪、沙暴、井故障、道路阻塞、建筑耐久、生产/施工效率、居民避难与清障。
- **AI 决策实验**：规则、OpenAI 兼容 Provider 和 Jev 协议对照；支持回退、延迟、费用、态度稳定性和角色立场一致性统计。
- **扩张与文明**：探索、扩图、移民、创业、贸易、外交、访客、研究和多世界隔离。
- **可靠性与安全**：登录限流、版本竞争控制、Job 重试/退避/熔断、存档导入校验、导出/恢复和调试沙盒。

## 技术结构

```text
apps/web       Vue 3 + Vite + Phaser 地图和管理面板
apps/server    Fastify API、WebSocket、鉴权和世界命令
apps/server    Worker：异步 Provider Job 与规则任务
packages/db    PostgreSQL、Drizzle schema、快照和事件持久化
packages/world-core   时钟、环境、扩张和文明模拟
packages/residents    寻路、需求、工作和生产
packages/economy      账本、库存、交易和建设成本
packages/governance   议案、讨论、政策和状态转换
packages/city-planning 选址、施工、道路和建筑规则
packages/model-center Provider、决策协议、加密配置和回退
seed             地图、场景和 20 位居民档案
tests            Vitest 单元/API/可靠性测试与 Playwright 浏览器测试
```

## 快速开始

环境要求：Node.js 22、pnpm 9、Docker。

```bash
pnpm install
cp .env.example .env
```

编辑 `.env`，至少设置镇长密码和随机 Session Secret：

```dotenv
MAYOR_PASSWORD=your-password
SESSION_SECRET=at-least-32-random-characters
DATABASE_URL=postgres://frontier:frontier_dev@127.0.0.1:54329/frontier_v2
```

启动 PostgreSQL 并执行迁移：

```bash
docker compose up -d postgres
pnpm migrate
```

开发模式可以一条命令启动前端和后端：

```bash
pnpm dev
```

打开 <http://localhost:5188>。也可以分别运行 `pnpm dev:server`、`pnpm worker` 和 `pnpm dev:web`。

## 容器部署

准备 `.env` 后运行：

```bash
docker compose up -d --build
```

前端地址是 <http://localhost:5188>，API 默认监听 `3100`。PostgreSQL 数据保存在 Docker volume `frontier-v2-db` 中。删除该 volume 会删除世界存档；生产环境应启用 HTTPS、设置正确的 `APP_ORIGIN` 并使用安全 Cookie。

## Provider 配置

外部模型不是运行小镇所必需的。模型中心支持 OpenAI 兼容接口和 Jev 决策协议，配置通过 API 保存并加密密钥。建议先使用本地 HTTP Mock 验证协议，再接入真实服务。

实验页面不会自动执行模型意见。每次实验最多顺序调用三次 LLM 或 Jev；统计供应商报告的费用，或根据报告 Token 和已配置单价计算。缺少用量时显示“未知”，不会把未知账单当成零成本。

## 测试与验收

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser
```

当前核心回归包含 13 个测试文件、28 项 Vitest 测试，以及 3 项 Playwright 浏览器测试。浏览器套件覆盖桌面端、390px 移动端和 A–F 连续流程：居民城镇、私有记忆、限水冲突、无预算水塔、竣工追溯和模型停用后的规则运行。

详细阶段报告、验收证据和截图位于 [`docs/reports`](docs/reports)。

## 重要配置

| 变量 | 用途 |
| --- | --- |
| `MAYOR_PASSWORD` | 镇长登录密码 |
| `SESSION_SECRET` | Session 签名密钥，生产环境使用随机值 |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `PORT` | API 端口，默认 `3100` |
| `APP_ORIGIN` | 前端来源，用于 CORS 和 Cookie 策略 |
| `TICK_INTERVAL_MS` | Worker Tick 间隔 |
| `LOCAL_MODEL_ALLOWLIST` | 允许访问的本地模型地址列表 |

## 许可证与素材

项目当前使用仓库内原创代码和程序化视觉元素。素材说明见 [`docs/ASSET-LICENSES.md`](docs/ASSET-LICENSES.md)。
