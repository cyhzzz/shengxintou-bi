# -*- coding: utf-8 -*-
"""
小红书笔记日级数据处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import XhsNotesDaily
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class XhsNotesDailyProcessor(DataProcessor):
    """小红书笔记日级数据处理器"""

    # 列名映射（v3.2 Final - 核心字段 + 账户ID字段 + 基础属性字段）
    COLUMN_MAPPING = {
        # 日期和笔记ID
        '时间': 'date',
        '日期': 'date',
        '笔记ID': 'note_id',
        '笔记/素材ID': 'note_id',

        # 基础属性字段（v3.2 新增：提高可读性）
        '笔记标题': 'note_title',
        '笔记名称': 'note_title',
        '笔记链接': 'note_url',
        '链接': 'note_url',
        '笔记/素材链接': 'note_url',  # 新增：支持最新导出格式

        # 账户ID字段（v3.1 新增，用于代理商分析）
        '广告主账户ID': 'advertiser_account_id',
        '主账户ID': 'advertiser_account_id',
        '子账户ID': 'sub_account_id',
        '代理商子账户ID': 'sub_account_id',

        # 花费相关（支持多种列名）
        '花费': 'cost',
        '消费': 'cost',
        '消耗流水': 'cost',   # 新增：支持最新导出格式
        '广告流水': 'cost',   # 实际Excel文件中的列名

        # 曝光相关
        '曝光量': 'impressions',
        '展现量': 'impressions',
        '点击量': 'clicks',

        # 互动指标（支持带"数"和不带"数"的格式）
        '点赞数': 'likes',
        '点赞': 'likes',
        '评论数': 'comments',
        '评论': 'comments',
        '收藏数': 'favorites',
        '收藏': 'favorites',
        '关注数': 'follows',
        '关注': 'follows',
        '分享数': 'shares',
        '分享': 'shares',
        '总互动量': 'total_interactions',
        '互动量': 'total_interactions',
        '互动': 'total_interactions',

        # 私信转化（只保留进线数）
        '私信进线数': 'private_message_leads',
        '私信进线量': 'private_message_leads',  # 新增：匹配最新导出格式
        '私信线索量': 'private_message_leads',
        '私信留资人数': 'private_message_leads',
    }

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['时间', '日期', 'date'],  # 添加'时间'支持
            ['笔记ID', '笔记/素材ID', 'note_id']  # 支持'笔记/素材ID'
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证日期
        date_value = self._get_column_value(row, ['时间', '日期', 'date'])
        if pd.isna(date_value) or not date_value:
            return False, "日期为空"

        try:
            self.safe_date(date_value)
        except:
            return False, f"日期格式错误: {date_value}"

        # 验证笔记ID（必须不为空）
        note_id = self._get_column_value(row, ['笔记ID', '笔记/素材ID', 'note_id'])
        if pd.isna(note_id) or not note_id:
            return False, "笔记ID为空"

        # 验证花费（必须为非负数）
        cost_value = self._get_column_value(row, ['花费', '消费', '消耗流水', '广告流水', 'cost'])
        if not pd.isna(cost_value) and cost_value is not None:
            cost = self.safe_float(cost_value)
            if cost < 0:
                return False, f"花费不能为负数: {cost}"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据（v3.2 Final）

        核心字段：
        - 核心ID: date, note_id
        - 基础属性: note_title, note_url（v3.2 新增）
        - 账户ID: advertiser_account_id, sub_account_id（v3.1 新增）
        - 广告指标: cost, impressions, clicks
        - 互动指标: likes, comments, favorites, follows, shares, total_interactions
        - 私信指标: private_message_leads（只保留进线数）
        """
        return {
            # 核心ID
            'date': self.safe_date(self._get_column_value(row, ['时间', '日期', 'date'])),
            'note_id': self.safe_str(self._get_column_value(row, ['笔记ID', '笔记/素材ID', 'note_id'])),

            # 基础属性字段（v3.2 新增：提高可读性）
            'note_title': self.safe_str(self._get_column_value(row, ['笔记标题', '笔记名称', 'note_title'])),
            'note_url': self.safe_str(self._get_column_value(row, ['笔记链接', '链接', '笔记/素材链接', 'note_url'])),

            # 账户ID字段（v3.1 新增，用于代理商分析）
            'advertiser_account_id': self.safe_str(self._get_column_value(row, ['广告主账户ID', '主账户ID', 'advertiser_account_id'])),
            'sub_account_id': self.safe_str(self._get_column_value(row, ['子账户ID', '代理商子账户ID', 'sub_account_id'])),

            # 花费相关（支持多种列名）
            'cost': self.safe_float(self._get_column_value(row, ['花费', '消费', '消耗流水', '广告流水', 'cost'])),

            # 曝光相关（支持多种列名）
            'impressions': self.safe_int(self._get_column_value(row, ['曝光量', '展现量', 'impressions'])),
            'clicks': self.safe_int(self._get_column_value(row, ['点击量', 'clicks'])),

            # 互动指标（支持多种列名）
            'likes': self.safe_int(self._get_column_value(row, ['点赞数', '点赞', 'likes'])),
            'comments': self.safe_int(self._get_column_value(row, ['评论数', '评论', 'comments'])),
            'favorites': self.safe_int(self._get_column_value(row, ['收藏数', '收藏', 'favorites'])),
            'follows': self.safe_int(self._get_column_value(row, ['关注数', '关注', 'follows'])),
            'shares': self.safe_int(self._get_column_value(row, ['分享数', '分享', 'shares'])),
            'total_interactions': self.safe_int(self._get_column_value(row, ['总互动量', '互动量', '互动', 'total_interactions'])),

            # 私信转化（只保留进线数）
            # 注意：当列名无法匹配时，使用位置14（第15列）作为回退
            'private_message_leads': self.safe_int(self._get_column_value(
                row,
                ['私信进线数', '私信进线量', '私信线索量', '私信留资人数', 'private_message_leads'],
                position=14  # 位置回退：第15列（索引14）
            )),
        }

    def get_model_class(self):
        """获取模型类"""
        return XhsNotesDaily

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['date', 'note_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str], position: int = None) -> Any:
        """获取列值（支持多个候选列名，支持位置回退）

        Args:
            row: 数据行
            column_names: 候选列名列表
            position: 可选的位置索引（当列名无法匹配时使用）

        Returns:
            列值，如果找不到则返回 None
        """
        # 首先尝试通过列名匹配
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]

        # 如果指定了位置索引且列名匹配失败，使用位置回退
        if position is not None and position < len(row):
            return row.iloc[position]

        return None

    def update_mapping_table(self, notes_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        自动补充 xhs_note_info 表（v3.2 新增）

        数据来源：从导入的 xhs_notes_daily 数据中提取基础属性

        逻辑：
        - 如果 note_id 不在 mapping 表中，创建新记录
        - 如果 note_id 已存在但字段为空，更新字段

        Args:
            notes_data: 导入的笔记数据列表

        Returns:
            统计结果字典
        """
        from backend.models import XhsNoteInfo

        new_count = 0
        updated_count = 0

        for data in notes_data:
            note_id = data.get('note_id')
            if not note_id:
                continue

            # 检查 mapping 表中是否已存在
            mapping = self.db_session.query(XhsNoteInfo).filter(
                XhsNoteInfo.note_id == note_id
            ).first()

            if mapping:
                # 已存在，更新空字段
                updated = False
                if not mapping.note_title and data.get('note_title'):
                    mapping.note_title = data['note_title']
                    updated = True
                if not mapping.note_url and data.get('note_url'):
                    mapping.note_url = data['note_url']
                    updated = True

                if updated:
                    updated_count += 1
            else:
                # 不存在，创建新记录
                new_mapping = XhsNoteInfo(
                    note_id=note_id,
                    note_title=data.get('note_title'),
                    note_url=data.get('note_url')
                )
                self.db_session.add(new_mapping)
                new_count += 1

        # 提交
        self.db_session.commit()

        return {
            'new_count': new_count,
            'updated_count': updated_count
        }

    def calculate_engagement_rate(self, row: pd.Series) -> float:
        """
        计算互动率

        Args:
            row: 数据行

        Returns:
            互动率（百分比）
        """
        impressions = self.safe_int(self._get_column_value(row, ['曝光量', 'impressions']))
        total_interactions = self.safe_int(self._get_column_value(row, ['总互动量', 'total_interactions']))

        if impressions > 0:
            return round((total_interactions / impressions) * 100, 2)
        return 0.0
