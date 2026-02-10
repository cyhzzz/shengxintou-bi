# -*- coding: utf-8 -*-
"""
更新所有Python文件中的表名引用

将 xhs_note_info 替换为 xhs_note_info
"""
import os
import re


def update_file(filepath):
    """更新单个文件中的表名引用"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 替换表名
    content = re.sub(r'xhs_note_info', 'xhs_note_info', content)

    # 如果有变化，写回文件
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def update_all_references():
    """更新所有Python文件"""
    base_dir = 'D:/project/省心投-cc'

    # 需要更新的目录
    directories = [
        'backend',
    ]

    updated_files = []

    for directory in directories:
        dir_path = os.path.join(base_dir, directory)
        if not os.path.exists(dir_path):
            continue

        for root, dirs, files in os.walk(dir_path):
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)
                    if update_file(filepath):
                        updated_files.append(filepath)

    return updated_files


if __name__ == '__main__':
    print('=== 开始更新所有表名引用 ===')
    updated = update_all_references()

    if updated:
        print(f'✅ 已更新 {len(updated)} 个文件:')
        for filepath in updated:
            print(f'   - {filepath}')
    else:
        print('⚠️  没有找到需要更新的文件')
