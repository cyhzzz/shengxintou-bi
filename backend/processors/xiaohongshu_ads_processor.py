# -*- coding: utf-8 -*-
"""
小红书广告数据处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import RawAdDataXiaohongshu
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class XiaohongshuAdsProcessor(DataProcessor):
    """小红书广告数据处理器

    业务逻辑：
    - 代理商投放：有 advertiser_account_id + sub_account_id
    - 申万宏源直投：有 advertiser_account_id，sub_account_id 为 NULL
    """

    # 列名映射 - 简化版只保留7个核心字段（新增主账户ID）
    # 小红书CSV实际使用的列名: 周期、广告主账户ID、代理商子账户ID、总消耗、总展现、总点击、私信进线数
    COLUMN_MAPPING = {
        '周期': 'date',  # 实际CSV使用'周期'（格式: YYYYMMDD）
        '日期': 'date',
        '广告主账户ID': 'advertiser_account_id',  # 实际CSV使用（主账户ID，必填）
        '主账户ID': 'advertiser_account_id',
        '代理商子账户ID': 'sub_account_id',  # 实际CSV使用完整名称（可为空）
        '子账户ID': 'sub_account_id',
        '总消耗': 'cost',  # 实际CSV使用'总消耗'
        '花费': 'cost',
        '总展现': 'impressions',  # 实际CSV使用'总展现'
        '曝光量': 'impressions',
        '总点击': 'clicks',  # 实际CSV使用'总点击'
        '点击量': 'clicks',
        '私信进线数': 'private_messages',  # 实际CSV使用
        '私信量': 'private_messages'
    }

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['周期', '日期', 'date'],  # 日期
            ['广告主账户ID', '主账户ID', 'advertiser_account_id'],  # 主账户ID（必填）
            ['总消耗', '花费', 'cost']  # 花费
        ]

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证日期
        date_value = self._get_column_value(row, ['周期', '日期', 'date'])
        if pd.isna(date_value) or not date_value:
            return False, "日期为空"

        try:
            self.safe_date(date_value)
        except:
            return False, f"日期格式错误: {date_value}"

        # 验证主账户ID（必填）
        advertiser_account_id = self._get_column_value(row, ['广告主账户ID', '主账户ID', 'advertiser_account_id'])
        if pd.isna(advertiser_account_id) or not advertiser_account_id:
            return False, "主账户ID为空"

        # 子账户ID允许为空（申万宏源直投情况）

        # 验证花费
        cost_value = self._get_column_value(row, ['总消耗', '花费', 'cost'])
        if cost_value is not None and not pd.isna(cost_value):
            cost = self.safe_float(cost_value)
            if cost < 0:
                return False, f"花费不能为负数: {cost}"

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """
        处理单行数据，转换为模型字段（简化版 - 保留7个核心字段）

        Args:
            row: pandas Series

        Returns:
            字段字典
        """
        return {
            'date': self.safe_date(self._get_column_value(row, ['周期', '日期', 'date'])),
            'advertiser_account_id': self.safe_str(self._get_column_value(row, ['广告主账户ID', '主账户ID', 'advertiser_account_id'])),
            'sub_account_id': self.safe_str(self._get_column_value(row, ['代理商子账户ID', '子账户ID', 'sub_account_id'])),  # 允许为None
            'cost': self.safe_float(self._get_column_value(row, ['总消耗', '花费', 'cost'])),
            'impressions': self.safe_int(self._get_column_value(row, ['总展现', '曝光量', 'impressions'])),
            'clicks': self.safe_int(self._get_column_value(row, ['总点击', '点击量', 'clicks'])),
            'private_messages': self.safe_int(self._get_column_value(row, ['私信进线数', '私信量', 'private_messages']))
        }

    def get_model_class(self):
        """获取模型类"""
        return RawAdDataXiaohongshu

    def get_platform_name(self) -> str:
        """获取平台名称"""
        return '小红书'

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段（小红书使用 date + advertiser_account_id + sub_account_id）"""
        return ['date', 'advertiser_account_id', 'sub_account_id']

    def _auto_create_account_mapping(self, data: Dict[str, Any]) -> None:
        """
        小红书特殊处理：自动创建账号映射
        小红书有主账号和子账号两种情况
        """
        from backend.models import AccountAgencyMapping

        advertiser_account_id = data.get('advertiser_account_id')
        sub_account_id = data.get('sub_account_id')

        if not advertiser_account_id:
            return

        # 场景1：有子账号ID（代理商子账户）
        if sub_account_id:
            # 检查是否已存在映射
            existing = self.db_session.query(AccountAgencyMapping).filter_by(
                platform='小红书',
                account_id=str(sub_account_id)
            ).first()

            if not existing:
                # 创建代理商子账户映射（使用默认值）
                new_mapping = AccountAgencyMapping(
                    platform='小红书',
                    account_id=str(sub_account_id),
                    main_account_id=str(advertiser_account_id),
                    account_name=None,       # 用户需要补充
                    sub_account_name=None,   # 用户需要补充
                    agency='未分配',          # 使用默认值
                    business_model='信息流'   # 使用默认值
                )
                self.db_session.add(new_mapping)

                self.warnings.append(
                    f"发现新小红书账号（代理商子账户）- 主账户:{advertiser_account_id}, 子账户:{sub_account_id}。"
                    f"默认设置：代理商='未分配'，业务模式='信息流'。"
                    f"请在账号管理中补充完整信息"
                )

        # 场景2：无子账号ID（品牌主账户/直投）
        else:
            # 检查是否已存在映射（通过main_account_id查找）
            existing = self.db_session.query(AccountAgencyMapping).filter_by(
                platform='小红书',
                main_account_id=str(advertiser_account_id),
                account_id=None  # 品牌主账户account_id为NULL
            ).first()

            if not existing:
                # 创建品牌主账户映射（使用默认值）
                new_mapping = AccountAgencyMapping(
                    platform='小红书',
                    account_id=None,  # 品牌主账户没有子账号ID
                    main_account_id=str(advertiser_account_id),
                    account_name=None,       # 用户需要补充
                    sub_account_name=None,
                    agency='未分配',          # 使用默认值
                    business_model='信息流'   # 使用默认值
                )
                self.db_session.add(new_mapping)

                self.warnings.append(
                    f"发现新小红书账号（品牌主账户/直投）- 主账户:{advertiser_account_id}。"
                    f"默认设置：代理商='未分配'，业务模式='信息流'。"
                    f"请在账号管理中补充完整信息"
                )

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None
