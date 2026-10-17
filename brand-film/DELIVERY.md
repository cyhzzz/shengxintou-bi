# 省心投 BI 品牌宣传片 — 交付说明

交付物：`film/renders/final.mp4`（30s / 1920×1080 / 30fps / H.264 + AAC 48kHz 立体声 / 50.7 MB）
官网版：`website/assets/film/shengxintou-brand-film.mp4`（同内容，CRF 30 网页压缩，4.1 MB）+ `poster.jpg`
工程：`src/index.tpl.html` + `src/build.py` + `audio/score.py` + `audio/score_lib.py` + `shot-list.md` + `copy.md` + `assets.md`

---

## 1. 四道质量闸门（全部 0 failed）

| 闸门 | 检查对象 | 结果 |
| --- | --- | --- |
| `film_audit.py` | 代码层：tween 密度、ease 多样性、入场机理、转场、每幕 timed events、颗粒质感、字体本地化、logo 与官方图、copy 覆盖 | **0 failed**（229 tweens / 16 eases / 12 mechanics / 4 non-crossfade transitions） |
| `layout_audit.mjs` | 布局层：逐 0.1s seek，text hidden / collision / clipped / safe-area 48px / parked off-edge / corner logo | **0 failed**（六项全 0） |
| `frame_audit.py` | 像素层：median coverage ≥0.065、detail ≥0.065、motion ≥0.025、longest still ≤2.5s、thinnest act ≥0.04 | **0 failed**（coverage 0.213 / detail 0.130 / motion 0.044 / longest still 0.000s / thinnest act 0.180） |
| `reveal_audit.py` | 显隐层：CSS 初始 `opacity:0` 的元素必须有时序动画把它变可见（支持 `"#bdg"+i` 动态拼接目标与 `querySelectorAll` 变量目标） | **PASS** 133/133 |

## 2. 第三轮复核修复（用户三条意见，2026-10-17）

### 2.1 屏幕数字全部脱敏

用户意见：「前面的数字都要脱敏，现在还是有数字」。原片指标卡与看板数字为示意数值（123 / 1,847 / 986 / 73%）且四端同步进度条显示 12%→100%，均已改为**掩码呈现**：

- act 1 指标卡：`××× 线索成本 / ××× 开户成本 / ××× 有效户成本 / ××%`；
- act 2 看板数字：保留 0.9s「掩码扰动」入场动画（×/＊/* 三态循环，**确定性字符表**，不用 `Math.random`——逐帧 seek 会乱序），落定 `××× / ××× / ××× / ××%`；
- act 4 同步进度：进度条填充动画保留，数值恒显 `××%`。
- 字号由 64px 降为 46px：`×` 在 Noto CJK 字体中近全宽，三个 × 宽 192px 会超出 164px 排布间距（layout_audit collision 实测捕获）。

**字体子集重建**：原 woff2 子集不含任何星号类字形，掩码字符会变方框。新增 `.gates/rebuild_fonts.py`：以系统可变字体 `C:/Windows/Fonts/NotoSansSC-VF.ttf` 按 400/700/900 三个字重实例化并重新子集化（charset = chars.txt + 可打印 ASCII + 标点 + 掩码字形 `× ＊ *`），幂等。运行 `build.py` 后必须重跑本脚本。

屏幕上仅存的数字为**结构性文字而非数据**：日历热力图坐标轴「1月–12月」（示意排布）与标题「内容平台 8 阶段 / 应用市场 9 阶段」（README 产品能力原文）。如需一并抹除请告知。

### 2.2 落版 logo 白底转透明

用户意见：「最后画面里头的 logo 图是白底的，白色要换成透明」。原锁标为白底 PNG，在浅色底上呈现为一块白色矩形。新增 `.gates/make_logo_transparent.py`：color-to-alpha（灰度 ≥250 全透明、≤234 不透明，16 级斜坡），并对边缘像素做**白底反预乘**，抗锯齿边缘保留真实蓝色而非浅色晕边。从仓库源图重建，幂等。落版已无任何白板。

### 2.3 漏斗每层补阶段词

用户意见：「漏斗为啥有几行是没有字的」。原实现只把 6 个阶段词抽样映射到 8/9 层，多数层为空。现改为**每层一个阶段词**，且直接采用产品真实漏斗口径：

- 左（内容平台 8 阶段）：广告曝光 → 客户点击 → 客户线索 → 客户开口 → 有效线索 → 剔除存量 → 成功开户 → 有效户（前端 ConversionFunnel 页口径原文）；
- 右（应用市场 9 阶段）：激活APP → 开户注册 → 注册身份证 → 注册银行卡 → 提交开户 → 开户成功 → 新开户 → 入金 → 有效户（后端 `app_market.py::FUNNEL_STAGES` 口径原文）。
- 字号按层宽自适应（梯形可见宽度中点收窄时自动降字号，24px → 最低 15px），底层窄层文字不再被裁。
- 连带移除三个悬浮结果标签（新开户/入金/有效户）——层内已有阶段词，悬浮标签属重复信息。

## 3. 数据安全：真实截图已高斯模糊

用户复核意见：「不得使用真实数据，真实截图必须高斯模糊掉」。已落实：

- `assets/dashboard-preview.png`（真实产品截图，原图含**可读真实业务数据**——趋势曲线与开户日历热力图）以 **σ=22** 高斯模糊后入片，仅保留色彩节奏，无任何可读文字/数据；用于 act 4 四端设备屏幕。
- `assets/architecture.png`（内部架构图，无业务数据但属真实截图）以 **σ=8** 模糊后作 act 4 弱底纹。
- 模糊由 `.gates/blur_assets.py` 从仓库原始路径重新生成，幂等可重跑；manifest 与安全说明已写入 `assets.md`。
- 画面中所有图表（趋势图、日历热力图、双漏斗、指标卡）均为代码绘制示意，不来自真实数据。

## 4. 第二轮复核修复（热力图 + 双漏斗重设计）

用户复核意见：「漏斗、热力图的示意样式很奇怪」。抽帧放大后确认两项根因并重设计：

- **热力图**：原为 24 个同色蓝圆角方块（无强度层次、像通用网格），且趋势折线穿越面板标题、与方块区重叠。重设计为**日历式热力图**：12 月 × 7 星期排布、6 级品牌蓝强度阶（确定性图样，稀疏热点）、月份/星期轴标签、「少 → 多」图例；面板重排为左「趋势分析」卡（平滑曲线 + 面积 + 虚线副线 + 网格线）+ 右「开户日历热力图」卡，消除重叠。
- **双漏斗**：原实现条形高度公式远大于堆叠间距，8/9 条互相重叠成一整块实心蓝板。重设计为**逐层收窄的梯形漏斗**：层间留隙、上宽 340px → 下宽 120px、蓝阶由浅入深、阶段词放入层内，层数与标题一致。
- 修复过程中另捕获三处细节缺陷：漏斗容器漏 `left:50%` 导致整体左偏 180px；`clip-path` 百分比误按容器宽计算导致底层文字被裁；`#pulseRing` 因 `fromTo` 的 immediateRender 从 t=0 即可见（旧版同款缺陷，已加 `immediateRender:false`）。

## 5. 第一轮修复的关键缺陷（标题不可见）

渲染完成后抽帧复核时发现**全片主标题实际不可见**，已定位根因并修复：

- **根因**：8 个标题元素的 CSS 初始态是 `opacity:0`，但它们的 GSAP tween 只动画了 `yPercent`（遮罩上推），从未把 opacity 拉到 1 —— 遮罩动画不等于显现。同类问题还影响 `#a2n0-3`、`#river`、`#sConnect`、`#syncBar`、`#lockTag`。
- **为什么闸门没抓到**：`layout_audit` 的 text hidden 判定是「被后绘制的实色块遮挡」，`opacity:0` 的元素被直接跳过；`frame_audit` 只看像素覆盖/运动。代码审计也只查 copy 字符串是否出现在源码里。
- **修复**：补 opacity 显现；并新增 `reveal_audit.py` 闸门，把这类缺陷纳入常态拦截。
- **连带修复**：标题恢复可见后暴露出 16 处布局冲突，已按实测矩形逐项调整。

## 6. 音频

原创配乐 30s / 120 BPM / G 大调，五幕结构（pad → 鼓组进入 → 漏斗 marimba → 全 groove → 落版 swell）。
混流后实测：**Integrated −14.4 LUFS / True Peak −1.4 dBTP / LRA 6.0 LU**（目标 −14 LUFS / TP −1.5，TP 因 AAC 编码过冲高出 0.1 dB，可闻度为零）。
工程文件 `audio/score.py`（写 WAV 前强制校验三道闸门印）。

## 7. 需要用户确认的两件事

| 级别 | 事项 | 说明 |
| --- | --- | --- |
| **高** | logo 是位图 | `assets/logo-symbol.png` / `logo-vertical.png` 均为栅格 PNG（1440×1457），落版放到 400px（<1x 采样，尚可）。film_audit 对位图 logo 持续告警。**建议索取矢量文件（SVG）后重渲落版**。 |
| **中** | INVENTED 文案 | `copy.md` 已逐条标注：hook 句「投放散落四处，转化却像黑盒？」、PWA 端标题「Web 看板」。**均为示意文案**，对外发布前请确认口径。屏幕数字已全部掩码（见 2.1），不再有示意数值。 |
| **低** | 模糊后的设备屏幕 | act 4 设备屏内的产品截图已按数据安全要求重度模糊（σ=22），呈现为柔和色块；如希望设备屏更有"界面感"，可改为纯代码绘制的示意 UI（无真实截图依赖）。 |

## 8. 官网接入

`website/index.html` 新增「品牌影片」section（位于「界面预览」与「四端支持」之间），导航栏加入入口；视频 `preload="none"` + poster 图，点击才加载，不拖慢首屏。已用无头 Chrome 校验：区块渲染正常（1200×676，16:9）、资源全部可解析、无 console/page 错误。GitHub Pages 工作流会自动部署，无需额外配置。

## 9. 复现方式

```bash
cd brand-film
.venv/Scripts/python.exe .gates/blur_assets.py            # 真实截图高斯模糊 → film/assets/
.venv/Scripts/python.exe .gates/make_logo_transparent.py  # 落版 logo 白底转透明
python src/build.py                                       # 模板 → film/index.html + chars.txt
.venv/Scripts/python.exe .gates/rebuild_fonts.py          # 重建三个字重字体子集（含掩码字形 × ＊ *）
python .gates/reveal_audit.py                             # 显隐闸门
python ~/.workbuddy/skills/code-brand-film/scripts/film_audit.py film/index.html
CHROME_PATH="C:/Users/cyhzz/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe" \
  node ~/.workbuddy/skills/code-brand-film/scripts/layout_audit.mjs film/index.html
cd film && HYPERFRAMES_BROWSER_PATH="C:/Users/cyhzz/.cache/puppeteer/chrome-headless-shell/win64-150.0.7871.24/chrome-headless-shell-win64/chrome-headless-shell.exe" \
  node_modules/.bin/hyperframes render . -o renders/silent.mp4     # 约 4.5 分钟
cd .. && python ~/.workbuddy/skills/code-brand-film/scripts/frame_audit.py film/renders/silent.mp4 --fps 10
.venv/Scripts/python.exe audio/score.py               # 重新生成配乐（会校验三道闸门印）
ffmpeg -y -i film/renders/silent.mp4 -i audio/score.wav -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "volume=0.5dB,alimiter=limit=0.8318:level=false:attack=5:release=50" \
  -ar 48000 -c:a aac -b:a 192k -movflags +faststart film/renders/final.mp4
# 官网资产
cd ../website && ffmpeg -y -i ../brand-film/film/renders/final.mp4 -c:v libx264 -crf 30 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k -ar 48000 assets/film/shengxintou-brand-film.mp4
```

环境注意事项（本机实测）：HyperFrames 渲染必须用 puppeteer 的 `chrome-headless-shell`（playwright 完整 chrome 的 `--version` 在沙箱里会挂起）；`layout_audit` 必须用 playwright 完整 chrome（headless-shell 在 `setViewport` 时协议错误崩溃）。Bash heredoc 会吞反斜杠，写 Python 正则必须用 Write 工具。

## 10. 第四轮优化（真实平台 logo，2026-10-17）

用户意见：「第一屏那些平台的 logo 没有用真实的，这个点还可以优化下」。原 act 1 的 10 个渠道徽章为通用蓝底文字块（抖音 / 腾讯 / 小红书 / 快手 / 小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果），现全部替换为**真实品牌 logo**：

- **来源**：9 个取自 simple-icons 官方 SVG（小红书 / 快手 / 小米 / 华为 / OPPO / VIVO / 荣耀 / 苹果 / 腾讯 QQ），注入各品牌官方色值（小红书 #FF2442、华为 #CF0A2C、VIVO #415FFF、OPPO #046A38、小米 #FF6900、快手 #FF4906、腾讯 QQ #12B7F5、苹果 / 荣耀 #000000）；抖音因字节系 CDN 被墙，按其官方音符形态 + 红蓝双色差用 SVG 路径忠实重建（非 AI 生成近似）。
- **形态**：白底圆角卡片（品牌蓝描边 + 柔和阴影）承载 logo，保留原有入场动画与推轨镜头；徽章坐标经 `layout_audit` 复核，推轨后无角落 / 碰撞 / 安全区越界。
- **资产**：`film/assets/logos/*.svg`（10 个），来源与授权已在 `assets.md` 登记。
- **闸门**：reveal / film / layout 三道前置闸门重跑 **0 failed**；frame 闸门在重渲后复测（见第 1 节更新）。
- **遗留**：落版锁标 `logo-symbol.png` 仍为 256px 栅格（第 7 节高优先级事项），如需可索取矢量后重渲落版；本次仅替换 act 1 散落徽章，不涉及落版。
