# -*- coding: utf-8 -*-
"""
创建周报数据表

运行方式:
    python backend/scripts/migrations/create_weekly_reports_table.py
"""

import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app import app
from backend.database import db


def migrate():
    """创建周报数据表"""
    with app.app_context():
        # 导入模型
        from backend.models import WeeklyReport

        # 创建表
        print("正在创建 weekly_reports 表...")
        db.create_all()

        # 验证表是否创建成功
        try:
            # 尝试查询表
            count = db.session.query(WeeklyReport).count()
            print(f"[OK] weekly_reports 表创建成功！当前记录数: {count}")
        except Exception as e:
            print(f"[ERROR] 表创建失败: {str(e)}")
            return False

        print("\n表结构信息:")
        print(f"- 表名: {WeeklyReport.__tablename__}")
        print(f"- 主键: id")
        print(f"- 唯一约束: (report_year, report_week)")
        print(f"- 索引字段: report_year, report_week, report_month, start_date, end_date, status")

        return True


if __name__ == '__main__':
    print("=" * 60)
    print("省心投 BI - 创建周报数据表")
    print("=" * 60)
    print()

    success = migrate()

    print()
    print("=" * 60)
    if success:
        print("[OK] 迁移完成！")
    else:
        print("[ERROR] 迁移失败！")
    print("=" * 60)
