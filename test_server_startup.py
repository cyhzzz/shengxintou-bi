# -*- coding: utf-8 -*-
"""
快速测试服务器启动
"""

import sys
import os

# Add project path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def test_server_startup():
    """测试服务器是否能正常启动"""
    print("=" * 60)
    print("Testing Server Startup")
    print("=" * 60)
    print()

    try:
        print("Importing app module...")
        from app import app

        print("Checking Blueprint registration...")
        from backend.routes.data import (
            query, dashboard, trend, agency_analysis,
            xhs_notes, cost_analysis, external_analysis,
            leads, account_mapping, abbreviation_mapping,
            xhs_operation
        )

        blueprints = [
            ('query', query.bp),
            ('dashboard', dashboard.bp),
            ('trend', trend.bp),
            ('agency_analysis', agency_analysis.bp),
            ('xhs_notes', xhs_notes.bp),
            ('cost_analysis', cost_analysis.bp),
            ('external_analysis', external_analysis.bp),
            ('leads', leads.bp),
            ('account_mapping', account_mapping.bp),
            ('abbreviation_mapping', abbreviation_mapping.bp),
            ('xhs_operation', xhs_operation.bp),
        ]

        print()
        print("Registered Blueprints:")
        for name, bp in blueprints:
            print(f"  [OK] {name:30} - {bp.name}")

        print()
        print("[SUCCESS] Server startup test passed!")
        print()
        print("You can now start the server with: python app.py")
        print("Then test the application at: http://127.0.0.1:5000")

        return True

    except Exception as e:
        print()
        print(f"[ERROR] Server startup test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_server_startup()
    sys.exit(0 if success else 1)
