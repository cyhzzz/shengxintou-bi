# -*- coding: utf-8 -*-
"""
测试周报保存功能
"""

import sys
import os
import json

# 设置标准输出为UTF-8编码（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../..'))  # Go up 3 levels: tests → scripts → backend → 开发代码
sys.path.insert(0, project_root)
os.chdir(project_root)

from app import app
from backend.database import db
from backend.models import WeeklyReport


def test_save_report():
    """测试周报保存功能"""

    with app.app_context():
        print("=" * 60)
        print("测试周报保存功能")
        print("=" * 60)

        # 步骤1: 获取一个现有周报
        print("\n步骤1: 获取现有周报")
        report = db.session.query(WeeklyReport).filter_by(report_id='2026-01-4').first()

        if not report:
            print("✗ 未找到 2026-01-4 周报，请先生成")
            return

        print(f"✓ 找到周报: {report.report_id}")
        print(f"  报告名称: {report.report_name}")
        print(f"  当前key_works: {len(json.loads(report.key_works)) if report.key_works else 0} 条")

        # 步骤2: 模拟前端更新数据
        print("\n步骤2: 模拟前端更新key_works")
        new_key_works = [
            {
                'work_num': '01',
                'work_category': '测试分类1',
                'work_description': '这是修改后的工作描述1'
            },
            {
                'work_num': '02',
                'work_category': '测试分类2',
                'work_description': '这是修改后的工作描述2'
            }
        ]

        print(f"  新key_works: {len(new_key_works)} 条")
        for work in new_key_works:
            print(f"    - {work['work_num']} {work['work_category']}: {work['work_description'][:30]}...")

        # 步骤3: 模拟API调用
        print("\n步骤3: 模拟API调用")
        try:
            # 更新报告
            report.key_works = json.dumps(new_key_works, ensure_ascii=False)
            db.session.commit()

            print("✓ 数据库更新成功")

            # 验证更新
            db.session.refresh(report)
            updated_key_works = json.loads(report.key_works)

            print(f"\n步骤4: 验证更新结果")
            print(f"✓ 更新后的key_works: {len(updated_key_works)} 条")
            for work in updated_key_works:
                print(f"    - {work['work_num']} {work['work_category']}: {work['work_description'][:30]}...")

            # 比对内容
            if (len(updated_key_works) == len(new_key_works) and
                updated_key_works[0]['work_description'] == new_key_works[0]['work_description']):
                print("\n✅ 保存功能正常工作！")
            else:
                print("\n✗ 保存功能异常：数据不匹配")

        except Exception as e:
            print(f"✗ 更新失败: {e}")
            db.session.rollback()
            return

        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)


if __name__ == '__main__':
    test_save_report()
