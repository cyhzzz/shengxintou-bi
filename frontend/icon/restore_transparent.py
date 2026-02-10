"""
重新生成透明背景SVG - 使用第一次脚本的逻辑
"""
import re

# 读取原始文件
with open('省心投.svg', 'r', encoding='utf-8') as f:
    content = f.read()

original_content = content

# 第一次脚本使用的逻辑：删除所有匹配浅色背景的元素
patterns_to_remove = [
    r'<rect[^>]*fill="#[fF]{6}[0-9a-fA-F]{0,2}"[^>]*>',
    r'<rect[^>]*fill="#[eE][6eE][eE5][dDfF][0-9a-fA-F]{0,2}"[^>]*>',
    r'<g><path[^>]*fill="#f9f9f9"[^>]*d="M -0\.5,-0\.5[^"]*Z"/></g>',
    r'<path[^>]*fill="#f9f9f9"[^>]*d="M -0\.5,-0\.5[^"]*"/>',
]

for pattern in patterns_to_remove:
    content = re.sub(pattern, '', content)

# 如果没有变化，使用通用方法删除背景
if content == original_content:
    def remove_light_backgrounds(match):
        tag_content = match.group(0)
        if re.search(r'fill="#[fF]{6}[0-9a-fA-F]{0,2}"', tag_content):
            return ''
        if re.search(r'fill="#[eE][6eE][eE5][dDfF]"', tag_content):
            return ''
        if re.search(r'fill="#[dD][dDfF][dDfF][fF]{0,2}"', tag_content):
            return ''
        return tag_content

    content = re.sub(
        r'<g><path[^>]*fill="[^"]*"[^>]*d="[^"]*"/></g>',
        remove_light_backgrounds,
        content
    )

# 添加透明背景样式
content = re.sub(
    r'(<svg[^>]*)(>)',
    r'\1 style="background-color: transparent;"\2',
    content
)

# 保存
output_file = '省心投_transparent.svg'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

removed_bytes = len(original_content) - len(content)
print(f'Successfully restored: {output_file}')
print(f'Original size: {len(original_content):,} bytes')
print(f'New size: {len(content):,} bytes')
print(f'Removed: {removed_bytes:,} bytes')
