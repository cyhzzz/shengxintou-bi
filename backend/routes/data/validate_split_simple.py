# -*- coding: utf-8 -*-
"""
Backend Code Split Validation Script
Quick validation of the split code
"""

import sys
import os

# Add project path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

def test_imports():
    """Test all module imports"""
    print("=" * 60)
    print("Test 1: Module Import Validation")
    print("=" * 60)

    modules = [
        'backend.routes.data_split.query',
        'backend.routes.data_split.dashboard',
        'backend.routes.data_split.trend',
        'backend.routes.data_split.agency_analysis',
        'backend.routes.data_split.xhs_notes',
        'backend.routes.data_split.cost_analysis',
        'backend.routes.data_split.external_analysis',
        'backend.routes.data_split.leads',
        'backend.routes.data_split.account_mapping',
        'backend.routes.data_split.abbreviation_mapping',
        'backend.routes.data_split.xhs_operation',
    ]

    results = {}
    for module in modules:
        try:
            __import__(module)
            results[module] = '[PASS]'
            print("[PASS] " + module)
        except Exception as e:
            results[module] = '[FAIL] ' + str(e)
            print("[FAIL] " + module + ": " + str(e))

    print()
    passed = sum(1 for v in results.values() if '[PASS]' in v)
    total = len(results)
    print("Import Test Result: {}/{} passed".format(passed, total))
    print()

    return passed == total

def test_blueprints():
    """Test all Blueprint definitions"""
    print("=" * 60)
    print("Test 2: Blueprint Definition Validation")
    print("=" * 60)

    from backend.routes.data_split import (
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

    results = {}
    for name, bp in blueprints:
        try:
            assert bp is not None, "{}.bp is None".format(name)
            assert bp.name == name, "{}.bp.name != '{}'".format(name, name)
            results[name] = '[PASS]'
            print("[PASS] {:30} - Blueprint name: {}".format(name, bp.name))
        except Exception as e:
            results[name] = '[FAIL] ' + str(e)
            print("[FAIL] {:30} - {}".format(name, str(e)))

    print()
    passed = sum(1 for v in results.values() if '[PASS]' in v)
    total = len(results)
    print("Blueprint Test Result: {}/{} passed".format(passed, total))
    print()

    return passed == total

def main():
    """Run all tests"""
    print("\n")
    print("Backend Code Split Validation Tool")
    print("=" * 60)
    print()

    tests = [
        ("Module Import", test_imports),
        ("Blueprint Definition", test_blueprints),
    ]

    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print("[ERROR] {} test failed: {}".format(name, str(e)))
            results.append((name, False))

    # Summary
    print("=" * 60)
    print("Validation Results Summary")
    print("=" * 60)

    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print("{:20} {}".format(name, status))

    print()

    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("[SUCCESS] All tests passed! The split code is ready to use.")
        print()
        print("Next steps:")
        print("1. Backup original file: cp backend/routes/data.py backend/routes/data.py.backup")
        print("2. Rename directory: mv backend/routes/data.py backend/routes/data_old")
        print("3. Rename split directory: mv backend/routes/data_split backend/routes/data")
        print("4. Update Blueprint registration code in app.py")
        print("5. Restart server for testing")
    else:
        print("[WARNING] Some tests failed, please check the error messages above.")

    print()
    print("=" * 60)

if __name__ == '__main__':
    main()
