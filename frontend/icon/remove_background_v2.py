"""
去除SVG logo背景色 v2 - 精确删除背景矩形
"""
import re

def remove_svg_background_v2(input_file, output_file=None):
    """
    去除SVG文件的背景色 - 精确版本

    Args:
        input_file: 输入SVG文件路径
        output_file: 输出SVG文件路径（可选）
    """
    # 读取SVG文件
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 精确删除：匹配第一个 <g><path fill="#f9f9f9".../></g> 标签
    # 这个是背景矩形，覆盖整个画布

    # 模式1: <g><path style="opacity:1" fill="#f9f9f9" d="M -0.5,-0.5 ... Z"/></g>
    pattern1 = r'<g><path[^>]*fill="#f9f9f9"[^>]*d="M -0\.5,-0\.5[^"]*Z"/></g>'
    content = re.sub(pattern1, '', content, count=1)

    # 模式2: 如果上面没匹配到，尝试更宽松的模式
    if content == original_content:
        # 匹配任何 fill="#f9f9f9" 且包含大坐标矩形的 path
        pattern2 = r'<g><path[^>]*fill="#f9f9f9"[^>]*/></g>'
        content = re.sub(pattern2, '', content, count=1)

    # 模式3: 如果还没匹配到，删除前3个 <g> 标签（背景通常是前几个）
    if content == original_content:
        lines = content.split('\n')
        # 找到第一个 <g> 标签的行
        for i, line in enumerate(lines):
            if '<g><path' in line and 'fill="#f9f9f9' in line:
                lines.pop(i)
                break
        content = '\n'.join(lines)

    # 确保SVG标签有透明背景样式
    content = re.sub(
        r'(<svg[^>]*)(>)',
        r'\1 style="background-color: transparent;"\2',
        content,
        count=1
    )

    # 如果没有指定输出文件，创建一个新文件
    if output_file is None:
        from pathlib import Path
        input_path = Path(input_file)
        output_file = input_path.parent / f"{input_path.stem}_transparent{input_path.suffix}"

    # 保存处理后的SVG
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    # 计算文件大小变化
    original_size = len(original_content)
    new_size = len(content)
    removed_bytes = original_size - new_size

    print(f"Background removed successfully!")
    print(f"Input file:  {input_file}")
    print(f"Output file: {output_file}")
    print(f"Removed: {removed_bytes:,} bytes")

    return output_file

if __name__ == "__main__":
    # 输入文件路径
    input_svg = r"D:\project\省心投-cc\开发代码\frontend\icon\省心投.svg"

    # 输出文件路径
    output_svg = r"D:\project\省心投-cc\开发代码\frontend\icon\省心投_transparent.svg"

    # 去除背景
    remove_svg_background_v2(input_svg, output_svg)

    print("\nDone! Open both SVG files in browser to compare.")
