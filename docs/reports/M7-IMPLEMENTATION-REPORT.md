# M7 实施报告

完成独立 JevDecisionAdapter：将 state 与 choice/score/noul 问题发往配置端点，严格校验类型、选项、分数/概率，异常回退 RulesDecisionAdapter；模型中心的决策实验页可比较规则与配置供应商结果，输出只是一项主观建议，不直接执行世界动作。

`tests/m7.test.ts` 使用本地 HTTP Mock 核验请求协议和非法响应回退，以及重复 LLM 决策的稳定性、角色一致性评分、令牌成本与延迟统计。LLM 实验最多顺序调用三次；Jev 也顺序采样三次，统计态度稳定性与角色立场一致性；费用读取供应商报告的 cost，或由 input_tokens/output_tokens 和供应商单价计算。缺少用量时显示未知，不伪造成本数据。外部付费服务未调用，真实供应商凭据尚未配置。

文件：`packages/model-center/src/decision.ts`、`apps/server/src/app.ts`、`apps/web/src/WorldPanel.vue`。运行 `pnpm exec vitest run tests/m7.test.ts`。对比页面展示规则重复样本、LLM 重复样本统计、可选 Jev 三次探测及基于居民职业/当前需求形成的委员会意见；自动角色一致性分数是相对治理立场的启发式指标，仍需人工复核，委员会仅作咨询，不自动执行治理。
