# -*- coding: utf-8 -*-
"""Check DailyNotesMetricsUnified data"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import DailyNotesMetricsUnified
from sqlalchemy import func

with app.app_context():
    # Check total_impressions and total_interactions distribution
    total = db.session.query(func.count(DailyNotesMetricsUnified.id)).scalar()
    with_impressions = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        DailyNotesMetricsUnified.total_impressions > 0
    ).scalar()
    with_interactions = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        DailyNotesMetricsUnified.total_interactions > 0
    ).scalar()
    with_cost = db.session.query(func.count(DailyNotesMetricsUnified.id)).filter(
        DailyNotesMetricsUnified.cost > 0
    ).scalar()

    print(f'Total records: {total}')
    print(f'With total_impressions > 0: {with_impressions}')
    print(f'With total_interactions > 0: {with_interactions}')
    print(f'With cost > 0: {with_cost}')

    # Sample data with non-zero values
    samples = db.session.query(
        DailyNotesMetricsUnified.date,
        DailyNotesMetricsUnified.producer,
        DailyNotesMetricsUnified.total_impressions,
        DailyNotesMetricsUnified.total_interactions,
        DailyNotesMetricsUnified.cost
    ).filter(
        DailyNotesMetricsUnified.total_impressions > 0
    ).order_by(
        DailyNotesMetricsUnified.date.desc()
    ).limit(5).all()

    print('\nSample records with impressions:')
    for s in samples:
        print(f'  {s.date} | {s.producer} | imp={s.total_impressions} | int={s.total_interactions} | cost={s.cost}')