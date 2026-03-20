/**
 * 日期范围快捷选择器
 *
 * 基于Vaadin DatePicker封装的复合组件
 * 支持：自定义日期范围 + 快捷选项（今天、昨天、近7天、近30天、本月、上月）
 *
 * 使用示例：
 * <date-range-quick-picker id="datePicker"></date-range-quick-picker>
 *
 * 事件：
 * date-range-change - 日期范围变更时触发，detail: { startDate, endDate }
 */

class DateRangeQuickPicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // 快捷选项配置
    this.quickOptions = [
      { label: '今天', value: 'today' },
      { label: '昨天', value: 'yesterday' },
      { label: '近7天', value: 'last7days' },
      { label: '近30天', value: 'last30days' },
      { label: '本月', value: 'thisMonth' },
      { label: '上月', value: 'lastMonth' }
    ];

    this._startDate = null;
    this._endDate = null;
    this._activeQuickOption = null;
  }

  connectedCallback() {
    this._render();
    this._setupEventListeners();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --picker-gap: 8px;
          --button-bg: #ffffff;
          --button-border: #d9d9d9;
          --button-text: #333333;
          --button-active-bg: #1890ff;
          --button-active-text: #ffffff;
          --button-hover-bg: #f5f7fa;
        }

        [data-theme="dark"] :host {
          --button-bg: #374151;
          --button-border: #4b5563;
          --button-text: #e5e7eb;
          --button-active-bg: #1890ff;
          --button-active-text: #ffffff;
          --button-hover-bg: #4b5563;
        }

        .date-range-picker {
          display: flex;
          flex-direction: column;
          gap: var(--picker-gap);
        }

        .date-inputs {
          display: flex;
          align-items: center;
          gap: var(--picker-gap);
          flex-wrap: wrap;
        }

        .date-inputs vaadin-date-picker {
          flex: 1;
          min-width: 140px;
        }

        .date-separator {
          color: var(--button-text);
          font-size: 14px;
        }

        .quick-options {
          display: flex;
          gap: var(--picker-gap);
          flex-wrap: wrap;
        }

        .quick-btn {
          padding: 4px 12px;
          border: 1px solid var(--button-border);
          border-radius: 4px;
          background: var(--button-bg);
          color: var(--button-text);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .quick-btn:hover {
          background: var(--button-hover-bg);
        }

        .quick-btn.active {
          background: var(--button-active-bg);
          color: var(--button-active-text);
          border-color: var(--button-active-bg);
        }
      </style>

      <div class="date-range-picker">
        <div class="date-inputs">
          <vaadin-date-picker
            id="startDate"
            placeholder="开始日期"
            theme="aura"
          ></vaadin-date-picker>
          <span class="date-separator">至</span>
          <vaadin-date-picker
            id="endDate"
            placeholder="结束日期"
            theme="aura"
          ></vaadin-date-picker>
        </div>
        <div class="quick-options" id="quickOptions"></div>
      </div>
    `;

    // 渲染快捷选项按钮
    this._renderQuickOptions();
  }

  _renderQuickOptions() {
    const container = this.shadowRoot.getElementById('quickOptions');
    container.innerHTML = '';

    this.quickOptions.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'quick-btn';
      btn.textContent = option.label;
      btn.dataset.value = option.value;
      if (this._activeQuickOption === option.value) {
        btn.classList.add('active');
      }
      container.appendChild(btn);
    });
  }

  _setupEventListeners() {
    const startPicker = this.shadowRoot.getElementById('startDate');
    const endPicker = this.shadowRoot.getElementById('endDate');
    const quickOptions = this.shadowRoot.getElementById('quickOptions');

    // 开始日期变更
    startPicker.addEventListener('value-changed', (e) => {
      this._startDate = e.detail.value;
      this._activeQuickOption = null;
      this._updateQuickButtonStates();
      this._emitChange();
    });

    // 结束日期变更
    endPicker.addEventListener('value-changed', (e) => {
      this._endDate = e.detail.value;
      this._activeQuickOption = null;
      this._updateQuickButtonStates();
      this._emitChange();
    });

    // 快捷选项点击
    quickOptions.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-btn')) {
        const value = e.target.dataset.value;
        this._applyQuickOption(value);
      }
    });
  }

  _applyQuickOption(option) {
    const today = new Date();
    let startDate, endDate;

    switch (option) {
      case 'today':
        startDate = endDate = today;
        break;

      case 'yesterday':
        startDate = endDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        break;

      case 'last7days':
        endDate = today;
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 6);
        break;

      case 'last30days':
        endDate = today;
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 29);
        break;

      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = today;
        break;

      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    // 格式化日期为YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    this._startDate = formatDate(startDate);
    this._endDate = formatDate(endDate);
    this._activeQuickOption = option;

    // 更新日期选择器
    this.shadowRoot.getElementById('startDate').value = this._startDate;
    this.shadowRoot.getElementById('endDate').value = this._endDate;

    this._updateQuickButtonStates();
    this._emitChange();
  }

  _updateQuickButtonStates() {
    const buttons = this.shadowRoot.querySelectorAll('.quick-btn');
    buttons.forEach(btn => {
      if (btn.dataset.value === this._activeQuickOption) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('date-range-change', {
      detail: {
        startDate: this._startDate,
        endDate: this._endDate
      },
      bubbles: true
    }));
  }

  // 公共API
  get startDate() {
    return this._startDate;
  }

  get endDate() {
    return this._endDate;
  }

  set startDate(value) {
    this._startDate = value;
    this.shadowRoot.getElementById('startDate').value = value;
  }

  set endDate(value) {
    this._endDate = value;
    this.shadowRoot.getElementById('endDate').value = value;
  }

  getValue() {
    return {
      startDate: this._startDate,
      endDate: this._endDate
    };
  }

  setValue(startDate, endDate) {
    this._startDate = startDate;
    this._endDate = endDate;
    this.shadowRoot.getElementById('startDate').value = startDate;
    this.shadowRoot.getElementById('endDate').value = endDate;
    this._activeQuickOption = null;
    this._updateQuickButtonStates();
  }

  clear() {
    this._startDate = null;
    this._endDate = null;
    this._activeQuickOption = null;
    this.shadowRoot.getElementById('startDate').value = '';
    this.shadowRoot.getElementById('endDate').value = '';
    this._updateQuickButtonStates();
  }
}

// 注册组件
customElements.define('date-range-quick-picker', DateRangeQuickPicker);

console.log('[DateRangeQuickPicker] 组件已注册');