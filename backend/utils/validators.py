# -*- coding: utf-8 -*-
"""
参数校验工具
"""

from datetime import datetime
from typing import Dict, List, Any

class Validator:
    """
    参数校验器类
    
    提供各种参数校验方法
    """
    
    @staticmethod
    def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
        """
        验证必需字段
        
        Args:
            data: 待验证的数据字典
            required_fields: 必需字段列表
            
        Raises:
            ValueError: 如果缺少必需字段
        """
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            raise ValueError(f'缺少必需字段: {", ".join(missing_fields)}')
    
    @staticmethod
    def validate_date_format(date_str: str, format: str = '%Y-%m-%d') -> datetime:
        """
        验证日期格式
        
        Args:
            date_str: 日期字符串
            format: 日期格式，默认为 '%Y-%m-%d'
            
        Returns:
            datetime: 解析后的日期对象
            
        Raises:
            ValueError: 如果日期格式不正确
        """
        try:
            return datetime.strptime(date_str, format)
        except ValueError:
            raise ValueError(f'日期格式不正确，应为 {format}')
    
    @staticmethod
    def validate_date_range(start_date: str, end_date: str) -> tuple:
        """
        验证日期范围
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            tuple: (start_date, end_date) 解析后的日期对象
            
        Raises:
            ValueError: 如果日期格式不正确或结束日期早于开始日期
        """
        # 验证日期格式
        start = Validator.validate_date_format(start_date)
        end = Validator.validate_date_format(end_date)
        
        # 验证结束日期不早于开始日期
        if end < start:
            raise ValueError('结束日期不能早于开始日期')
        
        return start, end
    
    @staticmethod
    def validate_platform(platform: str) -> None:
        """
        验证平台名称
        
        Args:
            platform: 平台名称
            
        Raises:
            ValueError: 如果平台名称无效
        """
        valid_platforms = ['腾讯', '抖音', '小红书']
        if platform not in valid_platforms:
            raise ValueError(f'无效的平台: {platform}，有效值为: {", ".join(valid_platforms)}')
    
    @staticmethod
    def validate_platforms(platforms: List[str]) -> None:
        """
        验证平台列表
        
        Args:
            platforms: 平台列表
            
        Raises:
            ValueError: 如果任何平台名称无效
        """
        for platform in platforms:
            Validator.validate_platform(platform)
    
    @staticmethod
    def validate_business_model(business_model: str) -> None:
        """
        验证业务模式
        
        Args:
            business_model: 业务模式
            
        Raises:
            ValueError: 如果业务模式无效
        """
        valid_business_models = ['直播', '信息流']
        if business_model not in valid_business_models:
            raise ValueError(f'无效的业务模式: {business_model}，有效值为: {", ".join(valid_business_models)}')
    
    @staticmethod
    def validate_positive_integer(value: Any, field_name: str) -> int:
        """
        验证正整数
        
        Args:
            value: 待验证的值
            field_name: 字段名称
            
        Returns:
            int: 验证后的整数值
            
        Raises:
            ValueError: 如果值不是正整数
        """
        try:
            int_value = int(value)
            if int_value <= 0:
                raise ValueError(f'{field_name} 必须是正整数')
            return int_value
        except (ValueError, TypeError):
            raise ValueError(f'{field_name} 必须是正整数')
    
    @staticmethod
    def validate_non_negative_integer(value: Any, field_name: str) -> int:
        """
        验证非负整数
        
        Args:
            value: 待验证的值
            field_name: 字段名称
            
        Returns:
            int: 验证后的整数值
            
        Raises:
            ValueError: 如果值不是非负整数
        """
        try:
            int_value = int(value)
            if int_value < 0:
                raise ValueError(f'{field_name} 必须是非负整数')
            return int_value
        except (ValueError, TypeError):
            raise ValueError(f'{field_name} 必须是非负整数')
    
    @staticmethod
    def validate_float(value: Any, field_name: str) -> float:
        """
        验证浮点数
        
        Args:
            value: 待验证的值
            field_name: 字段名称
            
        Returns:
            float: 验证后的浮点数值
            
        Raises:
            ValueError: 如果值不是浮点数
        """
        try:
            return float(value)
        except (ValueError, TypeError):
            raise ValueError(f'{field_name} 必须是数值')
    
    @staticmethod
    def validate_non_empty_string(value: Any, field_name: str) -> str:
        """
        验证非空字符串
        
        Args:
            value: 待验证的值
            field_name: 字段名称
            
        Returns:
            str: 验证后的字符串
            
        Raises:
            ValueError: 如果值不是非空字符串
        """
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f'{field_name} 不能为空')
        return value.strip()
    
    @staticmethod
    def validate_filters(filters: Dict[str, Any]) -> None:
        """
        验证筛选参数
        
        Args:
            filters: 筛选参数字典
            
        Raises:
            ValueError: 如果任何参数无效
        """
        if not isinstance(filters, dict):
            raise ValueError('filters 必须是字典')
        
        # 验证日期范围
        if 'start_date' in filters and 'end_date' in filters:
            Validator.validate_date_range(filters['start_date'], filters['end_date'])
        elif 'start_date' in filters:
            Validator.validate_date_format(filters['start_date'])
        elif 'end_date' in filters:
            Validator.validate_date_format(filters['end_date'])
        
        # 验证平台列表
        if 'platforms' in filters:
            if not isinstance(filters['platforms'], list):
                raise ValueError('platforms 必须是列表')
            Validator.validate_platforms(filters['platforms'])
        
        # 验证单个平台
        if 'platform' in filters:
            Validator.validate_platform(filters['platform'])
        
        # 验证业务模式
        if 'business_model' in filters:
            Validator.validate_business_model(filters['business_model'])
        
        # 验证分页参数
        if 'page' in filters:
            Validator.validate_positive_integer(filters['page'], 'page')
        if 'per_page' in filters:
            Validator.validate_positive_integer(filters['per_page'], 'per_page')

# 便捷函数
def validate_filters(filters: Dict[str, Any]) -> None:
    """
    验证筛选参数（便捷函数）
    
    Args:
        filters: 筛选参数字典
        
    Raises:
        ValueError: 如果任何参数无效
    """
    Validator.validate_filters(filters)

def validate_date_range(start_date: str, end_date: str) -> tuple:
    """
    验证日期范围（便捷函数）
    
    Args:
        start_date: 开始日期
        end_date: 结束日期
        
    Returns:
        tuple: (start_date, end_date) 解析后的日期对象
        
    Raises:
        ValueError: 如果日期格式不正确或结束日期早于开始日期
    """
    return Validator.validate_date_range(start_date, end_date)

def validate_platforms(platforms: List[str]) -> None:
    """
    验证平台列表（便捷函数）
    
    Args:
        platforms: 平台列表
        
    Raises:
        ValueError: 如果任何平台名称无效
    """
    Validator.validate_platforms(platforms)
