# -*- coding: utf-8 -*-
"""
WebDAV 备份客户端
用于坚果云 WebDAV 数据库备份和恢复
"""

from webdav3.client import Client
from webdav3.exceptions import WebDavException, RemoteResourceNotFound
import os
import hashlib
from datetime import datetime
import requests
from requests.auth import HTTPBasicAuth
import gzip
import tempfile


class WebDAVBackupClient:
    """WebDAV 备份客户端"""

    def __init__(self, url, username, password, backup_dir='/'):
        """
        初始化 WebDAV 客户端

        Args:
            url: WebDAV 服务器地址
            username: 用户名
            password: 密码
            backup_dir: 备份目录路径
        """
        self.url = url
        self.username = username
        self.password = password
        # 移除路径两端的斜杠，统一格式
        self.backup_dir = backup_dir.strip('/')

        # 初始化 WebDAV 客户端（先连接到根目录）
        options = {
            'webdav_hostname': url,
            'webdav_login': username,
            'webdav_password': password,
            'webdav_root': '/',
        }
        self.client = Client(options)
        self.auth = HTTPBasicAuth(username, password)

        # 确保备份目录存在
        self._ensure_backup_dir_exists()

    def _get_remote_path(self, filename):
        """获取完整的远程路径"""
        if not self.backup_dir or self.backup_dir == '':
            return filename
        return f'{self.backup_dir}/{filename}'

    def _get_remote_url(self, filename):
        """获取完整的远程 URL"""
        path = self._get_remote_path(filename)
        # 确保路径格式正确：备份目录/文件名
        return f'{self.url}{path}'

    def _ensure_backup_dir_exists(self):
        """确保备份目录存在"""
        if self.backup_dir and self.backup_dir != '/':
            try:
                # 尝试列出目录，如果不存在会抛出异常
                self.client.list(self.backup_dir)
                # 如果成功列出，说明目录存在
                print(f"Backup directory exists: {self.backup_dir}")
            except WebDavException as list_err:
                # 目录不存在，尝试创建
                try:
                    self.client.mkdir(self.backup_dir)
                    print(f"Created backup directory: {self.backup_dir}")
                except WebDavException as mkdir_err:
                    # 创建失败，可能是父目录不存在或其他权限问题
                    print(f"Warning: Could not create backup directory: {mkdir_err}")
                    print(f"Attempting to continue anyway...")
                    # 不抛出异常，让后续操作决定是否失败

    def upload_backup(self, local_db_path, description='', use_compression=False):
        """
        上传备份到坚果云（使用 requests 库以确保兼容性）

        Args:
            local_db_path: 本地数据库文件路径
            description: 备份描述
            use_compression: 是否使用gzip压缩

        Returns:
            dict: {
                'filename': 'backup_20260122_153000.db',
                'size': 1024000,
                'original_size': 10240000,  # 原始文件大小（压缩前）
                'md5': 'abc123...',
                'upload_time': '2026-01-22 15:30:00',
                'compressed': True
            }
        """
        # 生成备份文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        extension = '.db.gz' if use_compression else '.db'
        filename = f'backup_{timestamp}{extension}'

        # 计算本地文件 MD5 和大小
        original_size = os.path.getsize(local_db_path)
        local_md5 = self._calculate_md5(local_db_path)

        # 如果启用压缩，先压缩文件
        file_to_upload = local_db_path
        if use_compression:
            # 创建临时压缩文件
            temp_compressed = tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.db.gz')
            temp_compressed_path = temp_compressed.name
            temp_compressed.close()

            try:
                # 使用gzip压缩
                with open(local_db_path, 'rb') as f_in:
                    with gzip.open(temp_compressed_path, 'wb') as f_out:
                        f_out.writelines(f_in)

                file_to_upload = temp_compressed_path
                print(f"Compressed {original_size / 1024 / 1024:.2f} MB to {os.path.getsize(temp_compressed_path) / 1024 / 1024:.2f} MB")
            except Exception as e:
                # 压缩失败，使用原始文件
                print(f"Compression failed, using original file: {str(e)}")
                if os.path.exists(temp_compressed_path):
                    os.remove(temp_compressed_path)
                use_compression = False

        # 上传文件（使用 requests 库直接调用 PUT 方法）
        remote_url = self._get_remote_url(filename)

        # 获取上传文件大小（在上传前）
        file_size = os.path.getsize(file_to_upload)

        try:
            with open(file_to_upload, 'rb') as f:
                response = requests.put(remote_url, data=f, auth=self.auth)

            if response.status_code not in [200, 201, 204]:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

        except Exception as e:
            raise Exception(f"上传失败: {str(e)}")

        finally:
            # 清理临时压缩文件
            if use_compression and file_to_upload != local_db_path and os.path.exists(file_to_upload):
                os.remove(file_to_upload)

        return {
            'filename': filename,
            'size': file_size,
            'original_size': original_size if use_compression else None,
            'md5': local_md5,
            'upload_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'description': description,
            'compressed': use_compression
        }

    def download_backup(self, filename, local_db_path):
        """
        从坚果云下载备份

        Args:
            filename: 备份文件名（支持 .db 和 .db.gz）
            local_db_path: 本地保存路径

        Returns:
            bool: 是否下载成功
        """
        try:
            import tempfile

            remote_url = self._get_remote_url(filename)

            # 检查是否是压缩文件
            is_compressed = filename.endswith('.gz')
            temp_download_path = None

            if is_compressed:
                # 下载到临时文件
                with tempfile.NamedTemporaryFile(delete=False, suffix='.db.gz') as tmp:
                    temp_download_path = tmp.name

                try:
                    # 下载压缩文件
                    response = requests.get(remote_url, auth=self.auth, stream=True)
                    if response.status_code not in [200, 206]:
                        raise Exception(f"HTTP {response.status_code}: {response.text}")

                    with open(temp_download_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)

                    # 解压到目标路径
                    with gzip.open(temp_download_path, 'rb') as f_in:
                        with open(local_db_path, 'wb') as f_out:
                            f_out.writelines(f_in)

                    print(f"Downloaded and decompressed: {filename} -> {local_db_path}")

                finally:
                    # 清理临时文件
                    if temp_download_path and os.path.exists(temp_download_path):
                        os.remove(temp_download_path)
            else:
                # 直接下载
                response = requests.get(remote_url, auth=self.auth, stream=True)
                if response.status_code not in [200, 206]:
                    raise Exception(f"HTTP {response.status_code}: {response.text}")

                with open(local_db_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                print(f"Downloaded: {filename} -> {local_db_path}")

            return True

        except Exception as e:
            raise Exception(f"下载失败: {str(e)}")

    def list_backups(self):
        """
        列出所有备份文件（使用 requests 库以确保兼容性）

        Returns:
            list: [
                {
                    'filename': 'backup_20260122_153000.db',
                    'size': 1024000,
                    'created': '2026-01-22 15:30:00',
                    'description': ''
                },
                ...
            ]
        """
        try:
            import xml.etree.ElementTree as ET

            # 构建备份目录 URL
            if self.backup_dir:
                list_url = f'{self.url}{self.backup_dir}/'
            else:
                list_url = self.url

            # 发送 PROPFIND 请求
            headers = {
                'Depth': '1'
            }
            response = requests.request(
                method='PROPFIND',
                url=list_url,
                headers=headers,
                auth=self.auth
            )

            if response.status_code != 207:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            # 解析 XML 响应
            root = ET.fromstring(response.content)
            backups = []

            # 命名空间
            namespaces = {
                'D': 'DAV:',
                's': 'http://ns.jianguoyun.com'
            }

            # 遍历响应中的文件
            for response_elem in root.findall('.//D:response', namespaces):
                # 获取文件路径
                href_elem = response_elem.find('D:href', namespaces)
                if href_elem is None:
                    continue

                href = href_elem.text
                # 提取文件名（URL 的最后一部分）
                filename = href.rstrip('/').split('/')[-1]

                # 只处理备份文件（.db 或 .db.gz）
                if not (filename.endswith('.db') or filename.endswith('.db.gz')):
                    continue

                # 获取文件属性
                propstat_elem = response_elem.find('D:propstat', namespaces)
                if propstat_elem is None:
                    continue

                prop_elem = propstat_elem.find('D:prop', namespaces)
                if prop_elem is None:
                    continue

                # 获取文件大小
                size_elem = prop_elem.find('D:getcontentlength', namespaces)
                size = int(size_elem.text) if size_elem is not None else 0

                # 获取修改时间
                modified_elem = prop_elem.find('D:getlastmodified', namespaces)
                if modified_elem is not None:
                    modified = modified_elem.text
                    # 转换时间格式（UTC -> 北京时间 UTC+8）
                    try:
                        from datetime import datetime as dt, timedelta
                        # 解析 UTC 时间（格式：Wed, 22 Jan 2025 03:25:30 GMT）
                        parsed_time = dt.strptime(modified, '%a, %d %b %Y %H:%M:%S %Z')
                        # 转换为北京时间（UTC+8）
                        beijing_time = parsed_time + timedelta(hours=8)
                        created = beijing_time.strftime('%Y-%m-%d %H:%M:%S')
                    except Exception as e:
                        # 如果解析失败，使用原始字符串
                        print(f"Warning: Failed to parse time '{modified}': {e}")
                        created = str(modified)
                else:
                    created = ''

                backups.append({
                    'filename': filename,
                    'size': size,
                    'created': created,
                    'description': ''
                })

            # 按创建时间倒序排序
            backups.sort(key=lambda x: x['created'], reverse=True)
            return backups

        except Exception as e:
            raise Exception(f"获取备份列表失败: {str(e)}")

    def delete_backup(self, filename):
        """
        删除备份文件（使用 requests 库以确保兼容性）

        Args:
            filename: 备份文件名

        Returns:
            bool: 是否删除成功
        """
        try:
            remote_url = self._get_remote_url(filename)
            response = requests.delete(remote_url, auth=self.auth)

            if response.status_code not in [200, 204]:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            return True
        except Exception as e:
            raise Exception(f"删除失败: {str(e)}")

    def verify_backup(self, filename, expected_md5):
        """
        验证备份文件完整性

        Args:
            filename: 备份文件名
            expected_md5: 预期的 MD5 值

        Returns:
            bool: 是否通过验证
        """
        # 下载到临时文件
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name

        try:
            self.download_backup(filename, tmp_path)
            actual_md5 = self._calculate_md5(tmp_path)
            return actual_md5 == expected_md5
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def _calculate_md5(self, file_path):
        """
        计算文件的 MD5 哈希值

        Args:
            file_path: 文件路径

        Returns:
            str: MD5 哈希值（十六进制字符串）
        """
        md5_hash = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()

    def upload_file(self, local_file_path, remote_filename):
        """
        上传任意文件到坚果云

        Args:
            local_file_path: 本地文件路径
            remote_filename: 远程文件名

        Returns:
            bool: 是否上传成功
        """
        try:
            remote_url = self._get_remote_url(remote_filename)

            with open(local_file_path, 'rb') as f:
                response = requests.put(remote_url, data=f, auth=self.auth)

            if response.status_code not in [200, 201, 204]:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            print(f"Uploaded: {local_file_path} -> {remote_filename}")
            return True

        except Exception as e:
            raise Exception(f"上传文件失败: {str(e)}")
