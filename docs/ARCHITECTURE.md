# 架构

Vue 管理面板与 Phaser 像素地图消费经过权限过滤的 HTTP/WS 快照。Fastify 负责鉴权、输入校验和命令提交。独立 Worker 以 PostgreSQL 事务 advisory lock + nextTickAt 保证单世界一次权威 Tick。

world-core 是纯状态机，不连接外部模型。DB 以 worlds 的版本化 JSONB 聚合作为事务边界，world_events、simulation_commands、world_snapshots 另表保留顺序事件、幂等键与备份。Drizzle schema 与 SQL 迁移随代码版本化。后续居民/经济/治理/建设扩展聚合内部结构，避免跨表半更新。

模型任务在 Tick 之外运行，只接收个人合法上下文，输出有限意图，经世界版本/资源/权限校验才能提交。队列设置待处理上限，按预算和调用数限流；连续供应商错误会触发熔断并回退规则。所有 HTTP 和 WS 数据必须先过滤私人内容。受保护的运行指标端点汇总 Tick、AI 队列、账本一致性和 WS 连接；服务端停机不会自动追赶离线游戏时间。存档恢复会验证地图图层维度、居民位置和资源数值后写入新的隔离世界。
