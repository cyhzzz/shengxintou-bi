/**
 * MultiSelectForm - 多选下拉表单组件
 *
 * 外观像单选下拉框，点击后展开选项列表，支持多选
 *
 * 使用示例：
 * <div class="form-group">
 *     <label class="form-label">平台</label>
 *     <div id="platformMultiSelect" class="multi-select-form"></div>
 * </div>
 *
 * const multiSelect = new MultiSelectForm({
 *     container: 'platformMultiSelect',
 *     options: ['腾讯', '抖音', '小红书'],
 *     placeholder: '请选择平台',
 *     onChange: (selectedValues) => {
 *         console.log('选中:', selectedValues);
 *     }
 * });
 */

class MultiSelectForm {
    constructor(options = {}) {
        this.container = typeof options.container === 'string'
            ? document.getElementById(options.container)
            : options.container;

        this.options = options.options || [];
        this.placeholder = options.placeholder || '请选择';
        this.selectedValues = options.selectedValues || [];
        this.onChange = options.onChange || null;
        this.disabled = options.disabled || false;

        this.isOpen = false;
        this.uniqueId = `multi-select-${Math.random().toString(36).substr(2, 9)}`;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('[MultiSelectForm] Container not found');
            return;
        }

        this.render();
        this.bindEvents();
    }

    render() {
        const selectedText = this.getSelectedText();

        this.container.innerHTML = `
            <div class="multi-select-form__wrapper" data-multi-select="${this.uniqueId}">
                <!-- 显示框（类似单选下拉框） -->
                <div class="multi-select-form__trigger ${this.disabled ? 'is-disabled' : ''}"
                     role="combobox"
                     aria-expanded="false"
                     tabindex="${this.disabled ? '-1' : '0'}">
                    <span class="multi-select-form__value ${!selectedText ? 'is-placeholder' : ''}">
                        ${selectedText || this.placeholder}
                    </span>
                    <span class="multi-select-form__arrow">▼</span>
                </div>

                <!-- 下拉选项列表 -->
                <div class="multi-select-form__dropdown" style="display: none;">
                    <div class="multi-select-form__options">
                        ${this.renderOptions()}
                    </div>
                </div>
            </div>
        `;
    }

    renderOptions() {
        return this.options.map(option => {
            const isSelected = this.selectedValues.includes(option);
            return `
                <label class="multi-select-form__option ${isSelected ? 'is-selected' : ''}">
                    <input type="checkbox"
                           value="${option}"
                           ${isSelected ? 'checked' : ''}>
                    <span>${option}</span>
                </label>
            `.trim();
        }).join('');
    }

    getSelectedText() {
        if (this.selectedValues.length === 0) {
            return '';
        } else if (this.selectedValues.length === 1) {
            return this.selectedValues[0];
        } else {
            return `${this.selectedValues[0]} 等${this.selectedValues.length}项`;
        }
    }

    bindEvents() {
        const wrapper = this.container.querySelector(`[data-multi-select="${this.uniqueId}"]`);
        if (!wrapper) return;

        const trigger = wrapper.querySelector('.multi-select-form__trigger');
        const dropdown = wrapper.querySelector('.multi-select-form__dropdown');
        const options = wrapper.querySelectorAll('.multi-select-form__option input[type="checkbox"]');

        // 切换下拉框显示/隐藏
        trigger.addEventListener('click', (e) => {
            if (this.disabled) return;
            e.stopPropagation();
            this.toggle();
        });

        // 选项点击处理
        options.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const value = e.target.value;

                if (e.target.checked) {
                    if (!this.selectedValues.includes(value)) {
                        this.selectedValues.push(value);
                    }
                } else {
                    this.selectedValues = this.selectedValues.filter(v => v !== value);
                }

                // 更新显示文本
                const valueSpan = wrapper.querySelector('.multi-select-form__value');
                valueSpan.textContent = this.getSelectedText() || this.placeholder;
                valueSpan.classList.toggle('is-placeholder', !this.getSelectedText());

                // 更新选项样式
                const optionLabel = e.target.closest('.multi-select-form__option');
                optionLabel.classList.toggle('is-selected', e.target.checked);

                // 触发回调
                if (this.onChange) {
                    this.onChange([...this.selectedValues]);
                }
            });

            // 防止点击 label 时触发两次 change
            const label = checkbox.closest('.multi-select-form__option');
            label.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    e.preventDefault();
                }
            });
        });

        // 点击下拉框内部不关闭
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        // 关闭其他所有打开的多选下拉框
        document.querySelectorAll('.multi-select-form__dropdown').forEach(dd => {
            if (dd !== this.container.querySelector('.multi-select-form__dropdown')) {
                dd.style.display = 'none';
            }
        });

        const dropdown = this.container.querySelector('.multi-select-form__dropdown');
        const trigger = this.container.querySelector('.multi-select-form__trigger');

        if (dropdown && trigger) {
            dropdown.style.display = 'block';
            trigger.setAttribute('aria-expanded', 'true');
            this.isOpen = true;
        }
    }

    close() {
        const dropdown = this.container.querySelector('.multi-select-form__dropdown');
        const trigger = this.container.querySelector('.multi-select-form__trigger');

        if (dropdown && trigger) {
            dropdown.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
            this.isOpen = false;
        }
    }

    /**
     * 设置选中的值
     */
    setSelected(values) {
        this.selectedValues = Array.isArray(values) ? values : [values];

        // 更新复选框状态
        const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.selectedValues.includes(checkbox.value);
            const optionLabel = checkbox.closest('.multi-select-form__option');
            optionLabel.classList.toggle('is-selected', checkbox.checked);
        });

        // 更新显示文本
        const valueSpan = this.container.querySelector('.multi-select-form__value');
        valueSpan.textContent = this.getSelectedText() || this.placeholder;
        valueSpan.classList.toggle('is-placeholder', !this.getSelectedText());
    }

    /**
     * 获取选中的值
     */
    getSelected() {
        return [...this.selectedValues];
    }

    /**
     * 清空所有选中
     */
    clear() {
        this.setSelected([]);
    }

    /**
     * 禁用/启用组件
     */
    setDisabled(disabled) {
        this.disabled = disabled;
        const trigger = this.container.querySelector('.multi-select-form__trigger');
        if (trigger) {
            trigger.classList.toggle('is-disabled', disabled);
            trigger.tabIndex = disabled ? -1 : 0;
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.close();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// 验证类已加载
console.log('[MultiSelectForm] Class loaded successfully');

// 全局点击关闭下拉框
document.addEventListener('click', () => {
    document.querySelectorAll('.multi-select-form__dropdown').forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    document.querySelectorAll('.multi-select-form__trigger').forEach(trigger => {
        trigger.setAttribute('aria-expanded', 'false');
    });
    // 重置所有 isOpen 状态
    if (window.multiSelectInstances) {
        Object.values(window.multiSelectInstances).forEach(instance => {
            instance.isOpen = false;
        });
    }
});
