# -*- coding: utf-8 -*-
"""Test metadata API for XHS notes date range"""
import sys
sys.path.insert(0, '.')
sys.path.insert(0, 'lib')
sys.stdout.reconfigure(encoding='utf-8')

from app import app
from backend.database import db
from backend.models import DailyNotesMetricsUnified
from sqlalchemy import func

with app.app_context():
    # Query XHS notes date range
    result = db.session.query(
        func.min(DailyNotesMetricsUnified.date).label('min_date'),
        func.max(DailyNotesMetricsUnified.date).label('max_date')
    ).first()

    print(f'XHS Notes Date Range: {result.min_date} to {result.max_date}')

    # Also test the metadata API
    from backend.routes.metadata import get_metadata
    with app.test_client() as client:
        response = client.get('/api/v1/metadata')
        import json
        data = json.loads(response.data)
        if data.get('success'):
            print(f"Metadata API xhs_notes_date_range: {data['data'].get('xhs_notes_date_range')}")
        else:
            print(f"Metadata API error: {data}")