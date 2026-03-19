# -*- coding: utf-8 -*-
"""Check database date range"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import DailyNotesMetricsUnified
from sqlalchemy import func

with app.app_context():
    # Check date range
    min_date = db.session.query(func.min(DailyNotesMetricsUnified.date)).scalar()
    max_date = db.session.query(func.max(DailyNotesMetricsUnified.date)).scalar()
    print(f'Date range: {min_date} to {max_date}')

    # Check records with producer
    with_producer = db.session.query(DailyNotesMetricsUnified).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).count()
    print(f'Records with producer: {with_producer}')

    # Check producer data date range
    producer_dates = db.session.query(
        func.min(DailyNotesMetricsUnified.date),
        func.max(DailyNotesMetricsUnified.date)
    ).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).first()
    print(f'Producer data date range: {producer_dates[0]} to {producer_dates[1]}')

    # Sample data with producer
    sample = db.session.query(DailyNotesMetricsUnified).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).order_by(DailyNotesMetricsUnified.date.desc()).limit(5).all()
    print(f'Sample data with producer:')
    for n in sample:
        print(f'  {n.date} | {n.producer} | note_id: {n.note_id}')