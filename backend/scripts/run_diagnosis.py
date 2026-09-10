# -*- coding: utf-8 -*-
"""智能辅助诊断离线运行器。

运行：
    python -m backend.scripts.run_diagnosis [--month YYYY-MM]

输出契约与 /api/v1/reports/diagnosis 完全一致，用于本地验证与数据核对。
"""
import argparse
import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app

from backend.utils.diagnosis import run_diagnosis


def main():
    parser = argparse.ArgumentParser(description='智能辅助诊断离线运行器')
    parser.add_argument('--month', default=None, help='评估月份（YYYY-MM），缺省取库内最新月份')
    args = parser.parse_args()
    with app.app_context():
        try:
            result = run_diagnosis(args.month)
        except ValueError as exc:
            print('错误：{}'.format(exc), file=sys.stderr)
            return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
