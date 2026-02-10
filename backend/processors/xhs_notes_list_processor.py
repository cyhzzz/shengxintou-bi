# -*- coding: utf-8 -*-
"""
小红书笔记列表处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import XhsNoteInfo
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class XhsNotesListProcessor(DataProcessor):
    """小红书笔记列表处理器"""

    # 列名映射
    COLUMN_MAPPING = {
        '笔记ID': 'note_id',
        '笔记id': 'note_id',
        'note_id': 'note_id',
        '笔记标题': 'note_title',
        '笔记名称': 'note_title',
        'note_title': 'note_title',
        '发布账号': 'publish_account',
        'publish_account': 'publish_account',
        '发布时间': 'publish_time',
        '笔记发布时间': 'publish_time',
        'publish_time': 'publish_time',
        '生产者': 'producer',
        'producer': 'producer',
        '广告策略': 'ad_strategy',
        'ad_strategy': 'ad_strategy'
    }

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['笔记ID', '笔记id', 'note_id']  # 支持多种列名格式
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证笔记ID（支持多种列名）
        note_id = self._get_column_value(row, ['笔记ID', '笔记id', 'note_id'])
        if not note_id:
            return False, "笔记ID为空"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """处理单行数据"""
        return {
            'note_id': self.safe_str(self._get_column_value(row, ['笔记ID', '笔记id', 'note_id'])),
            'note_title': self.safe_str(self._get_column_value(row, ['笔记标题', '笔记名称', 'note_title'])),
            'publish_account': self.safe_str(self._get_column_value(row, ['发布账号', 'publish_account'])),
            'publish_time': self.safe_date(self._get_column_value(row, ['发布时间', '笔记发布时间', 'publish_time'])),
            'producer': self.safe_str(self._get_column_value(row, ['生产者', 'producer'])),
            'ad_strategy': self.safe_str(self._get_column_value(row, ['广告策略', 'ad_strategy']))
        }

    def get_model_class(self):
        """获取模型类"""
        return XhsNoteInfo

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['note_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None
