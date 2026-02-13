# -*- coding: utf-8 -*-
"""
后端代码拆分验证脚本
快速验证拆分后的代码是否正确
"""

import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

def test_imports():
    """测试所有模块导入"""
    print("=" * 60)
    print("测试1: 模块导入验证")
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
            results[module] = '✅ 通过'
            print(f"✅ {module}")
        except Exception as e:
            results[module] = f'❌ 失败: {str(e)}'
            print(f"❌ {module}: {str(e)}")

    print()
    passed = sum(1 for v in results.values() if '✅' in v)
    total = len(results)
    print(f"导入测试结果: {passed}/{total} 通过")
    print()

    return passed == total

def test_blueprints():
    """测试所有Blueprint定义"""
    print("=" * 60)
    print("测试2: Blueprint定义验证")
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
            assert bp is not None, f"{name}.bp is None"
            assert bp.name == name, f"{name}.bp.name != '{name}'"
            results[name] = '✅ 通过'
            print(f"✅ {name:30} - Blueprint名称: {bp.name}")
        except Exception as e:
            results[name] = f'❌ 失败: {str(e)}'
            print(f"❌ {name:30} - {str(e)}")

    print()
    passed = sum(1 for v in results.values() if '✅' in v)
    total = len(results)
    print(f"Blueprint测试结果: {passed}/{total} 通过")
    print()

    return passed == total

def test_routes():
    """测试路由定义"""
    print("=" * 60)
    print("测试3: 路由端点验证")
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
            # 获取所有路由规则
            routes = [rule.rule for rule in bp.deferred_functions]
            if not routes:
                # deferred_functions为空,尝试其他方式
                routes = []
                for rule in bp.url_map.iter_rules(bp):
                    if rule.endpoint != bp.name + '.static':
                        routes.append(rule.rule)

            results[name] = '✅ 通过'
            print(f"✅ {name:30} - 路由数量: {len(routes)}")
        except Exception as e:
            results[name] = f'❌ 失败: {str(e)}'
            print(f"❌ {name:30} - {str(e)}")

    print()
    passed = sum(1 for v in results.values() if '✅' in v)
    total = len(results)
    print(f"路由测试结果: {passed}/{total} 通过")
    print()

    return passed == total

def test_dependencies():
    """测试依赖循环"""
    print("=" * 60)
    print("测试4: 依赖循环检查")
    print("=" * 60)

    import importlib.util
    import sys

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

    # 简单检查: 确保没有循环导入
    try:
        for module in modules:
            if module in sys.modules:
                del sys.modules[module]

        for module in modules:
            importlib.import_module(module)

        print("✅ 没有发现循环导入")
        print()
        return True
    except ImportError as e:
        print(f"❌ 导入错误: {str(e)}")
        print()
        return False

def main():
    """运行所有测试"""
    print("\n")
    print("Backend Code Split Validation Tool")
    print("=" * 60)
    print()

    tests = [
        ("模块导入", test_imports),
        ("Blueprint定义", test_blueprints),
        ("路由端点", test_routes),
        ("依赖循环", test_dependencies),
    ]

    results = []
    for name, test_func in tests:
        try:
            passed = test_func()
            results.append((name, passed))
        except Exception as e:
            print(f"❌ {name}测试出错: {str(e)}")
            results.append((name, False))

    # 汇总结果
    print("=" * 60)
    print("Validation Results Summary")
    print("=" * 60)

    for name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{name:20} {status}")

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
