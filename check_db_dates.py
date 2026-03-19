# -*- coding: utf-8 -*-
"""Check database date range and producer data"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')

from app import app
from backend.models import DailyNotesMetricsUnified
from backend.database import db
from sqlalchemy import func

with app.app_context():
    # Check date range with data
    min_date = db.session.query(func.min(DailyNotesMetricsUnified.date)).scalar()
    max_date = db.session.query(func.max(DailyNotesMetricsUnified.date)).scalar()
    print(f'Date range: {min_date} to {max_date}')

    # Check records with producer
    with_producer = db.session.query(DailyNotesMetricsUnified).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).count()
    print(f'Records with producer: {with_producer}')

    # Sample producer data
    sample = db.session.query(
        DailyNotesMetricsUnified.date,
        DailyNotesMetricsUnified.producer,
        DailyNotesMetricsUnified.note_count
    ).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).order_by(DailyNotesMetricsUnified.date.desc()).limit(10).all()
    print('Recent sample:', [(str(r.date), r.producer, r.note_count) for r in sample])