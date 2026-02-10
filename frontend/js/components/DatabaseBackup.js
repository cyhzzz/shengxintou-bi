/**
 * 数据库备份组件
 * 提供坚果云WebDAV数据库备份功能
 */
class DatabaseBackup {
    constructor() {
        this.backupTaskId = null;       // 备份任务ID
        this.pollInterval = null;
        this.init();
    }

    async init() {
        this.render();
        this.bindEvents();
        this.loadBackupList();  // 加载备份列表
    }

    render() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">数据库备份</h3>
                </div>
                <div class="card__body">
                    <!-- 备份操作区 -->
                    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <button class="btn btn--primary" id="backupBtn">
                            ☁️ 备份数据库到坚果云
                        </button>
                        <button class="btn btn--secondary" id="restoreBtn">
                            📥 从坚果云恢复数据库
                        </button>
                        <button class="btn btn--outline" id="refreshBtn">
                            🔄 刷新备份列表
                        </button>
                    </div>

                    <!-- 进度显示 -->
                    <div id="backupProgressSection" style="display: none;">
                        <div class="progress-bar" style="height: 8px; background: #E5E6EB; border-radius: 4px; overflow: hidden;">
                            <div class="progress-fill" id="backupProgressBar" style="width: 0%; height: 100%; background: #52C41A; transition: width 0.3s;"></div>
                        </div>
                        <div class="progress-stats" style="margin-top: 12px;">
                            <span>状态: <strong id="backupSyncStatus">-</strong></span>
                            <span style="margin-left: 24px;">进度: <strong id="backupSyncProgress">0%</strong></span>
                            <span style="margin-left: 24px;" id="backupSyncMessage"></span>
                        </div>
                    </div>

                    <!-- 备份列表 -->
                    <div style="margin-top: 24px;">
                        <h4 style="margin: 0 0 12px 0; font-size: 14px;">备份历史</h4>
                        <div id="backupList">
                            <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                        </div>
                    </div>

                    <!-- 说明文字 -->
                    <div style="margin-top: 24px; padding: 16px; background: #F5F7FA; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px;">使用说明</h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
                            <li><strong>备份数据库到坚果云</strong>：将整个数据库文件上传到坚果云网盘</li>
                            <li><strong>从坚果云恢复数据库</strong>：从坚果云下载备份文件并恢复（恢复前会自动备份当前数据库）</li>
                            <li>保留最近10个备份，旧备份会自动删除</li>
                            <li>支持压缩备份，节省存储空间</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        // 坚果云备份事件
        document.getElementById('backupBtn').addEventListener('click', () => {
            this.triggerBackup();
        });

        document.getElementById('restoreBtn').addEventListener('click', () => {
            this.showRestoreDialog();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadBackupList();
        });
    }

    // ========== 坚果云备份方法 ==========

    async triggerBackup() {
        try {
            const description = prompt('请输入备份说明（可选）：', '');

            const response = await API.post('/api/v1/webdav/backup', {
                description: description || ''
            });

            if (response.success) {
                this.backupTaskId = response.task_id;
                this.showBackupProgress();
                this.startBackupPolling();
            } else {
                alert('启动备份失败: ' + (response.error || '未知错误'));
            }
        } catch (error) {
            console.error('备份失败:', error);
            alert('备份失败: ' + error.message);
        }
    }

    async showRestoreDialog() {
        try {
            // 显示备份列表，让用户选择要恢复的备份
            const response = await API.get('/api/v1/webdav/list');

            if (!response.success || !response.data || response.data.length === 0) {
                alert('没有可用的备份文件');
                return;
            }

            const backups = response.data;
            const message = backups.map((b, i) =>
                `${i + 1}. ${b.filename} (${this.formatFileSize(b.size)}) - ${b.created}`
            ).join('\n');

            const choice = prompt(`请输入要恢复的备份序号:\n${message}\n\n请输入序号（1-${backups.length}）:`);

            if (choice) {
                const index = parseInt(choice) - 1;
                if (index >= 0 && index < backups.length) {
                    const confirmed = confirm(`确定要恢复备份 "${backups[index].filename}" 吗？\n\n恢复前会自动备份当前数据库。`);
                    if (confirmed) {
                        this.triggerRestore(backups[index].filename);
                    }
                } else {
                    alert('无效的序号');
                }
            }
        } catch (error) {
            console.error('获取备份列表失败:', error);
            alert('获取备份列表失败: ' + error.message);
        }
    }

    async triggerRestore(filename) {
        try {
            const response = await API.post('/api/v1/webdav/restore', {
                filename: filename
            });

            if (response.success) {
                this.backupTaskId = response.task_id;
                this.showBackupProgress();
                this.startBackupPolling();
            } else {
                alert('启动恢复失败: ' + (response.error || '未知错误'));
            }
        } catch (error) {
            console.error('恢复失败:', error);
            alert('恢复失败: ' + error.message);
        }
    }

    async loadBackupList() {
        try {
            const response = await API.get('/api/v1/webdav/list');
            const container = document.getElementById('backupList');

            if (!response.success || !response.data || response.data.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无备份</div>';
                return;
            }

            const backups = response.data;
            container.innerHTML = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>文件名</th>
                                <th>大小</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${backups.map(backup => {
                                const isCompressed = backup.filename.endsWith('.db.gz');
                                const sizeDisplay = this.formatFileSize(backup.size) + (isCompressed ? ' <span style="color: #52c41a; font-size: 12px;">(压缩)</span>' : '');
                                return `
                                    <tr>
                                        <td>${backup.filename}</td>
                                        <td>${sizeDisplay}</td>
                                        <td>${backup.created}</td>
                                        <td>
                                            <button class="btn btn--sm btn--primary" onclick="app.currentReportInstance.triggerRestore('${backup.filename}')">
                                                恢复
                                            </button>
                                            <button class="btn btn--sm btn--ghost is-error" onclick="app.currentReportInstance.deleteBackup('${backup.filename}')">
                                                删除
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            console.error('加载备份列表失败:', error);
            const container = document.getElementById('backupList');
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载失败</div>';
        }
    }

    async deleteBackup(filename) {
        const confirmed = confirm(`确定要删除备份 "${filename}" 吗？`);
        if (!confirmed) return;

        try {
            const response = await API.post('/api/v1/webdav/delete', {
                filename: filename
            });

            if (response.success) {
                alert('删除成功');
                this.loadBackupList();
            } else {
                alert(`删除失败: ${response.message}`);
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败: ' + error.message);
        }
    }

    showBackupProgress() {
        document.getElementById('backupProgressSection').style.display = 'block';
        document.getElementById('backupBtn').disabled = true;
        document.getElementById('restoreBtn').disabled = true;
        document.getElementById('refreshBtn').disabled = true;
    }

    hideBackupProgress() {
        document.getElementById('backupProgressSection').style.display = 'none';
        document.getElementById('backupBtn').disabled = false;
        document.getElementById('restoreBtn').disabled = false;
        document.getElementById('refreshBtn').disabled = false;
    }

    startBackupPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                const response = await API.get(`/api/v1/webdav/progress/${this.backupTaskId}`);

                if (response.success) {
                    const data = response.data;
                    document.getElementById('backupSyncStatus').textContent = data.status;
                    document.getElementById('backupSyncProgress').textContent = data.progress + '%';
                    document.getElementById('backupSyncMessage').textContent = data.message;
                    document.getElementById('backupProgressBar').style.width = data.progress + '%';

                    if (data.status === 'completed' || data.status === 'failed') {
                        this.stopBackupPolling();
                        setTimeout(() => {
                            this.hideBackupProgress();
                            this.loadBackupList();  // 刷新备份列表
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('查询进度失败:', error);
            }
        }, 1000);
    }

    stopBackupPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    destroy() {
        this.stopBackupPolling();
    }
}

// 导出到全局（确保 DynamicLoader 能找到此类）
if (typeof window !== 'undefined') {
    window.DatabaseBackup = DatabaseBackup;
}
