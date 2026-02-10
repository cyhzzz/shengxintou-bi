# -*- coding: utf-8 -*-
"""
小红书内容笔记日级数据处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import XhsNotesContentDaily, XhsNoteInfo
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd
from datetime import datetime


class XhsNotesContentDailyProcessor(DataProcessor):
    """小红书内容笔记日级数据处理器"""

    # 类变量：缓存已检查的note_id，避免重复查询
    _checked_note_ids = set()

    # 列名映射（v3.1 恢复字段版）
    COLUMN_MAPPING = {
        # 核心ID
        '数据日期': 'data_date',
        '笔记id': 'note_id',

        # 笔记基础信息（v3.1 恢复）
        '笔记名称': 'note_title',  # 恢复：用于补充 mapping 表
        '笔记链接': 'note_url',
        '笔记发布时间': 'note_publish_time',  # 恢复：用于补充 mapping 表
        '笔记来源': 'note_source',
        '笔记类型': 'note_type',

        # 创作者信息
        '笔记创作者名称': 'creator_name',
        '笔记创作者ID': 'creator_id',
        '作者粉丝量': 'creator_followers',

        # 运营指标
        '全部曝光量': 'total_impressions',
        '全部阅读量': 'total_reads',
        '全部互动量': 'total_interactions',
    }

    def _auto_create_notes_mapping(self, data: Dict[str, Any]) -> None:
        """
        自动创建笔记映射记录（如果不存在）

        在导入小红书笔记数据时，自动补充 xhs_note_info 表
        对于 mapping 表中缺失的 note_id，自动插入新记录
        其中需要人工维护的 producer 和 ad_strategy 字段留空

        优化：使用类变量缓存已检查的note_id，避免重复查询数据库

        Args:
            data: 处理后的数据字典
        """
        # 首次调用时初始化缓存
        self._initialize_mapping_cache()

        note_id = data.get('note_id')
        if not note_id:
            return

        # 检查缓存（已确认在mapping表中存在的note_id）
        if note_id in self.__class__._checked_note_ids:
            return  # 已确认存在，无需再查询

        # 不在缓存中，说明是新note_id，直接创建映射记录
        # 从 data 中获取所有可用字段，而不是硬编码为 None
        note_title = data.get('note_title')

        new_mapping = XhsNoteInfo(
            note_id=note_id,
            note_title=note_title or '未知笔记',
            note_url=data.get('note_url'),  # 从 data 中获取
            publish_account=data.get('publish_account'),  # 从 data 中获取
            publish_time=data.get('note_publish_time'),  # 修复：从 data 中获取
            producer=data.get('producer'),  # 从 data 中获取
            ad_strategy=data.get('ad_strategy')  # 从 data 中获取
        )
        self.db_session.add(new_mapping)

        # 添加到缓存，避免后续重复查询
        self.__class__._checked_note_ids.add(note_id)

        # 记录提示信息（使用英文避免编码问题）
        self.warnings.append(
            f"Auto-created mapping for note {note_id}. "
            f"Please fill in producer and ad_strategy fields later."
        )

    def after_insert_record(self, data: Dict[str, Any], record: Any) -> None:
        """
        插入记录后自动创建笔记映射记录

        暂时禁用以提升导入性能
        导入完成后可手动运行脚本补充mapping记录

        Args:
            data: 处理后的数据字典
            record: 已插入的 XhsNotesContentDaily 记录
        """
        # 暂时禁用auto-mapping以提升性能
        # self._auto_create_notes_mapping(data)
        pass

    def _initialize_mapping_cache(self) -> None:
        """
        初始化note_id缓存（只执行一次）

        在导入开始时，一次性加载所有mapping表中的note_id到缓存
        这样可以避免在导入过程中重复查询数据库
        """
        # 如果缓存已初始化，跳过
        if hasattr(self, '_cache_initialized') and self._cache_initialized:
            return

        # 批量加载所有note_id
        all_note_ids = set([
            r[0] for r in self.db_session.query(
                XhsNoteInfo.note_id
            ).distinct().all()
        ])

        # 更新类变量缓存
        self.__class__._checked_note_ids.update(all_note_ids)
        self._cache_initialized = True

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['数据日期', 'data_date'],
            ['笔记id', 'note_id']
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证数据日期
        data_date_value = self._get_column_value(row, ['数据日期', 'data_date'])
        if not data_date_value:
            return False, "数据日期为空"

        # 验证笔记ID
        note_id = self._get_column_value(row, ['笔记id', 'note_id'])
        if not note_id:
            return False, "笔记ID为空"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据（v3.1 恢复字段版）

        保留字段：
        - 核心ID: data_date, note_id
        - 笔记基础信息: note_title, note_url, note_publish_time, note_source, note_type
        - 创作者信息: creator_name, creator_id, creator_followers
        - 运营指标: total_impressions, total_reads, total_interactions
        """
        return {
            # 核心ID
            'data_date': self._safe_parse_date(self._get_column_value(row, ['数据日期', 'data_date'])),
            'note_id': self.safe_str(self._get_column_value(row, ['笔记id', 'note_id'])),

            # 笔记基础信息（v3.1 恢复）
            'note_title': self.safe_str(self._get_column_value(row, ['笔记名称', 'note_title'])),
            'note_url': self.safe_str(self._get_column_value(row, ['笔记链接', 'note_url'])),
            'note_publish_time': self._safe_parse_datetime(self._get_column_value(row, ['笔记发布时间', 'note_publish_time'])),
            'note_source': self.safe_str(self._get_column_value(row, ['笔记来源', 'note_source'])),
            'note_type': self.safe_str(self._get_column_value(row, ['笔记类型', 'note_type'])),

            # 创作者信息
            'creator_name': self.safe_str(self._get_column_value(row, ['笔记创作者名称', 'creator_name'])),
            'creator_id': self.safe_str(self._get_column_value(row, ['笔记创作者ID', 'creator_id'])),
            'creator_followers': self._safe_parse_int_comma(self._get_column_value(row, ['作者粉丝量', 'creator_followers'])),

            # 运营指标
            'total_impressions': self._safe_parse_int_comma(self._get_column_value(row, ['全部曝光量', 'total_impressions'])),
            'total_reads': self._safe_parse_int_comma(self._get_column_value(row, ['全部阅读量', 'total_reads'])),
            'total_interactions': self._safe_parse_int_comma(self._get_column_value(row, ['全部互动量', 'total_interactions'])),
        }

    def get_model_class(self):
        """获取模型类"""
        return XhsNotesContentDaily

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['data_date', 'note_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None

    def _safe_parse_date(self, value) -> Optional[datetime]:
        """安全解析日期（YYYYMMDD格式）"""
        if pd.isna(value) or not value:
            return None

        try:
            # 先尝试转换为整数（兼容 numpy.int64 等类型）
            int_value = int(value)

            # 检查是否是 YYYYMMDD 格式的整数
            date_str = str(int_value)
            if len(date_str) == 8 and date_str.isdigit():
                year = int(date_str[0:4])
                month = int(date_str[4:6])
                day = int(date_str[6:8])
                # 验证日期有效性
                if 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
                    return datetime(year, month, day)
        except (ValueError, TypeError):
            pass

        # 其他格式使用默认解析
        return self.safe_date(value)

    def _safe_parse_datetime(self, value) -> Optional[datetime]:
        """安全解析日期时间（YYYY/MM/DD HH:MM格式）"""
        if pd.isna(value) or not value:
            return None

        try:
            # 尝试解析 YYYY/MM/DD HH:MM 格式
            if isinstance(value, str):
                # 替换中文斜杠
                value = value.replace('/', '-').replace('\\', '-')
                return pd.to_datetime(value).to_pydatetime()
            return self.safe_date(value)
        except:
            return None

    def _safe_parse_int_comma(self, value) -> Optional[int]:
        """安全解析整数（去除逗号和空格）"""
        if pd.isna(value) or value == '':
            return 0

        try:
            if isinstance(value, str):
                value = value.replace(',', '').replace(' ', '').replace('，', '')
            return int(float(value)) if value else 0
        except:
            return 0

    def _safe_parse_decimal_comma(self, value) -> Optional[float]:
        """安全解析小数（去除逗号、空格、百分号）"""
        if pd.isna(value) or value == '':
            return None

        try:
            if isinstance(value, str):
                value = value.replace(',', '').replace(' ', '').replace('，', '').replace('%', '')
            return float(value) if value else None
        except:
            return None

    def _safe_parse_percent(self, value) -> Optional[float]:
        """安全解析百分比（如 12.34% -> 0.1234）"""
        if pd.isna(value) or value == '':
            return None

        try:
            if isinstance(value, str):
                value = value.replace(',', '').replace(' ', '').replace('，', '').replace('%', '')
                decimal_val = float(value)
                return decimal_val / 100 if decimal_val > 1 else decimal_val
            elif isinstance(value, (int, float)):
                return float(value) / 100 if value > 1 else float(value)
            return None
        except:
            return None
