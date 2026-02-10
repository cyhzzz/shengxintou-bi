# -*- coding: utf-8 -*-
"""
省心投 BI - 配置文件
"""

import os
import sys
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

# 获取应用基础目录（兼容开发环境和PyInstaller打包环境）
if getattr(sys, 'frozen', False):
    # PyInstaller 打包后的环境
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 开发环境
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# 数据库配置
DATABASE_PATH = os.path.join(BASE_DIR, os.getenv('DATABASE_PATH', 'database/shengxintou.db'))
SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
SQLALCHEMY_TRACK_MODIFICATIONS = False

# 文件上传配置
UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv('UPLOAD_FOLDER', 'uploads'))
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', '50')) * 1024 * 1024  # MB -> bytes
ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_EXTENSIONS', 'csv,xlsx,xls').split(','))

# API配置
API_VERSION = 'v1'
API_PREFIX = f'/api/{API_VERSION}'

# 日志配置
LOG_FOLDER = os.path.join(BASE_DIR, os.getenv('LOG_FOLDER', 'logs'))
LOG_FILE = os.path.join(LOG_FOLDER, 'app.log')
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# 服务器配置
HOST = os.getenv('HOST', 'localhost')
PORT = int(os.getenv('PORT', '5000'))
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

# 支持的文件编码
FILE_ENCODINGS = ['utf-8', 'gb2312', 'gbk', 'gb18030', 'latin1']

# 平台配置
PLATFORMS = ['腾讯', '抖音', '小红书']

# 业务模式
BUSINESS_MODELS = ['直播', '信息流']

# 飞书配置
FEISHU_ENABLED = os.getenv('FEISHU_ENABLED', 'true').lower() == 'true'
FEISHU_APP_ID = os.getenv('FEISHU_APP_ID', '')
FEISHU_APP_SECRET = os.getenv('FEISHU_APP_SECRET', '')
FEISHU_BITABLE_ID = os.getenv('FEISHU_BITABLE_ID', '')

# 飞书表格ID映射（数据库表名 -> 飞书表格ID）
FEISHU_TABLE_IDS = {
    'daily_metrics_unified': 'tblTqwIacpXIHETD',  # 日报数据汇总
    'backend_conversions': 'tblzxKjQ1SRuTIdH',  # 后端转化明细
    'xhs_notes_daily': 'tblCj1gQUiVRBbg7',  # 小红书笔记日报
    'daily_notes_metrics_unified': 'tblwHdlZHHoY8JXM',  # 笔记日报汇总
}

# WebDAV 备份配置（坚果云）
WEBDAV_ENABLED = os.getenv('WEBDAV_ENABLED', 'true').lower() == 'true'
WEBDAV_URL = os.getenv('WEBDAV_URL', '')
WEBDAV_USERNAME = os.getenv('WEBDAV_USERNAME', '')
WEBDAV_PASSWORD = os.getenv('WEBDAV_PASSWORD', '')
# 支持 WEBDAV_BASE_PATH 和 WEBDAV_BACKUP_DIR 两种配置项名称
WEBDAV_BACKUP_DIR = os.getenv('WEBDAV_BASE_PATH') or os.getenv('WEBDAV_BACKUP_DIR', '/shengxintou-backup')
WEBDAV_MAX_BACKUPS = int(os.getenv('WEBDAV_MAX_BACKUPS', '3'))
WEBDAV_USE_COMPRESSION = os.getenv('WEBDAV_USE_COMPRESSION', 'true').lower() == 'true'
