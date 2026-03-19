# -*- coding: utf-8 -*-
"""Check DailyNotesMetricsUnified data by date range"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import DailyNotesMetricsUnified
from sqlalchemy import func, and_

with app.app_context():
    # Check date range with non-zero impressions
    result = db.session.query(
        DailyNotesMetricsUnified.date,
        func.count(DailyNotesMetricsUnified.id).label('count'),
        func.sum(DailyNotesMetricsUnified.total_impressions).label('total_imp'),
        func.sum(DailyNotesMetricsUnified.total_interactions).label('total_int'),
        func.sum(DailyNotesMetricsUnified.cost).label('total_cost')
    ).filter(
        DailyNotesMetricsUnified.date >= '2025-04-01'
    ).group_by(
        DailyNotesMetricsUnified.date
    ).order_by(
        DailyNotesMetricsUnified.date.desc()
    ).limit(30).all()

    print('Date | Records | Impressions | Interactions | Cost')
    print('-' * 60)
    for r in result:
        print(f'{r.date} | {r.count} | {r.total_imp} | {r.total_int} | {r.total_cost}')

    # Check specific date range (default frontend range)
    print('\n--- Default frontend date range (2026-02-15 to 2026-03-17) ---')
    count = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2026-02-15',
            DailyNotesMetricsUnified.date <= '2026-03-17'
        )
    ).scalar()
    print(f'Total records: {count}')

    # Check with non-zero values
    imp_count = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2026-02-15',
            DailyNotesMetricsUnified.date <= '2026-03-17',
            DailyNotesMetricsUnified.total_impressions > 0
        )
    ).scalar()
    print(f'Records with impressions > 0: {imp_count}')

    int_count = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2026-02-15',
            DailyNotesMetricsUnified.date <= '2026-03-17',
            DailyNotesMetricsUnified.total_interactions > 0
        )
    ).scalar()
    print(f'Records with interactions > 0: {int_count}')