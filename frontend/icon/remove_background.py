"""
去除SVG logo背景色，使其变成透明背景
"""
import re
import os
from pathlib import Path

def remove_svg_background(input_file, output_file=None):
    """
    去除SVG文件的背景色

    Args:
        input_file: 输入SVG文件路径
        output_file: 输出SVG文件路径（可选，默认覆盖原文件）
    """
    # 读取SVG文件
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 方法1: 删除填充整个画布的背景矩形/路径
    # 匹配覆盖整个视图的大背景元素（通常是第一个或前几个元素）
    # 特征：fill="#f9f9f9" 或其他浅色，覆盖大面积

    # 删除背景矩形（常见格式）
    patterns_to_remove = [
        # 格式1: fill="#f9f9f9" 或类似的浅色背景
        r'<rect[^>]*fill="#[fF]{6}[0-9a-fA-F]{0,2}"[^>]*>',
        r'<rect[^>]*fill="#[eE][6eE][eE5][dDfF][0-9a-fA-F]{0,2}"[^>]*>',

        # 格式2: 带有path的背景（如这个文件的情况）
        r'<g><path[^>]*fill="#f9f9f9"[^>]*d="M[^"]*Z"/></g>',
        r'<path[^>]*fill="#f9f9f9"[^>]*d="M -0\.5,-0\.5[^"]*"/>',
    ]

    original_content = content
    for pattern in patterns_to_remove:
        content = re.sub(pattern, '', content)

    # 如果上述方法没有匹配到，使用更精确的方法
    if content == original_content:
        # 查找并删除第一个可能是背景的元素
        # 背景特征：1) 前几个元素之一 2) 填充色为浅色 3) 覆盖大面积

        # 删除所有 <g> 标签中 fill 为浅色的 path
        # 浅色定义：以 #f, #e, #d 开头，或 #ffffff, #f0f0f0 等
        def remove_light_backgrounds(match):
            tag_content = match.group(0)
            # 检查是否为背景色
            if re.search(r'fill="#[fF]{6}[0-9a-fA-F]{0,2}"', tag_content):
                return ''  # 删除
            if re.search(r'fill="#[eE][6eE][eE5][dDfF]"', tag_content):
                return ''  # 删除
            if re.search(r'fill="#[dD][dDfF][dDfF][fF]{0,2}"', tag_content):
                return ''  # 删除
            return tag_content

        # 处理 <g><path.../></g> 格式
        content = re.sub(
            r'<g><path[^>]*fill="[^"]*"[^>]*d="[^"]*"/></g>',
            remove_light_backgrounds,
            content
        )

    # 方法2: 如果SVG有width和height属性，确保设置透明背景
    # 在 <svg> 标签中添加 style="background-color: transparent;"
    content = re.sub(
        r'(<svg[^>]*)(>)',
        r'\1 style="background-color: transparent;"\2',
        content
    )

    # 确保没有重复的 style 属性
    content = re.sub(
        r'style="[^"]*"([^>]*)style="[^"]*"',
        r'style="background-color: transparent;"\1',
        content
    )

    # 如果没有指定输出文件，创建一个新文件
    if output_file is None:
        input_path = Path(input_file)
        output_file = input_path.parent / f"{input_path.stem}_transparent{input_path.suffix}"

    # 保存处理后的SVG
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Background removed successfully!")
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")

    return output_file

if __name__ == "__main__":
    # 输入文件路径
    input_svg = r"D:\project\省心投-cc\开发代码\frontend\icon\省心投.svg"

    # 输出文件路径（保存为 省心投_transparent.svg）
    output_svg = r"D:\project\省心投-cc\开发代码\frontend\icon\省心投_transparent.svg"

    # 去除背景
    remove_svg_background(input_svg, output_svg)

    print("\nTip: Open both SVG files in browser tabs to compare")
