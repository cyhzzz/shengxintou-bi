# -*- coding: utf-8 -*-
"""
账号代理商映射处理器
"""

from backend.processors.base_processor import DataProcessor
from backend.models import AccountAgencyMapping
from typing import Dict, List, Tuple, Any, Optional
import pandas as pd


class AccountMappingProcessor(DataProcessor):
    """账号代理商映射处理器"""

    # 列名映射
    COLUMN_MAPPING = {
        '平台': 'platform',
        '账号ID': 'account_id',
        '账号名称': 'account_name',
        '代理商': 'agency',
        '业务模式': 'business_model'
    }

    # 支持的业务模式
    BUSINESS_MODELS = ['直播', '信息流', '搜索']

    # 支持的平台
    PLATFORMS = ['腾讯', '抖音', '小红书']

    def get_required_columns(self) -> List[str]:
        """获取必需列"""
        return [
            ['平台', 'platform'],
            ['账号ID', 'account_id']
        ]
        # 代理商和业务模式是可选的，因为可以从其他渠道获取

    def validate_row(self, row: pd.Series) -> Tuple[bool, Optional[str]]:
        """验证单行数据"""
        # 验证平台
        platform = self._get_column_value(row, ['平台', 'platform'])
        if not platform:
            return False, "平台为空"

        platform_normalized = self._normalize_platform(platform)
        if platform_normalized not in self.PLATFORMS:
            return False, f"不支持的平台: {platform}（支持: {', '.join(self.PLATFORMS)}）"

        # 验证账号ID
        account_id = self._get_column_value(row, ['账号ID', 'account_id'])
        if not account_id:
            return False, "账号ID为空"

        # 代理商和业务模式现在是可选的，不再验证

        return True, None

    def process_row(self, row: pd.Series) -> Dict[str, Any]:
        """处理单行数据"""
        platform = self._get_column_value(row, ['平台', 'platform'])
        account_id = self._get_column_value(row, ['账号ID', 'account_id'])

        return {
            'platform': self._normalize_platform(platform),
            'account_id': self.safe_str(account_id),
            'account_name': self.safe_str(self._get_column_value(row, ['账号名称', 'account_name'])),
            'agency': self.safe_str(self._get_column_value(row, ['代理商', 'agency'])),
            'business_model': self._normalize_business_model(
                self._get_column_value(row, ['业务模式', 'business_model'])
            )
        }

    def get_model_class(self):
        """获取模型类"""
        return AccountAgencyMapping

    def get_unique_fields(self) -> List[str]:
        """获取唯一性字段"""
        return ['platform', 'account_id']

    def _normalize_platform(self, platform: Optional[str]) -> Optional[str]:
        """规范化平台名称"""
        if not platform:
            return None

        platform_map = {
            '腾讯': '腾讯',
            '腾讯广告': '腾讯',
            'tencent': '腾讯',
            '抖音': '抖音',
            '抖音广告': '抖音',
            'douyin': '抖音',
            '字节': '抖音',
            '小红书': '小红书',
            '小红书广告': '小红书',
            'xiaohongshu': '小红书',
            'xhs': '小红书'
        }

        return platform_map.get(platform.lower().strip(), platform.strip())

    def _normalize_business_model(self, business_model: Optional[str]) -> Optional[str]:
        """规范化业务模式"""
        if pd.isna(business_model) or not business_model:
            return None

        # 如果是浮点数（NaN），返回None
        if isinstance(business_model, float):
            return None

        business_model_map = {
            '直播': '直播',
            '信息流': '信息流',
            '搜索': '搜索',
            'live': '直播',
            'feed': '信息流',
            'search': '搜索'
        }

        # 确保是字符串
        if not isinstance(business_model, str):
            business_model = str(business_model)

        normalized = business_model_map.get(business_model.lower().strip())
        return normalized if normalized else business_model.strip()

    def _get_column_value(self, row: pd.Series, column_names: List[str]) -> Any:
        """获取列值（支持多个候选列名）"""
        for col_name in column_names:
            if col_name in row.index:
                return row[col_name]
        return None

    def import_data(
        self,
        file_path: str,
        overwrite: bool = True,  # 默认开启覆盖模式
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """
        导入数据（覆盖模式默认开启）

        映射表的特殊处理:
        - 默认开启覆盖模式（overwrite=True）
        - 存在则更新，不存在则插入
        """
        return super().import_data(file_path, overwrite=overwrite, batch_size=batch_size)
