# -*- coding: utf-8 -*-
"""
省心投 BI - Swagger/OpenAPI 配置

使用 Flasgger 生成 API 文档
文档地址: http://127.0.0.1:5000/apidocs
JSON规范: http://127.0.0.1:5000/apispec_1.json
"""

from flasgger import Swagger

# Swagger 配置
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec_1',
            "route": '/apispec_1.json',
            "rule_filter": lambda rule: True,  # 所有路由都包含
            "model_filter": lambda tag: True,   # 所有模型都包含
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs"
}

# OpenAPI 基础信息
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "省心投 BI API",
        "description": """
## 概述
互联网广告投放分析平台 API 接口文档

## 功能模块
- **数据概览**: 核心指标展示、趋势分析
- **厂商分析**: 代理商投放效果分析
- **转化漏斗**: 转化率追踪与分析
- **小红书报表**: 笔记数据、运营分析
- **线索明细**: 客户线索到转化明细
- **账号管理**: 账号与代理商映射
- **数据导入**: Excel/CSV 文件导入

## 认证
当前无需认证，所有接口公开访问

## 响应格式
所有接口返回 JSON 格式，包含以下字段：
- `success`: 布尔值，表示请求是否成功
- `data`: 响应数据
- `message`: 提示信息（可选）
- `error`: 错误代码（失败时）
        """,
        "contact": {
            "name": "省心投 BI 开发团队",
        },
        "version": "1.0.0",
    },
    "host": "127.0.0.1:5000",
    "basePath": "/api/v1",
    "schemes": [
        "http",
    ],
    "produces": [
        "application/json",
    ],
    "consumes": [
        "application/json",
        "multipart/form-data",
    ],
    "tags": [
        {
            "name": "Dashboard",
            "description": "数据概览相关接口"
        },
        {
            "name": "Trend",
            "description": "趋势分析接口"
        },
        {
            "name": "Agency Analysis",
            "description": "厂商分析接口"
        },
        {
            "name": "XHS Notes",
            "description": "小红书笔记相关接口"
        },
        {
            "name": "Conversion Funnel",
            "description": "转化漏斗相关接口"
        },
        {
            "name": "Leads",
            "description": "线索明细相关接口"
        },
        {
            "name": "Account Mapping",
            "description": "账号代理商映射接口"
        },
        {
            "name": "Upload",
            "description": "文件上传接口"
        },
        {
            "name": "Metadata",
            "description": "元数据接口"
        },
    ],
    "definitions": {
        "SuccessResponse": {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean",
                    "example": True
                },
                "data": {
                    "type": "object",
                    "description": "响应数据"
                },
                "message": {
                    "type": "string",
                    "example": "操作成功"
                }
            }
        },
        "ErrorResponse": {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean",
                    "example": False
                },
                "error": {
                    "type": "string",
                    "example": "ERROR_CODE"
                },
                "message": {
                    "type": "string",
                    "example": "错误描述"
                }
            }
        },
        "DateRange": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "format": "date",
                    "example": "2025-01-01"
                },
                "end_date": {
                    "type": "string",
                    "format": "date",
                    "example": "2025-01-31"
                }
            }
        },
        "CoreMetrics": {
            "type": "object",
            "properties": {
                "investment": {
                    "type": "number",
                    "description": "总投入（元）"
                },
                "total_impressions": {
                    "type": "integer",
                    "description": "总曝光数"
                },
                "total_clicks": {
                    "type": "integer",
                    "description": "总点击数"
                },
                "total_leads": {
                    "type": "integer",
                    "description": "总线索数"
                },
                "new_customers": {
                    "type": "integer",
                    "description": "新开客户数"
                },
                "new_valid_accounts": {
                    "type": "integer",
                    "description": "新有效户数"
                },
                "cost_per_lead": {
                    "type": "number",
                    "description": "线索成本"
                },
                "cost_per_valid_account": {
                    "type": "number",
                    "description": "有效户成本"
                }
            }
        },
        "FunnelStage": {
            "type": "object",
            "properties": {
                "step": {
                    "type": "string",
                    "description": "漏斗阶段名称"
                },
                "value": {
                    "type": "integer",
                    "description": "该阶段数值"
                },
                "rate": {
                    "type": "number",
                    "description": "转化率（百分比）"
                }
            }
        }
    },
    "parameters": {
        "start_date": {
            "name": "start_date",
            "in": "query",
            "type": "string",
            "format": "date",
            "required": False,
            "description": "开始日期 (YYYY-MM-DD)"
        },
        "end_date": {
            "name": "end_date",
            "in": "query",
            "type": "string",
            "format": "date",
            "required": False,
            "description": "结束日期 (YYYY-MM-DD)"
        },
        "platforms": {
            "name": "platforms",
            "in": "query",
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["腾讯", "抖音", "小红书"]
            },
            "required": False,
            "description": "平台筛选（多选）"
        },
        "agencies": {
            "name": "agencies",
            "in": "query",
            "type": "array",
            "items": {
                "type": "string"
            },
            "required": False,
            "description": "代理商筛选（多选）"
        },
        "business_models": {
            "name": "business_models",
            "in": "query",
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["直播", "信息流", "搜索"]
            },
            "required": False,
            "description": "业务模式筛选（多选）"
        }
    }
}


def init_swagger(app):
    """
    初始化 Swagger 文档

    Args:
        app: Flask 应用实例

    Returns:
        Swagger: Swagger 实例
    """
    swagger = Swagger(app, config=swagger_config, template=swagger_template)
    return swagger


# ============================================================================
# 常用 Swagger 装饰器模板
# ============================================================================

def dashboard_core_metrics_doc():
    """数据概览核心指标接口文档装饰器"""
    return {
        'tags': ['Dashboard'],
        'description': '获取数据概览核心指标，包含投入、曝光、点击、线索、开户等数据',
        'parameters': [
            {
                'name': 'start_date',
                'in': 'query',
                'type': 'string',
                'format': 'date',
                'required': False,
                'description': '开始日期'
            },
            {
                'name': 'end_date',
                'in': 'query',
                'type': 'string',
                'format': 'date',
                'required': False,
                'description': '结束日期'
            },
            {
                'name': 'platforms',
                'in': 'query',
                'type': 'array',
                'items': {'type': 'string'},
                'required': False,
                'description': '平台筛选'
            }
        ],
        'responses': {
            200: {
                'description': '成功响应',
                'schema': {
                    'type': 'object',
                    'properties': {
                        'success': {'type': 'boolean'},
                        'data': {
                            'type': 'object',
                            'properties': {
                                'core_metrics': {'$ref': '#/definitions/CoreMetrics'},
                                'wow_changes': {'type': 'object'}
                            }
                        }
                    }
                }
            }
        }
    }


def conversion_funnel_doc():
    """转化漏斗接口文档装饰器"""
    return {
        'tags': ['Conversion Funnel'],
        'description': '获取转化漏斗数据，展示从曝光到开户的完整转化路径',
        'parameters': [
            {
                'name': 'start_date',
                'in': 'query',
                'type': 'string',
                'format': 'date',
                'required': True,
                'description': '开始日期'
            },
            {
                'name': 'end_date',
                'in': 'query',
                'type': 'string',
                'format': 'date',
                'required': True,
                'description': '结束日期'
            },
            {
                'name': 'platforms',
                'in': 'query',
                'type': 'array',
                'items': {'type': 'string'},
                'required': False,
                'description': '平台筛选'
            },
            {
                'name': 'agencies',
                'in': 'query',
                'type': 'array',
                'items': {'type': 'string'},
                'required': False,
                'description': '代理商筛选'
            },
            {
                'name': 'employee_mode',
                'in': 'query',
                'type': 'boolean',
                'required': False,
                'default': False,
                'description': '是否按服务人员维度统计'
            }
        ],
        'responses': {
            200: {
                'description': '成功响应',
                'schema': {
                    'type': 'object',
                    'properties': {
                        'success': {'type': 'boolean'},
                        'data': {
                            'type': 'object',
                            'properties': {
                                'funnel': {
                                    'type': 'array',
                                    'items': {'$ref': '#/definitions/FunnelStage'}
                                },
                                'core_metrics': {'type': 'object'},
                                'is_employee_mode': {'type': 'boolean'}
                            }
                        }
                    }
                }
            }
        }
    }