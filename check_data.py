"""检查数据库中的测试数据"""
import sys
import os

# 设置路径
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
sys.path.insert(0, os.path.join(base_dir, 'lib'))

os.environ['PYTHONHOME'] = os.path.join(base_dir, 'python-3.9-embed')

from app import app
from backend.database import db
from sqlalchemy import text

with app.app_context():
    # Check data in the test date range
    result = db.session.execute(text('''
        SELECT
            platform_source,
            COUNT(*) as cnt,
            COUNT(DISTINCT add_employee_name) as employee_cnt
        FROM backend_conversions
        WHERE lead_date BETWEEN '2026-02-17' AND '2026-02-23'
        AND platform_source IS NOT NULL AND platform_source != ''
        AND add_employee_name IS NOT NULL AND add_employee_name != ''
        GROUP BY platform_source
    ''')).fetchall()

    print('Data in date range 2026-02-17 to 2026-02-23:')
    for row in result:
        print(f'  {row[0]}: {row[1]} records, {row[2]} employees')

    # Check qualified employees (min_leads >= 5)
    qualified = db.session.execute(text('''
        SELECT add_employee_name, COUNT(*) as total_leads
        FROM backend_conversions
        WHERE add_employee_name IS NOT NULL AND add_employee_name != ''
        GROUP BY add_employee_name
        HAVING COUNT(*) >= 5
        ORDER BY total_leads DESC
    ''')).fetchall()

    print(f'\nQualified employees (total leads >= 5): {len(qualified)}')

    # Check which qualified employees have data in the date range
    qualified_names = [row[0] for row in qualified]
    if qualified_names:
        # Build safe query
        placeholders = ','.join([f"'{n}'" for n in qualified_names[:20]])
        range_data = db.session.execute(text(f'''
            SELECT add_employee_name, platform_source, COUNT(*) as cnt
            FROM backend_conversions
            WHERE lead_date BETWEEN '2026-02-17' AND '2026-02-23'
            AND add_employee_name IN ({placeholders})
            GROUP BY add_employee_name, platform_source
            ORDER BY cnt DESC
            LIMIT 20
        ''')).fetchall()

        print('\nQualified employees with data in date range (top 20):')
        for row in range_data:
            print(f'  {row[0]} - {row[1]}: {row[2]} leads')

    # Check total employees with data in the range (no qualification filter)
    all_in_range = db.session.execute(text('''
        SELECT add_employee_name, platform_source, COUNT(*) as cnt
        FROM backend_conversions
        WHERE lead_date BETWEEN '2026-02-17' AND '2026-02-23'
        AND platform_source IS NOT NULL AND platform_source != ''
        AND add_employee_name IS NOT NULL AND add_employee_name != ''
        GROUP BY add_employee_name, platform_source
        ORDER BY cnt DESC
        LIMIT 20
    ''')).fetchall()

    print('\nAll employees with data in date range (top 20, no filter):')
    for row in all_in_range:
        print(f'  {row[0]} - {row[1]}: {row[2]} leads')