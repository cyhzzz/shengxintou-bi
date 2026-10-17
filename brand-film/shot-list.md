# Shot list — 省心投 BI 品牌宣传片（30 s / 1920×1080 / 16:9）

## Part 1 — sources

| Item | Value | Source |
| --- | --- | --- |
| Product's mandatory selling line | 「一屏聚合跨渠道开户数据，避免在多个投放后台与 CRM 之间手工对账」 | README.md 业务价值 |
| 3–5 concrete product behaviours | 1. 跨渠道开户数据一屏聚合（Dashboard）<br>2. 内容平台 8 阶段 + 应用市场 9 阶段双漏斗定位卡点<br>3. Web / 桌面 / Android / PWA 四端数据同步<br>4. 数据私有、开源、一键部署 | README.md 核心能力 / 业务价值；AGENTS.md 四端表格 |
| Required copy / CTA | 落版标语「省心投 BI — 让每分投放，都算得清」；CTA「开源 · 数据私有 · 一键部署」 | 用户提供标语；README / AGENTS.md 开源与部署描述 |
| Red lines | 不得出现真实客户手机号/资金/资产等敏感数据；不得宣称系统做上游 mapping/清洗；数值均为示意，不代表真实业务库 | 项目边界与数据安全红线 |
| Logo file | `assets/logo-vertical.png`（落版锁标）<br>`assets/logo-symbol.png`（透明 S 符号） | 项目仓库 `icon/` |
| Other brand assets | dashboard-preview.png（产品截图）<br>architecture.png（官方架构图） | 项目仓库 |
| Fonts | Noto Sans SC（中文正文/标题）<br>Inter / Space Grotesk（英文/数字） | Google Fonts 子集，本地 woff2 |

## Part 2 — the idea

- **Metaphor sentence (must contain a physical verb):** 让散落在各投放后台的数据粒子，沿着 S 形河流汇进同一块屏。
- **Where the metaphor comes from:** 品牌标志本身是一条 S 形蓝色河流/回环，周围环绕 4 颗「数据粒子」；README 的核心价值是「一屏聚合跨渠道开户数据」。
- **Palette:**
  - base `#F4F4F6`（接近项目 tokens.css 的 `--bg-page`，微暖浅灰，避免纯白平面感）
  - foreground `#15171C`
  - accent `#1890ff`（品牌蓝，作为高亮：标题强调、进度、粒子、光晕）
  - secondary `#40a9ff` / `#096dd9`
- **Beat grid:** 0.5 s（120 BPM）；6 / 12 / 19 / 25 / 30 秒为结构重音。
- **Signature transition:** S-swirl — 数据粒子/光点沿 logo 的 S 曲线轨道运动，贯穿多个 act 的入口与出口。
- **Studio ground:** N/A（非 footage-led，以代码重建 UI 为主）。

## Part 3 — acts

### Act 1 · 散落 · 0.0–6.0 s

- **Product behaviour shown:** hook — none（抛出「投放后台分散、转化难看清」的痛点）
- **On-screen copy:** 见 `copy.md`
- **Camera:** settle 1.05 → 1.0（0–6 s），最后 0.8 s 向 S 中心 slow push
- **Depth layers:** bg 浅灰渐变 +  faint S 粒子河流；mid 漂浮的渠道 badge；fg  headline
- **Exit transition into act 2:** persistent hand-off + S-swirl（signature）：S 符号保留并放大，数据粒子沿 S 曲线流入 act 2 的 dashboard
- **Music:** airy pad；粒子 tick 点缀；第 6 秒一个小 riser 进入下一幕

| t (s) | Element | Mechanic | Ease, duration |
| --- | --- | --- | --- |
| 0.0 | bg gradient + grain | fade in / crawl | linear 30 s (grain) |
| 0.2 | giant ghost word "投放" | lateral drift | power1.out 6 s |
| 0.4 | headline line 1 | line mask reveal | expo.out 0.8 |
| 0.8 | headline line 2 | line mask reveal | expo.out 0.8 |
| 1.2 | channel badges (10) | scale pop, stagger | back.out(2) 0.45 × 10 |
| 1.8 | S particle orbit | path motion start | sine.inOut 4 s |
| 2.4 | hook question | line mask reveal | expo.out 0.9 |
| 3.0 | logo S symbol | scale pop + blur-in | back.out(1.6) 0.7 |
| 3.6 | particles converge | scale / move toward S | power2.inOut 2.2 |
| 4.4 | small metric numbers | scale pop | back.out(2) 0.35 × 6 |
| 5.0 | camera push | dolly 1.0 → 1.10 + 右移 80px（保左侧文案在 48px 安全区内） | power2.inOut 1.6 |
| 5.6 | S path stroke | stroke draw along SVG | power2.inOut 0.6 |

### Act 2 · 聚合 · 6.0–12.0 s

- **Product behaviour shown:** 一屏聚合跨渠道开户数据（dashboard 浮现、指标卡与趋势图）
- **On-screen copy:** 见 `copy.md`
- **Camera:** lateral push-in from x 760 → 0（6.0–6.85），然后 slow push 1.0 → 1.06（9–12）
- **Depth layers:** bg 网格线 + dashboard 截图 mask；mid metric cards + chart；fg headline + 平台标签
- **Exit transition into act 3:** lateral whip + S-swirl（signature）：dashboard 向右飞出，粒子从右侧甩入双漏斗场景
- **Music:** groove 进入；kick + hat；每张 metric card 一个 pluck；图表描线时一个 bell

| t (s) | Element | Mechanic | Ease, duration |
| --- | --- | --- | --- |
| 6.0 | scene | iris reveal | expo.out 0.5 |
| 6.1 | 4 metric cards | 3D card fly-in, stagger | expo.out 0.7 × 4 |
| 6.4 | headline | line mask reveal | expo.out 0.8 |
| 6.8 | subheadline | line mask reveal | expo.out 0.8 |
| 7.0 | chart axes | stroke draw | power2.out 0.5 |
| 7.2 | chart line | stroke draw | power2.inOut 1.0 |
| 7.4 | chart area fill | scaleY 0 → 1 | power2.out 0.6 |
| 7.6 | metric numbers | number count-up | power2.out 0.8 |
| 8.0 | heatmap cells | scale pop / fade, stagger | back.out(1.5) 0.25 × 24 |
| 8.6 | platform tabs | blur-in | power2.out 0.4 |
| 9.0 | camera slow push | scale 1.0 → 1.06 | power1.out 3.0 |
| 9.6 | second card cluster | lateral push-in | expo.out 0.7 |
| 10.4 | sync pulse ring | pulse ring | power2.out 0.7 |
| 11.0 | metric cards breathe | yoyo scale | sine.inOut 0.6, repeat 2 |
| 11.6 | dashboard exit | x 0 → 900 + opacity | power3.in 0.6 |

### Act 3 · 双漏斗 · 12.0–19.0 s

- **Product behaviour shown:** 内容平台 8 阶段 + 应用市场 9 阶段双漏斗，定位转化卡点
- **On-screen copy:** 见 `copy.md`
- **Camera:** settle 1.04 → 1.0，然后 push in 到瓶颈点 1.12（16–19）
- **Depth layers:** bg 漏斗容器轮廓；mid 左右漏斗条 + 阶段标签；fg headline + 瓶颈标记
- **Exit transition into act 4:** zoom-through（signature）：从瓶颈标记中心放大穿过，进入四端同步场景
- **Music:** drums 变薄（仅 hat）；漏斗条用 marimba；17–19 s riser 蓄力

| t (s) | Element | Mechanic | Ease, duration |
| --- | --- | --- | --- |
| 12.0 | scene | fade in | power1.out 0.4 |
| 12.1 | headline | line mask reveal | expo.out 0.7 |
| 12.4 | subheadline | line mask reveal | expo.out 0.7 |
| 12.6 | left funnel title | blur-in | power2.out 0.4 |
| 12.8 | right funnel title | blur-in | power2.out 0.4 |
| 13.0 | left funnel bars | bar/fill growth, stagger | power3.out 0.5 × 8 |
| 13.4 | right funnel bars | bar/fill growth, stagger | power3.out 0.5 × 9 |
| 13.8 | stage labels | scale pop | back.out(2) 0.35 × 12 |
| 14.2 | bottleneck marker | pulse ring + scale | power2.out 0.6 |
| 14.8 | conversion numbers | number count-up | power2.out 0.7 |
| 15.4 | 新开户/入金/有效户 labels | blur-in | power2.out 0.4 |
| 16.0 | funnels rotate 3D | rotationY ±8° | power1.inOut 1.0 |
| 16.6 | S particle connects funnels | path stroke draw | power2.inOut 1.2 |
| 17.2 | camera zoom to marker | scale 1.04 → 1.12 | power2.inOut 1.2 |
| 18.4 | marker glow | yoyo opacity/scale | sine.inOut 0.6, repeat 2 |

### Act 4 · 四端 · 19.0–25.0 s

- **Product behaviour shown:** Web / 桌面 / Android / PWA 四端同时看到同一份数据并同步
- **On-screen copy:** 见 `copy.md`
- **Camera:** settle 0.92 → 1.0（19–20），slow pull 1.0 → 0.98（23–25）
- **Depth layers:** bg 连接网线；mid 四个设备框；fg headline + 同步百分比
- **Exit transition into act 5:** collapse to point + S-swirl（signature）：四个设备缩小并沿 S 曲线汇入最终 logo
- **Music:** 全 groove + 明亮和弦；每个设备 entrance 一个 whoosh；同步点一个 blip；24.5 s swell 进入落版

| t (s) | Element | Mechanic | Ease, duration |
| --- | --- | --- | --- |
| 19.0 | scene | zoom-through entrance | expo.out 0.5 |
| 19.1 | headline | line mask reveal | expo.out 0.8 |
| 19.4 | platform list | character typing | set per char 1.0 |
| 19.7 | laptop frame | 3D card fly-in | expo.out 0.7 |
| 20.0 | desktop frame | 3D card fly-in | expo.out 0.7 |
| 20.3 | phone frame | 3D card fly-in | expo.out 0.7 |
| 20.6 | PWA/browser window | 3D card fly-in | expo.out 0.7 |
| 20.9 | dashboard screenshot | mask reveal per device | power1.out 0.5 |
| 21.2 | connection lines | stroke draw | power2.out 0.6 |
| 21.6 | sync progress | number count-up + bar fill | power1.inOut 1.4 |
| 22.2 | traveling dot | path motion along connection | power1.inOut 1.0 |
| 22.8 | refresh badges | scale pop | back.out(2) 0.35 × 4 |
| 23.4 | camera pull | scale 1.0 → 0.98 | power1.out 2.0 |
| 24.0 | devices tilt | rotationY ±3° | power1.inOut 0.8 |
| 24.6 | collapse to point | scale 1 → 0.15, opacity → 0 | power3.in 0.6 |

### Act 5 · 锁屏 · 25.0–30.0 s

- **Product behaviour shown:** sign-off — none
- **On-screen copy:** 见 `copy.md`
- **Camera:** final slow push 1.0 → 1.03（25.5–30）
- **Depth layers:** bg 浅灰径向渐变；mid logo 锁标；fg 标语 + CTA
- **Exit transition:** none
- **Music:** 低音 boom + 大和弦落在 25.8–26.2；bell tail 延续到结尾

| t (s) | Element | Mechanic | Ease, duration |
| --- | --- | --- | --- |
| 25.0 | bg gradient | fade in | power1.out 0.5 |
| 25.1 | S symbol | scale pop | back.out(2) 0.7 |
| 25.4 | 省心投 + SimpliAds | blur-in | expo.out 0.8 |
| 25.8 | tagline | line mask reveal | expo.out 0.8 |
| 26.2 | CTA | fade / y 16 → 0 | power2.out 0.6 |
| 26.6 | github URL | fade in | power2.out 0.5 |
| 26.8 | rule line | stroke draw / scaleX | expo.inOut 0.5 |
| 27.0 | camera push | scale 1.0 → 1.03 | sine.out 3.0 |
| 27.5 | orbiting particles | yoyo path motion | sine.inOut 2.5, repeat 1 |
| 29.0 | final settle | hold + grain crawl | — |

## Zone map

| Act | Headline zone | Product zone | Accent / logo zone | Empty on purpose |
| --- | --- | --- | --- | --- |
| 1 | left, y 190–630（两行大标题 + hook 问句） | floating badges + S symbol, mid-right y 220–820 | none（logo 仅在落版） | bottom-left corner |
| 2 | top-left, y 120–360 | dashboard + cards, center-right y 320–940 | metric numbers / chart | top-right |
| 3 | top-left (left 200), y 105–330 | two funnels, lower band y 410–940 | bottleneck marker center | far left/right |
| 4 | top-left, y 140–260 | four device frames, mid band y 300–900 | sync badge center | background |
| 5 | tagline center, y 660–760 | S logo, center y 260–620 | CTA bottom y 840–940 | sides |

## Part 4 — self-check before coding

- [x] Every on-screen line has a source, or is flagged as invented
- [x] ≥ 2 acts depict a real product behaviour（act 2 Dashboard、act 3 双漏斗、act 4 四端）
- [x] ≥ 8 distinct mechanics across the table（line mask reveal, character typing, scale pop, 3D card fly-in, number count-up, stroke draw, bar/fill growth, pulse ring, blur-in, yoyo breathe, lateral push-in, path motion）
- [x] ≥ 3 distinct transitions；at most one plain crossfade（persistent hand-off + S-swirl, lateral whip, zoom-through, collapse to point）
- [x] One persistent element crosses at least one act boundary（S 符号 / 数据粒子）
- [x] Exactly one pull-back in the whole film（act 4 末尾 23.4 s）
- [x] The final landing is on a downbeat（26 s 附近，配合低音 boom）
- [x] The real logo file is used；nothing is redrawn as a primitive
- [x] The logo appears in the lockup only — no corner mark through the film
- [x] The end frame has no type baked in, and the product doesn't cross any type；lockup is one group centered
