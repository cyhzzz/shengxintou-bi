"""
最终修复：生成干净的透明背景SVG
"""
import re

# 读取原始文件
with open('省心投.svg', 'r', encoding='utf-8') as f:
    content = f.read()

# 删除背景元素（覆盖整个画布的path）
# 匹配: <g><path style="opacity:1" fill="#f9f9f9" d="M -0.5,-0.5 ... Z"/></g>
pattern = r'<g><path[^>]*fill="#f9f9f9"[^>]*d="M -0\.5,-0\.5[^"]*Z"/></g>'
content = re.sub(pattern, '', content, count=1)

# 不添加任何额外的style属性 - SVG默认就是透明背景

# 保存
with open('省心投_transparent.svg', 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully created clean transparent SVG')
print('Background element removed, no extra style attributes added')
