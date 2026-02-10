# -*- coding: utf-8 -*-
"""
抖音广告数据处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import RawAdDataDouyin
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class DouyinAdsProcessor(DataProcessor):
    """抖音广告数据处理器"""

    # 列名映射（中文 -> 英文字段名）- 简化版只保留6个核心字段
    # 抖音CSV实际使用的列名: 消耗、展示数、点击数、转化数
    COLUMN_MAPPING = {
        '时间-天': 'date',
        '时间': 'date',
        '日期': 'date',
        '账户ID': 'account_id',
        '消耗': 'cost',  # 实际CSV使用'消耗'
        '花费': 'cost',
        '展示数': 'impressions',  # 实际CSV使用'展示数' (注意：不是'展现数')
        '展现数': 'impressions',  # 别名
        '展现': 'impressions',
        '展现量': 'impressions',
        '曝光': 'impressions',
        '点击数': 'clicks',  # 实际CSV使用'点击数'
        '点击': 'clicks',
        '点击量': 'clicks',
        '转化数': 'conversions',  # 实际CSV使用'转化数'
        '转化': 'conversions'
    }

    def validate_columns(self, df: pd.DataFrame) -> bool:
        """
        验证必需列是否存在（支持位置映射，处理列名损坏的情况）

        Args:
            df: DataFrame

        Returns:
            是否包含所有必需列
        """
        required_cols = self.get_required_columns()
        df_cols = df.columns.tolist()

        # 首先尝试通过列名匹配
        missing_cols = []
        for col_group in required_cols:
            # col_group 可能是字符串或列表
            if isinstance(col_group, str):
                col_options = [col_group]
            else:
                col_options = col_group

            # 检查是否至少有一个列名存在
            if not any(col in df_cols for col in col_options):
                missing_cols.append(col_options[0])

        # 如果所有列都缺失（列名损坏），尝试通过位置识别
        if len(missing_cols) == len(required_cols) and len(df.columns) >= 6:
            print("[抖音广告] 警告：列名无法识别，尝试通过位置识别列...")

            # 检查是否有足够的列（至少6列）
            if len(df.columns) >= 6:
                print(f"[抖音广告] 检测到 {len(df.columns)} 列，将按位置映射：")
                print(f"  第1列 -> 日期")
                print(f"  第2列 -> 账户ID")
                print(f"  第3列 -> 账户名称（忽略）")
                print(f"  第4列 -> 花费")
                print(f"  第5列 -> 展示数")
                print(f"  第6列 -> 点击数")
                if len(df.columns) >= 7:
                    print(f"  第7列 -> 转化数（可选）")

                # 重命名列（使用位置映射）
                new_columns = {
                    df.columns[0]: 'date',
                    df.columns[1]: 'account_id',
                    df.columns[2]: '_account_name_ignore',  # 忽略此列
                    df.columns[3]: 'cost',
                    df.columns[4]: 'impressions',
                    df.columns[5]: 'clicks',
                }

                # 如果有第7列，添加转化数
                if len(df.columns) >= 7:
                    new_columns[df.columns[6]] = 'conversions'

                df.rename(columns=new_columns, inplace=True)
                print(f"[抖音广告] 列已重命名: {list(df.columns[:7])}")

                # 重新验证
                df_cols = df.columns.tolist()
                missing_cols = []
                for col_group in required_cols:
                    if isinstance(col_group, str):
                        col_options = [col_group]
                    else:
                        col_options = col_group

                    if not any(col in df_cols for col in col_options):
                        missing_cols.append(col_options[0])

        if missing_cols:
            self.errors.append(f"缺少必需列: {', '.join(missing_cols)}")
            self.errors.append(f"文件列名: {', '.join(df_cols)}")
            self.errors.append(f"提示：请确保文件使用UTF-8编码导出，或使用.xlsx格式")
            return False

        return True

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['时间-天', '时间', '日期', 'date'],
            ['账户ID', 'account_id'],
            ['消耗', '花费', 'cost']  # 添加'消耗'作为首选
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证日期
        date_value = self._get_column_value(row, ['时间-天', '时间', '日期', 'date'])
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

        # 验证花费（优先使用'消耗'列）
        cost_value = self._get_column_value(row, ['消耗', '花费', 'cost'])
        if cost_value is not None and not pd.isna(cost_value):
            cost = self.safe_float(cost_value)
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
            'date': self.safe_date(self._get_column_value(row, ['时间-天', '时间', '日期', 'date'])),
            'account_id': self.safe_str(self._get_column_value(row, ['账户ID', 'account_id'])),
            'cost': self.safe_float(self._get_column_value(row, ['消耗', '花费', 'cost'])),
            'impressions': self.safe_int(self._get_column_value(row, ['展示数', '展现数', '展现', '展现量', 'impressions'])),
            'clicks': self.safe_int(self._get_column_value(row, ['点击数', '点击', '点击量', 'clicks'])),
            'conversions': self.safe_int(self._get_column_value(row, ['转化数', '转化', 'conversions']))
        }

    def get_model_class(self):
        """获取模型类"""
        return RawAdDataDouyin

    def get_platform_name(self) -> str:
        """获取平台名称"""
        return '抖音'

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['date', 'account_id']

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None
