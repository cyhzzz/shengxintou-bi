# -*- coding: utf-8 -*-
"""
对官网截图施加「适度模糊」脱敏——保留真实 UI 结构与配色，
仅让文字/数字不可读。

策略：
1. 保留原分辨率（1440x900），不做像素化
2. 高斯模糊半径 3（让文字笔画融合到不可读，但 UI 结构、图表形态、配色仍清晰）
3. 不做暖白蒙版覆盖（保留真实配色）
4. 不降饱和度（保留品牌色）
5. 不加抽象色块点缀

这样出来的是「真实界面 + 模糊滤镜」的效果——
像产品官网常见的带轻微模糊的产品截图，
但模糊到任何业务字段都无法辨识。

用法：
    .venv\Scripts\python.exe scripts/apply_preview_effect.py
"""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "website" / "assets" / "screenshots"


def soft_blur(path: Path):
    """
    适度高斯模糊：文字不可读，UI 结构仍清晰。
    """
    img = Image.open(path).convert("RGB")
    w, h = img.size

    # 高斯模糊半径 3——文字笔画融合到不可读，但 UI 结构、图表形态、配色仍清晰
    blurred = img.filter(ImageFilter.GaussianBlur(radius=3))

    blurred.save(path, quality=92)
    print(f"[soft-blur] {path}")


def main():
    for p in sorted(SRC_DIR.glob("*.png")):
        soft_blur(p)


if __name__ == "__main__":
    main()
