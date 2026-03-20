/**
 * 数据同步组件
 * 包含坚果云数据库备份功能
 * 注意：飞书多维表格同步功能已移除
 */
class FeishuSync {
    constructor() {
        this.backupTaskId = null;       // 坚果云备份任务ID
        this.backupPollInterval = null;
        this.init();
    }

    async init() {
        this.render();
        this.bindEvents();
        this.loadBackupList();  // 加载备份列表
        await this.checkVersion(); // 检查版本更新
    }

    async checkVersion() {
        try {
            const response = await API.get('/api/v1/version/compare');

            if (response.success && response.data) {
                const { needs_update, message, cloud_version, support_contact } = response.data;

                if (needs_update) {
                    // 显示更新提示弹窗
                    this.showUpdateWarning(message, cloud_version, support_contact);
                }
            }
        } catch (error) {
            console.error('检查版本更新失败:', error);
            // 版本检查失败不影响正常使用，仅记录日志
        }
    }

    showUpdateWarning(message, cloudVersion, supportContact) {
        // 创建弹窗 HTML
        const modalHtml = `
            <div id="versionUpdateModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 8px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="font-size: 48px; text-align: center; margin-bottom: 16px;">⚠️</div>
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; text-align: center; color: #333;">版本更新提示</h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #666; text-align: center;">${message}</p>
                    ${cloudVersion ? `<p style="margin: 0 0 16px 0; font-size: 13px; color: #999; text-align: center;">云端版本: v${cloudVersion}</p>` : ''}
                    ${supportContact ? `<p style="margin: 0 0 24px 0; font-size: 13px; color: #666; text-align: center;">支持联系: ${supportContact}</p>` : ''}
                    <button id="closeVersionUpdateModal" class="btn btn--primary" style="width: 100%;">我知道了</button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 绑定关闭事件
        document.getElementById('closeVersionUpdateModal').addEventListener('click', () => {
            const modal = document.getElementById('versionUpdateModal');
            if (modal) {
                modal.remove();
            }
        });
    }

    render() {
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <!-- 卡片1：坚果云备份 -->
            <div class="card card--full-width" style="margin-bottom: 20px;">
                <div class="card__header">
                    <h3 class="card__title">坚果云数据库备份</h3>
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
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 卡片2：飞书同步（已隐藏） -->
            <!--
            <div class="card card--full-width">
                <div class="card__header">
                    <h3 class="card__title">飞书多维表格同步 <span style="font-size: 12px; color: #999; font-weight: normal; margin-left: 8px;">(开发中)</span></h3>
                </div>
                <div class="card__body">
                    <!-- 开发中提示 -->
                    <div style="padding: 40px; text-align: center; background: #F5F7FA; border-radius: 4px; border: 2px dashed #D9D9D9;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🚧</div>
                        <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">功能开发中</h4>
                        <p style="margin: 0; font-size: 14px; color: #666;">飞书多维表格同步功能正在开发中，敬请期待</p>
                    </div>

                    <!-- 同步操作区（置灰禁用） -->
                    <div style="display: flex; gap: 16px; margin-bottom: 24px; opacity: 0.5; pointer-events: none;">
                        <button class="btn btn--primary is-disabled" id="pushBtn" disabled>
                            ↑ 上传本地数据至云端
                        </button>
                        <button class="btn btn--secondary is-disabled" id="pullBtn" disabled>
                            ↓ 同步云端数据到本地
                        </button>
                    </div>

                    <!-- 说明文字 -->
                    <div style="margin-top: 24px; padding: 16px; background: #F5F7FA; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px;">使用说明</h4>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
                            <li><strong>上传本地数据至云端</strong>：将数据库中的数据推送到飞书多维表格（开发中）</li>
                            <li><strong>同步云端数据到本地</strong>：从飞书多维表格拉取数据到数据库（开发中）</li>
                            <li><strong>注意</strong>：该功能正在开发中，暂时无法使用</li>
                        </ul>
                    </div>
                </div>
            </div>
            -->
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
                            `}).join('')}
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
        this.backupPollInterval = setInterval(async () => {
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
        if (this.backupPollInterval) {
            clearInterval(this.backupPollInterval);
            this.backupPollInterval = null;
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
