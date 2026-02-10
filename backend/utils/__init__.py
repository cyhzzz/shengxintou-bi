# -*- coding: utf-8 -*-
"""
Backend utilities package

包含异常处理装饰器、参数校验等工具函数
"""

import logging
import traceback
from functools import wraps
from flask import jsonify

# 配置日志
logger = logging.getLogger(__name__)


def handle_exceptions(f):
    """
    统一异常处理装饰器

    功能：
    - 捕获所有未处理异常
    - 记录详细的错误日志（包括堆栈跟踪）
    - 返回统一的错误响应格式

    使用示例：
        @bp.route('/endpoint', methods=['POST'])
        @handle_exceptions
        def endpoint():
            # 业务逻辑
            return jsonify({'success': True, 'data': result})

    注意：
        - 必须在所有路由函数上使用此装饰器
        - 不要在装饰器内部抛出异常（会导致二次捕获）
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            # 参数校验错误
            logger.warning(f"Validation error in {f.__name__}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'INVALID_PARAMS',
                'message': str(e)
            }), 400
        except KeyError as e:
            # 缺少必需参数
            logger.warning(f"Missing parameter in {f.__name__}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAM',
                'message': f'缺少必需参数: {str(e)}'
            }), 400
        except Exception as e:
            # 未知错误
            logger.error(f"Error in {f.__name__}: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'INTERNAL_ERROR',
                'message': '服务器内部错误'
            }), 500
    return decorated_function


def validate_filters(filters):
    """
    校验筛选参数

    参数：
        filters: 筛选参数字典

    异常：
        ValueError: 参数格式错误
    """
    if not isinstance(filters, dict):
        raise ValueError('filters must be a dictionary')

    # 校验日期格式
    if 'start_date' in filters:
        from datetime import datetime
        try:
            datetime.strptime(filters['start_date'], '%Y-%m-%d')
        except ValueError:
            raise ValueError('start_date 格式错误，应为 YYYY-MM-DD')

    if 'end_date' in filters:
        from datetime import datetime
        try:
            datetime.strptime(filters['end_date'], '%Y-%m-%d')
        except ValueError:
            raise ValueError('end_date 格式错误，应为 YYYY-MM-DD')

    # 校验平台
    if 'platforms' in filters:
        valid_platforms = ['腾讯', '抖音', '小红书']
        for p in filters['platforms']:
            if p not in valid_platforms:
                raise ValueError(f'Invalid platform: {p}，有效值: {valid_platforms}')

    # 校验业务模式
    if 'business_models' in filters:
        valid_models = ['直播', '信息流', '搜索']
        for m in filters['business_models']:
            if m not in valid_models:
                raise ValueError(f'Invalid business_model: {m}，有效值: {valid_models}')

    # 校验代理商
    if 'agencies' in filters:
        if not isinstance(filters['agencies'], list):
            raise ValueError('agencies must be a list')


def log_api_call(func_name):
    """
    记录API调用日志

    参数：
        func_name: 函数名称
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            logger.info(f'API call: {func_name}')
            result = f(*args, **kwargs)
            logger.info(f'API success: {func_name}')
            return result
        return decorated_function
    return decorator

