# 实现决定

- 使用版本化 JSONB 世界聚合与关系型事件/命令/快照表，事务边界是一整个世界；初期20人避免过早跨表拆分。个人知识与记忆仍独立归属并在投影/API处过滤。
- 无有效 Git 元数据，当前目录开发，不触碰受限 .git。现有同名旧容器保持原样；新 Compose 项目 frontier-v2，端口54329/3100/5188。当前源码预览由 Vite 5189 代理至本地 API 3101，用于新镜像代理返回502时的浏览器验证。
- 原型使用原创 Phaser Graphics 像素图形，不下载或再分发外部资产；所有建筑/人物坐标来源于 Seed。
- 登录使用 HttpOnly SameSite cookie，服务端仅允许已配置的浏览器 Origin；不在 WS URL 放密码/密钥。生产HTTPS需设置 COOKIE_SECURE=true。
