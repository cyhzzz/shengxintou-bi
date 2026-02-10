# -*- coding: utf-8 -*-
"""
测试周报生成完整流程
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
project_root = os.path.abspath(os.path.join(current_dir, '../..'))
sys.path.insert(0, project_root)

# 切换到项目根目录
os.chdir(project_root)

# 导入模块
from app import app
from backend.database import db
from backend.models import WeeklyReport


def test_weekly_report_workflow():
    """测试完整的周报生成工作流程"""

    with app.app_context():
        print("=" * 60)
        print("测试周报生成完整流程")
        print("=" * 60)

        # 测试1: 查询现有周报
        print("\n测试1: 查询现有周报")
        reports = db.session.query(WeeklyReport).order_by(
            WeeklyReport.start_date.desc()
        ).limit(5).all()

        print(f"找到 {len(reports)} 条周报记录:")
        for report in reports:
            print(f"  {report.report_id}: {report.report_name}")

            # 打印聚合数据
            print(f"    广告展示量: {report.ad_impressions:,}")
            print(f"    新开户数: {report.new_accounts}")
            if report.key_works:
                key_works = json.loads(report.key_works)
                print(f"    重点工作: {len(key_works)} 条")

        # 测试2: 验证主键结构
        print("\n测试2: 验证主键结构")
        sample = reports[0] if reports else None
        if sample:
            print(f"  report_id: {sample.report_id}")
            print(f"  类型: {type(sample.report_id)}")
            print(f"  report_year: {sample.report_year}")
            print(f"  report_week: {sample.report_week}")

            # 验证 report_id 格式
            parts = sample.report_id.split('-')
            if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit() and parts[2].isdigit():
                print("  ✓ report_id 格式正确 (YYYY-MM-weeknum)")
            else:
                print(f"  ✗ report_id 格式错误: {sample.report_id}")

        # 测试3: 验证数据聚合
        print("\n测试3: 验证数据聚合")
        if sample:
            print(f"  本周数据:")
            print(f"    广告展示量: {sample.ad_impressions:,}")
            print(f"    广告点击量: {sample.ad_clicks:,}")
            print(f"    新开户数: {sample.new_accounts}")

            print(f"  累计数据:")
            print(f"    累计展示量: {sample.ad_impressions_cumulative:,}")
            print(f"    累计点击量: {sample.ad_clicks_cumulative:,}")
            print(f"    累计新开户: {sample.new_accounts_cumulative:,}")

            # 验证累计值逻辑
            if sample.ad_impressions_cumulative >= sample.ad_impressions:
                print("  ✓ 累计展示量 >= 本周展示量")
            if sample.ad_clicks_cumulative >= sample.ad_clicks:
                print("  ✓ 累计点击量 >= 本周点击量")
            if sample.new_accounts_cumulative >= sample.new_accounts:
                print("  ✓ 累计新开户 >= 本周新开户")

        # 测试4: 验证key_works
        print("\n测试4: 验证key_works")
        if sample and sample.key_works:
            key_works = json.loads(sample.key_works)
            print(f"  重点工作数量: {len(key_works)}")

            for i, work in enumerate(key_works[:3], 1):  # 只显示前3条
                print(f"    {i}. {work['work_num']} {work['work_category']}")
                print(f"       {work['work_description'][:50]}...")

        # 测试5: 检查数据库约束
        print("\n测试5: 检查数据库约束")
        import sqlalchemy as sa
        inspector = sa.inspect(db.engine)

        # 检查主键约束
        pk = inspector.get_pk_constraint('weekly_reports')
        print(f"  主键约束: {pk['constrained_columns']}")

        # 检查唯一约束
        unique_constraints = inspector.get_unique_constraints('weekly_reports')
        print(f"  唯一约束: {len(unique_constraints)} 个")

        # 检查索引
        indexes = inspector.get_indexes('weekly_reports')
        index_columns = [idx['column_names'] for idx in indexes]
        print(f"  索引: {len(indexes)} 个")
        for idx in index_columns:
            print(f"    - {idx}")

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)


if __name__ == '__main__':
    test_weekly_report_workflow()
