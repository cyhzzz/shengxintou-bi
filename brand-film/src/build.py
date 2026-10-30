#!/usr/bin/env python3
"""build.py — template → film/index.html, and regenerate the CJK font subset.

Copy next to your film's `src/` and edit the CONTENT blocks at the top.
    python3 src/build.py      # writes film/index.html + src/chars.txt
"""
import os
import re
import math

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(D)

# ==========================================================================
# CONTENT — every repetitive element in the film is defined here, once.
# ==========================================================================

# Act 1: scattered channel badges (content platforms + app markets) — real brand logos
# 坐标约束（layout_audit）：推轨后（scale 1.10 + x 80）任何徽章中心不得同时
# cx>1536 且 cy>864（角落判定），右缘缩放后 ≤1920（off-edge 判定）。
BADGES = [
    ("抖音", 880, 470, "douyin.svg"), ("腾讯", 940, 640, "tencentqq.svg"), ("小红书", 1420, 350, "xiaohongshu.svg"),
    ("快手", 1240, 560, "kuaishou.svg"), ("小米", 1600, 470, "xiaomi.svg"), ("华为", 880, 760, "huawei.svg"),
    ("OPPO", 1080, 850, "oppo.svg"), ("VIVO", 1250, 750, "vivo.svg"), ("荣耀", 1430, 640, "honor.svg"),
    ("苹果", 1600, 640, "apple.svg"),
]

# Act 1: small metric chips — values masked with × (no readable digits on screen)
METRICS = [
    ("×××", "线索成本", 360, 720),
    ("×××", "开户成本", 660, 720),
    ("×××", "有效户成本", 360, 840),
    ("××%", "", 660, 840),
]

# Act 2: calendar heatmap inside the dashboard panel (12 months x 7 weekdays, schematic)
HEAT_ORIGIN = (1354, 512)          # grid top-left, screen coords (inside #cardHeat)
HEAT_CELL = 35
HEAT_GAP = 4
HEAT_COLS = 12
HEAT_ROWS = 7
HEAT_STEPS = ["#E6F4FF", "#BAE0FF", "#91D5FF", "#40A9FF", "#1890FF", "#096DD9"]
MONTHS = [f"{m}月" for m in range(1, 13)]
WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]

# Act 1 / Act 5: data particles
PARTICLES = 8
ORBIT = 8

# Act 4: typed platform line
TYPED = "Web · 桌面 · 安卓 · PWA"

# Act 4: four device frames
DEVICES = [
    ("laptop", "互联网渠道数据概览", 200, 430, 560, 360),
    ("desktop", "趋势分析", 820, 470, 520, 340),
    ("phone", "开户转化", 1180, 620, 250, 390),
    ("pwa", "Web 看板", 1480, 450, 360, 320),
]


def _badges():
    out = []
    for i, (name, x, y, logo) in enumerate(BADGES):
        out.append(
            f'<div class="badge" id="bdg{i}" style="left:{x}px;top:{y}px">'
            f'<img class="bl" src="assets/logos/{logo}" alt="{name}" /></div>')
    return '\n'.join(out)


def _metrics():
    out = []
    for i, (num, label, x, y) in enumerate(METRICS):
        lab = f'<span class="ml">{label}</span>' if label else ''
        out.append(
            f'<div class="mchip" id="m{i}" style="left:{x}px;top:{y}px">'
            f'<span class="mv">{num}</span>{lab}</div>')
    return '\n'.join(out)


def _heat_level(r, c):
    """确定性强度图样：带状波动 + 稀疏热点。看起来像真实日历热力图，但不含任何真实数据。"""
    v = math.sin(c * 1.05 + r * 0.55) + 0.6 * math.cos(c * 0.45 - r * 1.25)
    if (c * 7 + r * 5) % 13 == 0:
        v += 1.7
    if v > 1.6:
        return 5
    if v > 1.0:
        return 4
    if v > 0.35:
        return 3
    if v > -0.25:
        return 2
    if v > -0.85:
        return 1
    return 0


def _heatmap():
    x0, y0 = HEAT_ORIGIN
    pitch = HEAT_CELL + HEAT_GAP
    out = []
    for c in range(HEAT_COLS):
        out.append(
            f'<div class="hml" style="left:{x0 + c * pitch - 9}px;top:{y0 - 34}px;'
            f'width:52px;height:24px">{MONTHS[c]}</div>')
    for r in range(HEAT_ROWS):
        out.append(
            f'<div class="hml" style="left:{x0 - 34}px;top:{y0 + r * pitch}px;'
            f'width:26px;height:{HEAT_CELL}px">{WEEKDAYS[r]}</div>')
    for r in range(HEAT_ROWS):
        for c in range(HEAT_COLS):
            lvl = _heat_level(r, c)
            out.append(
                f'<div class="hm" id="cell{r * HEAT_COLS + c}" '
                f'style="left:{x0 + c * pitch}px;top:{y0 + r * pitch}px;'
                f'width:{HEAT_CELL}px;height:{HEAT_CELL}px;background:{HEAT_STEPS[lvl]}"></div>')
    swatches = ''.join(f'<i style="background:{s}"></i>' for s in HEAT_STEPS)
    out.append(
        f'<div class="hmleg" style="left:{x0}px;top:{y0 + HEAT_ROWS * pitch + 26}px">'
        f'<span>少</span>{swatches}<span>多</span></div>')
    return '\n'.join(out)


def _particles():
    out = []
    for i in range(PARTICLES):
        ang = i * (360 / PARTICLES)
        out.append(f'<div class="pt" id="p{i}"></div>')
    return '\n'.join(out)


def _orbit():
    out = []
    for i in range(ORBIT):
        out.append(f'<div class="opt" id="op{i}"></div>')
    return '\n'.join(out)


def _typed():
    return ''.join(
        f'<span class="ch">{"&nbsp;" if ch == " " else ch}</span>' for ch in TYPED)


def _devices():
    out = []
    for i, (kind, title, x, y, w, h) in enumerate(DEVICES):
        bar = '<div class="dbar"></div>' if kind in ('laptop', 'desktop', 'pwa') else ''
        out.append(
            f'<div class="dev" id="dev{i}" data-kind="{kind}" style="left:{x}px;top:{y}px;'
            f'width:{w}px;height:{h}px">{bar}'
            f'<img class="dimg" src="assets/dashboard-preview.png" alt="" />'
            f'<div class="dtitle">{title}</div></div>')
    return '\n'.join(out)


# ==========================================================================
# BUILD
# ==========================================================================
tl = open(os.path.join(D, 'index.tpl.html')).read()

tl = (tl.replace('__BADGES__', _badges())
        .replace('__METRICS__', _metrics())
        .replace('__HEATMAP__', _heatmap())
        .replace('__HEAT_N__', str(HEAT_COLS * HEAT_ROWS))
        .replace('__PARTICLES__', _particles())
        .replace('__ORBIT__', _orbit())
        .replace('__TYPED__', _typed())
        .replace('__DEVICES__', _devices()))

out = os.path.join(ROOT, 'film', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w').write(tl)

# every CJK/ideograph character on screen, plus the punctuation the film uses
cjk = sorted(set(ch for ch in tl if ord(ch) > 0x2E80)
             | set('：·｜（）「」，。✓→←↑↓％'))
open(os.path.join(D, 'chars.txt'), 'w').write(''.join(cjk))

print(f'{len(tl)} bytes → {out}')
print(f'{len(cjk)} cjk chars → {os.path.join(D, "chars.txt")}')
