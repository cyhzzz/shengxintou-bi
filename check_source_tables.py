# -*- coding: utf-8 -*-
"""Check source tables for recent data"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import XhsNotesDaily, XhsNotesContentDaily
from sqlalchemy import func, and_

with app.app_context():
    # Check xhs_notes_daily (投放数据)
    print('=== xhs_notes_daily (投放数据) ===')
    result = db.session.query(
        XhsNotesDaily.date,
        func.count(XhsNotesDaily.note_id).label('count'),
        func.sum(XhsNotesDaily.impressions).label('imp'),
        func.sum(XhsNotesDaily.clicks).label('clicks'),
        func.sum(XhsNotesDaily.cost).label('cost')
    ).filter(
        XhsNotesDaily.date >= '2026-02-10'
    ).group_by(
        XhsNotesDaily.date
    ).order_by(
        XhsNotesDaily.date.desc()
    ).limit(10).all()

    print('Date | Records | Impressions | Clicks | Cost')
    for r in result:
        print(f'{r.date} | {r.count} | {r.imp} | {r.clicks} | {r.cost}')

    # Check xhs_notes_content_daily (运营数据)
    print('\n=== xhs_notes_content_daily (运营数据) ===')
    result2 = db.session.query(
        XhsNotesContentDaily.data_date,
        func.count(XhsNotesContentDaily.note_id).label('count'),
        func.sum(XhsNotesContentDaily.total_impressions).label('imp'),
        func.sum(XhsNotesContentDaily.total_reads).label('reads')
    ).filter(
        XhsNotesContentDaily.data_date >= '2026-02-10'
    ).group_by(
        XhsNotesContentDaily.data_date
    ).order_by(
        XhsNotesContentDaily.data_date.desc()
    ).limit(10).all()

    print('Date | Records | Impressions | Reads')
    for r in result2:
        print(f'{r.data_date} | {r.count} | {r.imp} | {r.reads}')