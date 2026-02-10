/**
 * 帮助弹窗组件
 * 负责显示和隐藏项目说明弹窗
 */
class HelpModal {
    constructor() {
        this.modal = document.getElementById('helpModal');
        this.helpBtn = document.getElementById('helpBtn');
        this.closeBtn = document.getElementById('closeHelpModal');
        this.closeFooterBtn = document.getElementById('closeHelpModalBtn');

        if (!this.modal) {
            console.error('Help modal element not found');
            return;
        }

        this.init();
    }

    async init() {
        // 绑定打开按钮事件
        if (this.helpBtn) {
            this.helpBtn.addEventListener('click', () => this.open());
        }

        // 绑定关闭按钮事件
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        if (this.closeFooterBtn) {
            this.closeFooterBtn.addEventListener('click', () => this.close());
        }

        // 点击遮罩层关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        // 页面加载时不加载版本信息，改为在打开弹窗时加载
    }

    async loadVersionInfo() {
        try {
            const response = await API.get('/api/v1/version/local');

            if (response.success && response.data) {
                const version = response.data;
                const versionContent = document.getElementById('versionInfoText');

                if (versionContent) {
                    // 构建版本信息 HTML
                    let html = `版本：v${version.version}<br>`;
                    html += `更新时间：${version.release_date}`;

                    // 如果有更新日志，添加到版本信息中
                    if (version.changelog && version.changelog.length > 0) {
                        html += `<br><br><strong>更新内容：</strong><ul style="margin: 8px 0; padding-left: 20px;">`;
                        version.changelog.forEach(item => {
                            html += `<li>${item}</li>`;
                        });
                        html += `</ul>`;
                    }

                    // 如果有支持联系方式，添加到版本信息中
                    if (version.support_contact) {
                        html += `<strong>支持联系：</strong>${version.support_contact}`;
                    }

                    versionContent.innerHTML = html;
                }
            }
        } catch (error) {
            console.error('加载版本信息失败:', error);
            const versionContent = document.getElementById('versionInfoText');
            if (versionContent) {
                versionContent.innerHTML = '版本信息加载失败';
            }
        }
    }

    async open() {
        if (this.modal) {
            this.modal.classList.add('is-active');
            document.body.style.overflow = 'hidden'; // 防止背景滚动
            // 打开弹窗时加载版本信息
            await this.loadVersionInfo();
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('is-active');
            document.body.style.overflow = ''; // 恢复背景滚动
        }
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('is-active');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.helpModal = new HelpModal();
});
