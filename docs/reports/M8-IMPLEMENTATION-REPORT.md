# M8 实施报告

完成探索补给与志愿者限制、勘察后固定上限区块扩容、受住房/水粮承载约束的新移民、私人资金创业、住宅搬迁、商路邻镇协商/贸易与低频远区数据结构。本地聚落以外交主体表达，不默认为敌对资源。

tests/m8-m9.test.ts 的扩容、移民、创业、搬迁、外交和账本检查通过。

文件：`packages/world-core/src/expansion.ts`、`packages/world-core/src/civilization.ts`、`tests/m8-m9.test.ts`。运行 `pnpm exec vitest run tests/m8-m9.test.ts`。限制：新区块和远区外交均采用有限规则模型，不是无限地图或多人模拟；下一阶段完成长期文明、剧本与存档检查。
