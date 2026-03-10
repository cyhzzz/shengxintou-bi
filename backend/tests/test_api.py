# 省心投 BI - 后端测试模板
# ================================

import pytest
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app import app


# ============================================
# Fixtures - 测试配置
# ============================================

@pytest.fixture
def client():
    """创建测试客户端"""
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    with app.test_client() as client:
        with app.app_context():
            yield client


@pytest.fixture
def runner():
    """创建测试CLI运行器"""
    return app.test_cli_runner()


# ============================================
# 健康检查测试
# ============================================

class TestHealthCheck:
    """健康检查接口测试"""

    def test_health_check_returns_ok(self, client):
        """测试健康检查接口返回正常"""
        response = client.get('/api/health')
        assert response.status_code == 200

        data = response.get_json()
        assert data['status'] == 'ok'
        assert 'message' in data

    def test_health_check_content_type(self, client):
        """测试健康检查接口返回JSON格式"""
        response = client.get('/api/health')
        assert response.content_type == 'application/json'


# ============================================
# 元数据接口测试
# ============================================

class TestMetadataAPI:
    """元数据接口测试"""

    def test_get_metadata(self, client):
        """测试获取元数据"""
        response = client.get('/api/v1/metadata')
        assert response.status_code == 200

        data = response.get_json()
        assert data['success'] == True
        assert 'data' in data

    def test_metadata_contains_platforms(self, client):
        """测试元数据包含平台信息"""
        response = client.get('/api/v1/metadata')
        data = response.get_json()

        assert 'platforms' in data['data']
        platforms = data['data']['platforms']
        assert isinstance(platforms, list)


# ============================================
# 数据查询接口测试
# ============================================

class TestDataQueryAPI:
    """数据查询接口测试"""

    def test_get_dashboard_data(self, client):
        """测试获取仪表盘数据"""
        response = client.post('/api/v1/dashboard', json={
            'filters': {}
        })
        assert response.status_code == 200

        data = response.get_json()
        assert 'success' in data

    def test_get_trend_data(self, client):
        """测试获取趋势数据"""
        response = client.post('/api/v1/trend', json={
            'filters': {},
            'metrics': ['cost', 'impressions']
        })
        assert response.status_code == 200

    def test_get_agency_analysis(self, client):
        """测试获取厂商分析数据"""
        response = client.post('/api/v1/agency-analysis', json={
            'filters': {}
        })
        assert response.status_code == 200


# ============================================
# 错误处理测试
# ============================================

class TestErrorHandling:
    """错误处理测试"""

    def test_404_error(self, client):
        """测试404错误处理"""
        response = client.get('/api/v1/nonexistent')
        assert response.status_code == 404

    def test_invalid_json_request(self, client):
        """测试无效JSON请求"""
        response = client.post('/api/v1/dashboard',
                              data='invalid json',
                              content_type='application/json')
        # 应该返回400或500错误
        assert response.status_code >= 400


# ============================================
# 运行测试
# ============================================

if __name__ == '__main__':
    pytest.main([__file__, '-v'])