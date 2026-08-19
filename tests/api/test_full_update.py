# -*- coding: utf-8 -*-
"""
完整静默更新（v3.9.0）结构校验单测。

只测 self_update.py 的 `_validate_full_update_zip`（纯内存 zip 解析）：
  - 合法 full-update.zip（server/ + backend/ + app.py + config.py + dist/ + version.json）→ 返回 version
  - 缺 server/server.exe → 抛 ValueError
  - 缺 backend/ → 抛 ValueError
  - 缺 dist/index.html → 抛 ValueError
  - 缺 version.json → 抛 ValueError
  - version.json 非法 JSON → 抛 ValueError

不依赖网络、不依赖数据库、不写用户目录。
"""
import io
import unittest
import zipfile

from backend.routes.system.self_update import _validate_full_update_zip


def _make_zip(include_server=True, include_backend=True, include_app=True,
              include_config=True, include_dist=True, include_version=True,
              version_json='{"version":"9.9.9"}'):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        if include_server:
            zf.writestr('server/server.exe', b'fake-exe')
        if include_backend:
            zf.writestr('backend/routes/version.py', b'# version')
        if include_app:
            zf.writestr('app.py', b'# app')
        if include_config:
            zf.writestr('config.py', b'# config')
        if include_dist:
            zf.writestr('frontend-react/dist/index.html', b'<html></html>')
        if include_version:
            zf.writestr('version.json', version_json)
    buf.seek(0)
    return zipfile.ZipFile(buf)


class FullUpdateValidationTest(unittest.TestCase):
    def test_valid_zip_returns_version(self):
        zf = _make_zip()
        data = _validate_full_update_zip(zf)
        self.assertEqual(data.get('version'), '9.9.9')

    def test_missing_server_rejected(self):
        zf = _make_zip(include_server=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_missing_backend_rejected(self):
        zf = _make_zip(include_backend=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_missing_app_rejected(self):
        zf = _make_zip(include_app=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_missing_config_rejected(self):
        zf = _make_zip(include_config=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_missing_dist_rejected(self):
        zf = _make_zip(include_dist=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_missing_version_rejected(self):
        zf = _make_zip(include_version=False)
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)

    def test_bad_version_json_rejected(self):
        zf = _make_zip(version_json='not json')
        with self.assertRaises(ValueError):
            _validate_full_update_zip(zf)


if __name__ == '__main__':
    unittest.main(verbosity=2)
