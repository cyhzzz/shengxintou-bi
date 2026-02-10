# -*- coding: utf-8 -*-
"""
统一异常处理装饰器
"""

from functools import wraps
import logging
import traceback
from flask import jsonify

logger = logging.getLogger(__name__)

def handle_exceptions(f):
    """统一异常处理装饰器
    
    功能：
    - 捕获所有异常
    - 记录详细的错误日志（包括堆栈跟踪）
    - 返回统一的错误响应格式
    - 区分不同类型的异常，返回相应的HTTP状态码
    
    用法：
    @bp.route('/api/data', methods=['POST'])
    @handle_exceptions
    def get_data():
        # 业务逻辑
        ...
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # 执行原始函数
            return f(*args, **kwargs)
        except ValueError as e:
            # 参数错误
            logger.error(f"参数错误 in {f.__name__}: {str(e)}")
            logger.debug(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'INVALID_PARAMETER',
                'message': str(e)
            }), 400
        except KeyError as e:
            # 缺少参数
            logger.error(f"缺少参数 in {f.__name__}: {str(e)}")
            logger.debug(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'MISSING_PARAMETER',
                'message': f'缺少必需参数: {str(e)}'
            }), 400
        except FileNotFoundError as e:
            # 文件不存在
            logger.error(f"文件不存在 in {f.__name__}: {str(e)}")
            logger.debug(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'FILE_NOT_FOUND',
                'message': str(e)
            }), 404
        except PermissionError as e:
            # 权限错误
            logger.error(f"权限错误 in {f.__name__}: {str(e)}")
            logger.debug(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'PERMISSION_DENIED',
                'message': '权限不足'
            }), 403
        except Exception as e:
            # 其他未知错误
            logger.error(f"未知错误 in {f.__name__}: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'INTERNAL_ERROR',
                'message': '服务器内部错误'
            }), 500
    return decorated_function

def validate_json(f):
    """
    JSON格式验证装饰器
    
    确保请求包含有效的JSON数据
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request
        
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'INVALID_FORMAT',
                'message': '请求必须是JSON格式'
            }), 400
        
        return f(*args, **kwargs)
    return decorated_function

def require_params(*required_params):
    """
    必需参数验证装饰器
    
    确保请求中包含指定的参数
    
    用法：
    @bp.route('/api/data', methods=['POST'])
    @handle_exceptions
    @require_params('start_date', 'end_date')
    def get_data():
        # 业务逻辑
        ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import request
            
            # 获取请求数据
            if request.is_json:
                data = request.json
            else:
                data = request.form
            
            # 检查必需参数
            missing_params = []
            for param in required_params:
                if param not in data:
                    missing_params.append(param)
            
            if missing_params:
                return jsonify({
                    'success': False,
                    'error': 'MISSING_PARAMETER',
                    'message': f'缺少必需参数: {", ".join(missing_params)}'
                }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator
