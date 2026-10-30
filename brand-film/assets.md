# Assets — 省心投 BI 品牌宣传片

## Manifest

| File | What | Source URL / origin | Fetched | Notes |
| --- | --- | --- | --- | --- |
| `assets/logo-symbol.png` | 品牌图形标志（透明背景 S 符号 + 4 颗数据粒子） | 仓库 `icon/LOGO.png`（用户项目自带，provided by user） | 2026-10-16 | 40 KB PNG；用于暗色背景上的符号展示 |
| `assets/logo-vertical.png` | 竖版品牌锁标：S 符号 +「省心投」+「SimpliAds」 | 仓库 `icon/logo-竖版.png`（用户项目自带，provided by user） | 2026-10-16 | 原图为白底，已由 `.gates/make_logo_transparent.py` 做 color-to-alpha（白底→透明，边缘抗锯齿保留）后入片；用于最终落版 |
| `assets/logo-horizontal.png` | 横版品牌锁标 | 仓库 `icon/logo-横版.png`（用户项目自带，provided by user） | 2026-10-16 | 白底横版；备用 |
| `assets/dashboard-preview.png` | 真实产品界面：互联网渠道数据概览（趋势分析 + 开户日历热力图） | 仓库 `frontend-react/src/assets/dashboard-preview.png`（用户项目自带，provided by user） | 2026-10-16 | **高斯模糊 σ=22 后入片**（`.gates/blur_assets.py` 从仓库源图重新生成）：原图含可读真实业务数据（趋势曲线、开户日历热力图），模糊后仅保留色彩节奏，无任何可读文字与数据；用于 act 4 四端设备屏幕内容 |
| `assets/architecture.png` | 官方系统架构图 | 仓库 `docs/images/architecture.png`（用户项目自带，provided by user） | 2026-10-16 | **高斯模糊 σ=8 后入片**（同上脚本）：无业务数据但属内部资料截图，模糊后作 act 4 弱底纹（opacity 0.10） |
| `assets/logos/douyin.svg` | 抖音品牌标（act 1 平台徽章） | 音符路径取自 Font Awesome Free 6.7.2 `brands/tiktok.svg`（CC BY 4.0，https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/brands/tiktok.svg）——与抖音同源的字节跳动音符标；抖音官方红蓝色差按品牌色重构（蓝 #2D8CFF / 红 #EE1C25 / 核心 #15171C） | 2026-10-17 | 字节官方 CDN（lf3-static.bytednsdoc.com）本环境不可达，未能直接取官方 SVG；以官方配色重构音符标，形态与抖音 App 图标一致 |
| `assets/logos/tencentqq.svg` | 腾讯（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/tencentqq.svg） | 2026-10-17 | 注入腾讯 QQ 品牌色 #12B7F5 |
| `assets/logos/xiaohongshu.svg` | 小红书（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg） | 2026-10-17 | 注入品牌色 #FF2442 |
| `assets/logos/kuaishou.svg` | 快手（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/kuaishou.svg） | 2026-10-17 | 注入品牌色 #FF4906 |
| `assets/logos/xiaomi.svg` | 小米（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaomi.svg） | 2026-10-17 | 注入品牌色 #FF6900 |
| `assets/logos/huawei.svg` | 华为（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/huawei.svg） | 2026-10-17 | 注入品牌色 #CF0A2C |
| `assets/logos/oppo.svg` | OPPO（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/oppo.svg） | 2026-10-17 | 注入品牌色 #046A38 |
| `assets/logos/vivo.svg` | vivo（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/vivo.svg） | 2026-10-17 | 注入品牌色 #415FFF |
| `assets/logos/honor.svg` | 荣耀（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/honor.svg） | 2026-10-17 | 注入品牌色 #000000 |
| `assets/logos/apple.svg` | 苹果（act 1 平台徽章） | simple-icons（https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/apple.svg） | 2026-10-17 | 注入品牌色 #000000 |

## 数据安全

- 宣传片不得携带任何可读真实业务数据。两张真实截图统一经 `.gates/blur_assets.py` 高斯模糊后才写入 `film/assets/`；脚本从仓库原始路径读取、幂等可重跑。
- 画面中所有图表（趋势图、日历热力图、双漏斗、指标卡）均为代码绘制的示意图，色彩与排布不来自真实数据；示意口径见 `copy.md` 的 INVENTED 标注。

## Logo check

| Check | Verdict |
| --- | --- |
| Right product | 省心投 BI 子产品标志；用于「券商广告投放 + 开户转化分析」产品，非母公司其它产品 |
| Current version | 与仓库 `icon/` 当前文件一致；README 及项目官网（GitHub Pages）均使用该套标志 |
| Right variant | 使用项目自带的竖版/横版锁标与白底 S 符号；最终落版采用竖版锁标，匹配品牌原设计 |
| Untouched | 仅做容器缩放 / 透明度 / 位移动画；未重绘、未改色、未拉伸、未添加额外阴影 |
| Resolution | logo-vertical.png 与 logo-horizontal.png 均为高清 PNG；logo-symbol.png 40 KB 小图标仅作小尺寸符号使用 |

## Searches run

- 用户项目仓库 `icon/` 目录：找到当前官方 logo 全套。
- 用户项目仓库 `frontend-react/src/assets/`：找到官方 dashboard 截图。
- 用户项目仓库 `docs/images/`：找到官方架构图。
- act 1 十个平台徽章的真实品牌 logo：字节官方 CDN 与 Wikimedia 本环境不可达，9 个取自 simple-icons 官方路径集（jsDelivr CDN，按各品牌官方色值注入 fill）；抖音为官方配色重构的音符标（路径来源见上表）。
- 未使用 logo 聚合站点或 AI 生成素材。
