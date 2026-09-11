/**
 * LLM Provider 配置弹窗（v4.2.0）
 *
 * OpenAI 协议参数（base_url / api_key / model / timeout）经 PUT /api/v1/system/llm-config
 * 写入后端 USER_DATA_DIR/llm_config.json 本机文件（不入库、不分发）。
 * api_key 永远脱敏展示（GET 只回传掩码），留空提交 = 沿用已存值；
 * 「测试连接」用表单当前值调用 /llm-config/test，缺省字段回落已存配置。
 */
import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Space } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { dataServiceLlm } from '@/services/dataService';
import type { LlmConfigView } from '@/services/dataService';

interface LlmConfigFormValues {
  base_url: string;
  api_key?: string;
  model: string;
  timeout_seconds?: number;
}

interface LlmConfigModalProps {
  open: boolean;
  onClose: () => void;
  /** 保存成功后回调（携带最新 configured 状态） */
  onSaved?: (configured: boolean) => void;
}

const LlmConfigModal: React.FC<LlmConfigModalProps> = ({ open, onClose, onSaved }) => {
  const [form] = Form.useForm<LlmConfigFormValues>();
  const { message } = App.useApp();
  const [config, setConfig] = useState<LlmConfigView | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    dataServiceLlm.getConfig().then((res) => {
      if (cancelled || !res?.success || !res.data) return;
      setConfig(res.data);
      form.setFieldsValue({
        base_url: res.data.base_url,
        model: res.data.model,
        timeout_seconds: res.data.timeout_seconds,
      });
    }).catch(() => {/* 配置读取失败时表单留空，由用户手填 */});
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  const getValidatedValues = async (): Promise<LlmConfigFormValues> => {
    return form.validateFields();
  };

  const handleTest = async () => {
    let values: LlmConfigFormValues;
    try {
      values = await getValidatedValues();
    } catch {
      return; // 校验错误已由表单展示
    }
    setTesting(true);
    try {
      const res = await dataServiceLlm.testConfig(values);
      if (res?.success) {
        message.success(`连接成功（耗时 ${Math.round((res.data?.latency_ms || 0) / 100) / 10}s）`);
      } else {
        message.error(res?.message || '连接失败');
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    let values: LlmConfigFormValues;
    try {
      values = await getValidatedValues();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const res = await dataServiceLlm.saveConfig(values);
      if (res?.success && res.data) {
        setConfig(res.data);
        message.success('LLM 配置已保存');
        onSaved?.(!!res.data.configured);
        onClose();
      } else {
        message.error(res?.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const configured = !!config?.configured;

  return (
    <Modal
      title="LLM 配置（OpenAI 协议）"
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={520}
      footer={
        <Space>
          <Button icon={<ApiOutlined />} loading={testing} onClick={handleTest}>
            测试连接
          </Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          configured
            ? `已配置：${config?.base_url} · ${config?.model}（${config?.api_key_masked}）`
            : '尚未配置。兼容任何 OpenAI 协议服务（OpenAI / DeepSeek / 通义 / 本地 vLLM 等），配置保存在本机用户数据目录，不入库、不分发。'
        }
      />
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="base_url"
          label="Base URL"
          rules={[
            { required: true, message: '请输入 Base URL' },
            {
              validator: (_, value: string) =>
                !value || /^https?:\/\//.test(value.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error('必须以 http:// 或 https:// 开头')),
            },
          ]}
          extra="例如 https://api.openai.com/v1（不带 /chat/completions 后缀）"
        >
          <Input placeholder="https://api.openai.com/v1" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="api_key"
          label="API Key"
          extra={configured ? '已配置时留空表示沿用原值' : undefined}
        >
          <Input.Password
            placeholder={configured ? `已配置（${config?.api_key_masked}），留空沿用` : 'sk-...'}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item
          name="model"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
          extra="例如 gpt-4o-mini / deepseek-chat / qwen-plus"
        >
          <Input placeholder="模型名称" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="timeout_seconds"
          label="超时时间（秒）"
          extra="5 ~ 600 秒，默认 180；报告篇幅大或思考型模型建议 300+"
        >
          <InputNumber min={5} max={600} style={{ width: 160 }} placeholder="180" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LlmConfigModal;
