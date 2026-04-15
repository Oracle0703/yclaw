/**
 * LLM Provider — 抽象层 + OpenAI 兼容实现
 */

import type { ChatMessage } from '@shared/types';
import type { LLMProvider } from './types';

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: OpenAIProviderConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 2048,
};

/**
 * OpenAI 兼容 Provider
 * 支持 OpenAI、DeepSeek、Ollama 等兼容 API
 */
export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private config: OpenAIProviderConfig;

  constructor(config?: Partial<OpenAIProviderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<OpenAIProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    if (!this.config.apiKey) {
      return '请先在设置中配置 AI API Key。前往 设置 > AI 助手 进行配置。';
    }

    const apiMessages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: apiMessages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Ollama 本地模型 Provider
 */
export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const apiMessages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: apiMessages,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error (${response.status})`);
      }

      const data = (await response.json()) as { message: { content: string } };
      return data.message?.content ?? '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
