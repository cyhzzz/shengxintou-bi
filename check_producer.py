# -*- coding: utf-8 -*-
"""Check producer data in database"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')

from app import app
from backend.models import DailyNotesMetricsUnified
from backend.database import db
from sqlalchemy import func

with app.app_context():
    # Check total records
    total = db.session.query(DailyNotesMetricsUnified).count()
    print(f'Total records in daily_notes_metrics_unified: {total}')

    # Check records with producer
    with_producer = db.session.query(DailyNotesMetricsUnified).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).count()
    print(f'Records with producer: {with_producer}')

    # Check date range
    min_date = db.session.query(func.min(DailyNotesMetricsUnified.date)).scalar()
    max_date = db.session.query(func.max(DailyNotesMetricsUnified.date)).scalar()
    print(f'Date range: {min_date} to {max_date}')

    # Sample producer data
    sample = db.session.query(DailyNotesMetricsUnified).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).limit(5).all()
    print('Sample producers:', [(n.producer, n.date) for n in sample])

    # Check for date range 2025-02-01 to 2025-03-15
    from sqlalchemy import and_
    range_count = db.session.query(DailyNotesMetricsUnified).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2025-02-01',
            DailyNotesMetricsUnified.date <= '2025-03-15'
        )
    ).count()
    print(f'Records in 2025-02-01 to 2025-03-15: {range_count}')

    # Check producer in that range
    range_with_producer = db.session.query(DailyNotesMetricsUnified).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2025-02-01',
            DailyNotesMetricsUnified.date <= '2025-03-15',
            DailyNotesMetricsUnified.producer.isnot(None),
            DailyNotesMetricsUnified.producer != ''
        )
    ).count()
    print(f'Records in date range with producer: {range_with_producer}')