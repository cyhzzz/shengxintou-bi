# -*- coding: utf-8 -*-
"""
腾讯广告数据处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import RawAdDataTencent
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class TencentAdsProcessor(DataProcessor):
    """腾讯广告数据处理器"""

    # 列名映射（中文 -> 英文字段名）- 简化版只保留6个核心字段
    # 注意：CSV导出的列名可能是"曝光次数"、"点击次数"等
    COLUMN_MAPPING = {
        '日期': 'date',
        '账户ID': 'account_id',
        '花费': 'cost',
        '曝光量': 'impressions',
        '曝光次数': 'impressions',  # 添加别名
        '点击量': 'clicks',
        '点击次数': 'clicks',  # 添加别名
        '点击用户': 'click_users',
        '点击人数': 'click_users'  # 添加别名
    }

    def get_required_columns(self) -> List[str]:
        """
        获取必需列

        Returns:
            支持中英文列名的列表
        """
        return [
            ['日期', 'date'],
            ['账户ID', 'account_id'],
            ['花费', 'cost']
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """
        验证单行数据

        Args:
            row: pandas Series

        Returns:
            (是否有效, 错误信息)
        """
        # 验证日期
        date_value = self._get_column_value(row, ['日期', 'date'])
        if pd.isna(date_value) or not date_value:
            return False, "日期为空"

        try:
            self.safe_date(date_value)
        except:
            return False, f"日期格式错误: {date_value}"

        # 验证账号ID
        account_id = self._get_column_value(row, ['账户ID', 'account_id'])
        if pd.isna(account_id) or not account_id:
            return False, "账户ID为空"

        # 验证花费（必须为非负数）
        cost_value = self._get_column_value(row, ['花费', 'cost'])
        if cost_value is not None and not pd.isna(cost_value):
            cost = self.safe_float(cost_value)
            # 确保cost是数值类型
            if not isinstance(cost, (int, float)):
                return False, f"花费格式错误: {cost_value}"
            if cost < 0:
                return False, f"花费不能为负数: {cost}"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据，转换为模型字段（简化版 - 只保留6个核心字段）

        Args:
            row: pandas Series

        Returns:
            字段字典
        """
        return {
            'date': self.safe_date(self._get_column_value(row, ['日期', 'date'])),
            'account_id': self.safe_str(self._get_column_value(row, ['账户ID', 'account_id'])),
            'cost': self.safe_float(self._get_column_value(row, ['花费', 'cost'])),
            'impressions': self.safe_int(self._get_column_value(row, ['曝光量', '曝光次数', 'impressions'])),
            'clicks': self.safe_int(self._get_column_value(row, ['点击量', '点击次数', 'clicks'])),
            'click_users': self.safe_int(self._get_column_value(row, ['点击用户', '点击人数', 'click_users']))
        }

    def get_model_class(self):
        """获取 SQLAlchemy 模型类"""
        return RawAdDataTencent

    def get_platform_name(self) -> str:
        """获取平台名称"""
        return '腾讯'

    def get_unique_fields(self) -> List[str]:
        """
        获取唯一性字段

        Returns:
            ['date', 'account_id']
        """
        return ['date', 'account_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """
        获取列值（支持多个候选列名）

        Args:
            row: pandas Series
            column_names: 候选列名列表

        Returns:
            列值
        """
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None
