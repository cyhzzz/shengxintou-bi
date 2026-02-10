/**
 * 省心投 BI - 多选下拉框组件
 */

class MultiSelectDropdown {
    constructor(options) {
        this.id = options.id;
        this.containerId = options.container; // 目标容器 ID
        this.label = options.label;
        this.placeholder = options.placeholder || '请选择';
        this.options = options.options || [];
        this.onChange = options.onChange || (() => {});
        this.selectedValues = new Set();

        this.container = null;
        this.trigger = null;
        this.dropdown = null;
        this.displayElement = null;

        this.render();
        this.bindEvents();
    }

    /**
     * 渲染组件
     */
    render() {
        const container = document.createElement('div');
        container.className = 'filter-group';
        if (this.id) {
            container.id = this.id;
        }

        container.innerHTML = `
            <label class="filter-label">${this.label}:</label>
            <div class="multi-select">
                <div class="multi-select-trigger">
                    <span class="multi-select-selected all">${this.placeholder}</span>
                </div>
                <div class="multi-select-dropdown">
                    <div class="multi-select-options"></div>
                    <div class="multi-select-actions">
                        <button class="btn btn-secondary btn-select-all">全选</button>
                        <button class="btn btn-secondary btn-clear-all">清空</button>
                    </div>
                </div>
            </div>
        `;

        this.container = container;
        this.trigger = container.querySelector('.multi-select-trigger');
        this.dropdown = container.querySelector('.multi-select-dropdown');
        this.displayElement = container.querySelector('.multi-select-selected');
        const optionsContainer = container.querySelector('.multi-select-options');

        // 渲染选项
        this.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'multi-select-option';
            const uniqueId = `${this.id || 'multi'}_${option.value}`;
            optionDiv.innerHTML = `
                <input type="checkbox" id="${uniqueId}" value="${option.value}">
                <label for="${uniqueId}">${option.label}</label>
            `;

            const checkbox = optionDiv.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedValues.add(option.value);
                } else {
                    this.selectedValues.delete(option.value);
                }
                this.updateDisplay();
                this.onChange(Array.from(this.selectedValues));
            });

            optionsContainer.appendChild(optionDiv);
        });

        // 如果提供了 containerId，将组件插入到目标容器中
        if (this.containerId) {
            const targetContainer = document.getElementById(this.containerId);
            if (targetContainer) {
                targetContainer.innerHTML = ''; // 清空目标容器
                targetContainer.appendChild(container);
            } else {
                console.error(`MultiSelectDropdown: 找不到目标容器 #${this.containerId}`);
            }
        }

        return container;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 点击触发器显示/隐藏下拉框
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭其他下拉框
            document.querySelectorAll('.multi-select-dropdown').forEach(d => {
                if (d !== this.dropdown) {
                    d.classList.remove('show');
                }
            });
            this.dropdown.classList.toggle('show');
        });

        // 点击外部关闭下拉框
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.dropdown.classList.remove('show');
            }
        });

        // 全选按钮
        this.container.querySelector('.btn-select-all').addEventListener('click', () => {
            this.selectAll();
        });

        // 清空按钮
        this.container.querySelector('.btn-clear-all').addEventListener('click', () => {
            this.clearAll();
        });
    }

    /**
     * 更新显示文本
     */
    updateDisplay() {
        if (this.selectedValues.size === 0) {
            this.displayElement.textContent = this.placeholder;
            this.displayElement.classList.add('all');
        } else if (this.selectedValues.size === 1) {
            const value = Array.from(this.selectedValues)[0];
            const option = this.options.find(opt => opt.value === value);
            this.displayElement.textContent = option ? option.label : value;
            this.displayElement.classList.remove('all');
        } else {
            this.displayElement.textContent = `已选 ${this.selectedValues.size} 项`;
            this.displayElement.classList.remove('all');
        }
    }

    /**
     * 全选
     * @param {boolean} silent - 是否静默模式（不触发onChange）
     */
    selectAll(silent = false) {
        this.selectedValues = new Set(this.options.map(opt => opt.value));
        this.container.querySelectorAll('.multi-select-options input').forEach(input => {
            input.checked = true;
        });
        this.updateDisplay();
        if (!silent) {
            this.onChange(Array.from(this.selectedValues));
        }
    }

    /**
     * 清空选择
     * @param {boolean} silent - 是否静默模式（不触发onChange）
     */
    clearAll(silent = false) {
        this.selectedValues.clear();
        this.container.querySelectorAll('.multi-select-options input').forEach(input => {
            input.checked = false;
        });
        this.updateDisplay();
        if (!silent) {
            this.onChange([]);
        }
    }

    /**
     * 获取选中的值
     */
    getSelectedValues() {
        return Array.from(this.selectedValues);
    }

    /**
     * 获取选中的值（别名方法）
     */
    getSelected() {
        return this.getSelectedValues();
    }

    /**
     * 清空选择（静默模式，不触发onChange）
     */
    clearSelection() {
        this.clearAll(true);
    }

    /**
     * 设置选中的值
     */
    setSelectedValues(values) {
        this.selectedValues = new Set(values || []);
        this.container.querySelectorAll('.multi-select-options input').forEach(input => {
            input.checked = this.selectedValues.has(input.value);
        });
        this.updateDisplay();
    }

    /**
     * 重置
     */
    reset() {
        this.clearAll();
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// 导出
window.MultiSelectDropdown = MultiSelectDropdown;
