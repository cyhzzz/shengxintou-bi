"""
Topographic Repose icon set — 省心投 BI 核心能力图标
设计语言：单色（品牌蓝 #1890ff）、2px 细线、几何精确、大量留白
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).parent
INK = (24, 144, 255, 255)
PAPER = (245, 242, 237, 0)  # 透明背景
SIZE = 240
STROKE = 2.4
M = 48  # 边距，留出 60% 负空间


def new_canvas():
    img = Image.new("RGBA", (SIZE, SIZE), PAPER)
    d = ImageDraw.Draw(img)
    return img, d


def save(img, name):
    img.save(OUT / f"{name}.png", "PNG")
    print(f"[icon] {OUT / (name + '.png')}")


# ---------- 1. 双漏斗转化分析 ----------
# 两个并排的小漏斗：上口宽下口窄，下方一根细长出口
def funnel_icon():
    img, d = new_canvas()
    # 左漏斗
    left_top = [(M + 16, M + 8), (M + 88, M + 8)]
    left_bot = [(M + 42, M + 96), (M + 62, M + 96)]
    # 梯形四点（顺时针）
    d.line(
        [
            (left_top[0][0], left_top[0][1]),
            (left_top[1][0], left_top[1][1]),
            (left_bot[1][0], left_bot[1][1]),
            (left_bot[0][0], left_bot[0][1]),
            (left_top[0][0], left_top[0][1]),
        ],
        fill=INK,
        width=int(STROKE),
    )
    # 出口管
    d.line(
        [(M + 52, M + 96), (M + 52, M + 140)],
        fill=INK,
        width=int(STROKE),
    )

    # 右漏斗（同结构，向右平移）
    ox = 92
    lt = [(left_top[0][0] + ox, left_top[0][1]), (left_top[1][0] + ox, left_top[1][1])]
    lb = [(left_bot[0][0] + ox, left_bot[1][1] - 0), (left_bot[1][0] + ox, left_bot[1][1])]
    d.line(
        [
            (lt[0][0], lt[0][1]),
            (lt[1][0], lt[1][1]),
            (lb[1][0], lb[1][1]),
            (lb[0][0], lb[1][1]),
            (lt[0][0], lt[0][1]),
        ],
        fill=INK,
        width=int(STROKE),
    )
    d.line(
        [(M + 52 + ox, M + 96), (M + 52 + ox, M + 140)],
        fill=INK,
        width=int(STROKE),
    )

    # 底部基准线（一条克制的水准线）
    d.line(
        [(M + 16, M + 168), (SIZE - M - 16, M + 168)],
        fill=INK,
        width=1,
    )
    save(img, "feature-funnel")


# ---------- 2. 全渠道获客概览 ----------
# 中心节点 + 四方节点 + 细线连接（星座/网络拓扑）
def network_icon():
    img, d = new_canvas()
    cx, cy = SIZE // 2, SIZE // 2
    r_outer = 64
    r_inner = 6
    # 四个外围节点（北南东西）
    nodes = [
        (cx, cy - r_outer),
        (cx + r_outer, cy),
        (cx, cy + r_outer),
        (cx - r_outer, cy),
    ]
    # 连接线（先画，让节点压在上方）
    for nx, ny in nodes:
        d.line([(cx, cy), (nx, ny)], fill=INK, width=int(STROKE))

    # 中心节点：双圈
    d.ellipse(
        [cx - r_inner - 4, cy - r_inner - 4, cx + r_inner + 4, cy + r_inner + 4],
        outline=INK,
        width=int(STROKE),
    )
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=INK)

    # 外围节点：小圆环
    for nx, ny in nodes:
        nr = 6
        d.ellipse(
            [nx - nr, ny - nr, nx + nr, ny + nr],
            outline=INK,
            width=int(STROKE),
        )

    # 外圈虚线圆（暗示"全域"边界）
    bbox = [cx - r_outer - 18, cy - r_outer - 18, cx + r_outer + 18, cy + r_outer + 18]
    d.ellipse(bbox, outline=INK, width=1)
    save(img, "feature-network")


# ---------- 3. 标准化数据导入 ----------
# 三条平行水平线（数据行）+ 上方箭头进入容器开口
def import_icon():
    img, d = new_canvas()
    # 容器开口（顶部一条横线，两端略短）
    d.line([(M + 8, M + 36), (SIZE - M - 8, M + 36)], fill=INK, width=int(STROKE))
    # 左右容器壁（向下延伸）
    d.line([(M + 8, M + 36), (M + 8, M + 120)], fill=INK, width=int(STROKE))
    d.line([(SIZE - M - 8, M + 36), (SIZE - M - 8, M + 120)], fill=INK, width=int(STROKE))

    # 向下箭头（数据流入）
    ax = SIZE // 2
    d.line([(ax, M + 4), (ax, M + 32)], fill=INK, width=int(STROKE))
    d.line([(ax - 6, M + 24), (ax, M + 32)], fill=INK, width=int(STROKE))
    d.line([(ax + 6, M + 24), (ax, M + 32)], fill=INK, width=int(STROKE))

    # 容器内三行"数据"（短中长，暗示结构化记录）
    rows_y = [M + 60, M + 80, M + 100]
    rows_x_start = [M + 24, M + 24, M + 24]
    rows_x_end = [SIZE - M - 36, SIZE - M - 60, SIZE - M - 24]
    for y, xs, xe in zip(rows_y, rows_x_start, rows_x_end):
        d.line([(xs, y), (xe, y)], fill=INK, width=int(STROKE))

    # 底部基准线
    d.line(
        [(M + 8, M + 156), (SIZE - M - 8, M + 156)],
        fill=INK,
        width=1,
    )
    save(img, "feature-import")


# ---------- 4. 数据新鲜度与备份 ----------
# 双圆环（同步符号）+ 一个小指示点
def sync_icon():
    img, d = new_canvas()
    cx, cy = SIZE // 2, SIZE // 2
    r_outer = 56
    r_inner = 38

    # 外环（缺口在右上）—— 用 arc 画 3/4 圆
    # PIL arc: 0=3点钟方向，逆时针。要画从 315°到 45°（即跳过右上 45°→315°）
    # 即画 45° 到 315°
    bbox_o = [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer]
    d.arc(bbox_o, start=50, end=320, fill=INK, width=int(STROKE))

    # 外环箭头头（在 320° 位置，指向继续旋转方向）
    # 320° = 左下偏下，箭头朝下
    import math
    end_angle = math.radians(320)
    ex = cx + r_outer * math.cos(end_angle)
    ey = cy - r_outer * math.sin(end_angle)  # PIL y 反向
    # 箭头两翼
    wing = 8
    d.line(
        [(ex - wing, ey), (ex + 2, ey - wing)],
        fill=INK,
        width=int(STROKE),
    )
    d.line(
        [(ex + wing, ey + 2), (ex + 2, ey - wing)],
        fill=INK,
        width=int(STROKE),
    )

    # 内环（缺口在左下，反向）—— 画 225° 到 45° (即跳过 45°→225°)
    bbox_i = [cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner]
    d.arc(bbox_i, start=230, end=140, fill=INK, width=int(STROKE))

    # 中心点
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=INK)

    save(img, "feature-sync")


if __name__ == "__main__":
    funnel_icon()
    network_icon()
    import_icon()
    sync_icon()
    print("done")
