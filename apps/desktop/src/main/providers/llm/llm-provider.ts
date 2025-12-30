/**
 * LLM Provider - OpenAI Compatible API
 * 
 * 支持兼容 OpenAI API 的服务:
 * - DeepSeek
 * - 通义千问
 * - 其他 OpenAI-compatible 服务
 */

// Inline type definition
export interface LLMConfig {
  provider: 'openai_compat';
  baseUrl: string;
  apiKeyRef: string;
  model: string;
  temperature: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatOptions {
  messages: LLMMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

export class LLMProvider {
  private config: LLMConfig;
  private apiKey: string;
  private abortController: AbortController | null = null;

  constructor(config: LLMConfig, apiKey: string) {
    this.config = config;
    this.apiKey = apiKey;
  }

  /**
   * Send chat completion request (streaming)
   */
  async chatStream(
    options: LLMChatOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: options.messages,
          temperature: options.temperature ?? this.config.temperature,
          max_tokens: options.maxTokens,
          stream: true,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onChunk({ content: '', done: true });
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') {
            onChunk({ content: '', done: true });
            return;
          }

          if (line.startsWith('data: ')) {
            try {
              const data: any = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                onChunk({ content, done: false });
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('LLM request aborted');
      } else {
        console.error('LLM request error:', error);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Send chat completion request (non-streaming)
   */
  async chat(options: LLMChatOptions): Promise<string> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: options.messages,
          temperature: options.temperature ?? this.config.temperature,
          max_tokens: options.maxTokens,
          stream: false,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('LLM request aborted');
        return '';
      } else {
        console.error('LLM request error:', error);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Abort current request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
