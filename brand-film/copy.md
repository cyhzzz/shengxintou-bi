# Copy sheet — every line that appears on screen, and where it came from

> Source column: `README` = 仓库 README.md；`AGENTS` = 根级 AGENTS.md / CLAUDE.md；`UI` = 产品截图本身出现的文字；`brief` = 用户本次任务提供的标语/CTA；`INVENTED` = 为画面节奏需要、由助手补写的短词（已标注）。

| On screen | Source |
| --- | --- |
| 券商财富管理场景 | README 项目简介首句 |
| 广告投放 + 开户转化 | README 项目简介首句 |
| 抖音 / 腾讯 / 小红书 / 快手 | README 核心能力「内容平台」枚举 |
| 小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果 | README 核心能力「应用市场」枚举 |
| 投放散落四处，转化却像黑盒？ | INVENTED — 由 README「避免在多个投放后台与 CRM 之间手工对账」与痛点推导的 hook 句，已向用户标注 |
| 一屏聚合跨渠道开户数据 | README 业务价值 bullet 1，原文 |
| 告别多后台手工对账 | README 业务价值 bullet 1，原文 |
| 线索成本 / 开户成本 / 有效户成本 | UI：dashboard-preview.png 顶部 tab 标签 |
| 互联网渠道数据概览 | UI：dashboard-preview.png 页面标题 |
| 趋势分析 | UI：dashboard-preview.png 图表区标签（示意图表，非真实数据） |
| 开户日历热力图 | UI：dashboard-preview.png 图表区标签（日历式强度示意图，不含真实数据） |
| 少 / 多 | UI：dashboard-preview.png 热力图图例（强度色阶示意） |
| 1月–12月 / 一–日 | UI：开户日历热力图坐标轴（示意排布，不对应任何真实日期数据） |
| ××× / ××% | 脱敏掩码 — 指标数值一律以 × 占位（用户 2026-10-17 明确「数字都要脱敏」），屏幕不出现任何可读数字；字幕滚动效果为 ×/＊/* 掩码字符扰动 |
| 双链路 双漏斗 | brief：用户在前一轮 remotion 分镜中提出的核心说法 |
| 定位转化卡点 | README 业务价值 bullet 2「定位转化卡点」，原文 |
| 内容平台 8 阶段 | README 核心能力「内容平台 8 阶段」 |
| 应用市场 9 阶段 | README 核心能力「应用市场 9 阶段」 |
| 广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 剔除存量 → 成功开户 → 有效户 | 前端 ConversionFunnel 页「内容平台漏斗」8 阶段口径原文（有效线索后剔除存量） |
| 激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户 | 后端 `app_market.py::FUNNEL_STAGES` 9 阶段口径原文（开户成功 = 创建完资金账号） |
| Web · 桌面 · 安卓 · PWA | AGENTS.md 四端支持表格 |
| 同步进度 ××% | 脱敏掩码 — 四端同步进度条动画保留，数值以 × 占位，非真实同步数据 |
| 一处数据，四端同步 | brief：用户在前一轮 remotion 分镜中提出的核心说法 |
| 数据私有 | AGENTS.md 产品定位 / README 一键部署说明 |
| 开源 | README 许可证说明「MIT License」 |
| 一键部署 | README「一键安装」/ 官网部署说明 |
| 省心投 | logo-vertical.png 品牌中文名 |
| SimpliAds | logo-vertical.png 品牌英文名 |
| 让每分投放，都算得清 | brief：用户指定的落版标语 |
| 开源 · 数据私有 · 一键部署 | brief：用户指定的 CTA，来源综合 README + AGENTS.md |
| github.com/cyhzzz/shengxintou-bi | README 发布流程指向的仓库地址（无标点：githubcomcyhzzzshengxintou-bi） |
| Web 看板 | INVENTED — PWA 端设备标题，描述该端展示的产品看板（与四端支持的 PWA 端对应） |
