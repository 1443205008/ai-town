# M6 实施报告

完成热浪、沙暴、井故障、道路影响、居民避难/维修、按实际公开事件生成日报/谣言来源、居民自发检修与限水诉求、支持度派系最小模型。环境事件由 seed 和游戏日决定，结局不写死；政策到期恢复原规则。

tests/m6.test.ts 1/1通过：十日环境轮换包含沙暴/热浪，井故障可由工程师恢复，居民提案和日报事件 ID 均可回溯。

文件：`packages/world-core/src/environment.ts`、`tests/m6.test.ts`。运行 `pnpm exec vitest run tests/m6.test.ts`。限制：派系和支持度是规则近似，仍需通过实际试玩调参；下一阶段进入 Jev 决策实验。

修复证据：沙暴堵塞道路/通行格并清空旧路径，居民在沙暴结束后按工时清障恢复 navigation。热浪效率为 0.7，沙暴为 0.4，实际影响井/农田生产及施工工时；沙暴按时间损耗建筑耐久，井产量继续受耐久影响。road.blocked、road.cleared、building.damaged 事件和清障亲历记忆可追溯。tests/m6.test.ts 覆盖阻塞、清障、导航不可达/恢复、耐久损耗及生产量对照。
