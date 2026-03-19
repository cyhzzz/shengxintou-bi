"""验证海报按钮不显示的原因"""
import sys
import os

# 设置路径
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
sys.path.insert(0, os.path.join(base_dir, 'lib'))

os.environ['PYTHONHOME'] = os.path.join(base_dir, 'python-3.9-embed')

from app import app
from backend.database import db
from sqlalchemy import text, func, and_
from backend.models import BackendConversions

with app.app_context():
    print("=" * 60)
    print("验证海报按钮不显示的原因")
    print("=" * 60)

    # 1. 检查日期范围内的数据
    print("\n1. 日期范围内的数据 (2026-02-17 ~ 2026-02-23):")
    result = db.session.execute(text('''
        SELECT platform_source, COUNT(*) as cnt, COUNT(DISTINCT add_employee_name) as emp_cnt
        FROM backend_conversions
        WHERE lead_date BETWEEN '2026-02-17' AND '2026-02-23'
        AND platform_source IS NOT NULL AND platform_source != ''
        AND add_employee_name IS NOT NULL AND add_employee_name != ''
        GROUP BY platform_source
    ''')).fetchall()

    for row in result:
        print(f"  {row[0]}: {row[1]} 条记录, {row[2]} 个员工")

    # 2. 检查 get_qualified_employees(min_leads=5) 的逻辑
    print("\n2. 符合条件的员工 (全量线索数 >= 5):")
    qualified_query = db.session.query(
        BackendConversions.add_employee_name,
        func.count(BackendConversions.id).label('total_leads')
    ).filter(
        and_(
            BackendConversions.add_employee_name.isnot(None),
            BackendConversions.add_employee_name != ''
        )
    ).group_by(BackendConversions.add_employee_name)

    qualified_results = qualified_query.all()
    qualified_employees = [row.add_employee_name for row in qualified_results if row.total_leads >= 5]

    print(f"  符合条件的员工总数: {len(qualified_employees)}")
    for row in qualified_results:
        if row.total_leads >= 5:
            print(f"    {row.add_employee_name}: {row.total_leads} 条线索")

    # 3. 检查日期范围内的员工是否在合格名单中
    print("\n3. 日期范围内的员工是否在合格名单中:")
    date_range_employees = db.session.execute(text('''
        SELECT DISTINCT add_employee_name, COUNT(*) as cnt
        FROM backend_conversions
        WHERE lead_date BETWEEN '2026-02-17' AND '2026-02-23'
        AND add_employee_name IS NOT NULL AND add_employee_name != ''
        GROUP BY add_employee_name
        ORDER BY cnt DESC
    ''')).fetchall()

    print(f"  日期范围内有数据的员工: {len(date_range_employees)} 个")
    for row in date_range_employees:
        in_qualified = "[OK]" if row[0] in qualified_employees else "[X]"
        print(f"    {row[0]}: {row[1]} 条 ({in_qualified})")

    # 4. 结论
    print("\n" + "=" * 60)
    print("结论:")
    overlap = [e for e, _ in date_range_employees if e in qualified_employees]
    if len(overlap) == 0:
        print("  [X] 日期范围内有数据的员工，全部不在合格名单中！")
        print("  原因: get_qualified_employees(min_leads=5) 按全量线索筛选")
        print("  解决: 移除或降低 min_leads 阈值，或改为按日期范围内线索筛选")
    else:
        print(f"  [OK] 有 {len(overlap)} 个员工在合格名单中")
    print("=" * 60)