# -*- coding: utf-8 -*-
"""Check database data for charts"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import DailyNotesMetricsUnified, XhsNoteInfo
from sqlalchemy import func

with app.app_context():
    # Check XhsNoteInfo data
    note_info_count = db.session.query(func.count(XhsNoteInfo.note_id)).scalar()
    print(f'XhsNoteInfo records: {note_info_count}')

    # Check publish_time dates
    dates = db.session.query(func.date(XhsNoteInfo.publish_time), func.count(XhsNoteInfo.note_id)).group_by(func.date(XhsNoteInfo.publish_time)).limit(10).all()
    print(f'Sample publish_time dates: {[(str(d[0]), d[1]) for d in dates]}')

    # Check DailyNotesMetricsUnified producer data
    producers = db.session.query(DailyNotesMetricsUnified.producer, func.count(DailyNotesMetricsUnified.note_id)).filter(
        DailyNotesMetricsUnified.producer.isnot(None),
        DailyNotesMetricsUnified.producer != ''
    ).group_by(DailyNotesMetricsUnified.producer).limit(10).all()
    print(f'Sample producers: {[(p[0], p[1]) for p in producers]}')

    # Check if there's any data in the date range
    from sqlalchemy import and_
    range_data = db.session.query(DailyNotesMetricsUnified).filter(
        and_(
            DailyNotesMetricsUnified.date >= '2025-02-01',
            DailyNotesMetricsUnified.date <= '2025-03-15'
        )
    ).count()
    print(f'Records in date range 2025-02-01 to 2025-03-15: {range_data}')