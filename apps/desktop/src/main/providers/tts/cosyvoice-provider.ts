/**
 * CosyVoice TTS Provider
 * 
 * 百炼 CosyVoice 语音合成服务
 */

// Inline type definition
export interface TTSConfig {
  provider: 'cosyvoice';
  apiKeyRef: string;
  voiceId: string;
  speed: number;
  volume: number;
}

export interface TTSSpeakOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  volume?: number;
}

export class CosyVoiceProvider {
  private config: TTSConfig;
  private apiKey: string;
  private abortController: AbortController | null = null;

  constructor(config: TTSConfig, apiKey: string) {
    this.config = config;
    this.apiKey = apiKey;
  }

  /**
   * Synthesize speech from text
   * @returns Audio buffer data
   */
  async speak(options: TTSSpeakOptions): Promise<ArrayBuffer> {
    this.abortController = new AbortController();

    const voiceId = options.voiceId || this.config.voiceId;
    const speed = options.speed || this.config.speed;
    const volume = options.volume || this.config.volume;

    try {
      // 百炼 CosyVoice API endpoint
      // 文档: https://help.aliyun.com/zh/model-studio/developer-reference/cosyvoice-api/
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'cosyvoice-v1',
          input: {
            text: options.text,
          },
          parameters: {
            voice: voiceId,
            speed: speed,
            volume: volume,
            format: 'mp3', // or 'wav', 'pcm'
          },
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS API error: ${response.status} ${errorText}`);
      }

      // Get audio data
      const audioBuffer = await response.arrayBuffer();
      return audioBuffer;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('TTS request aborted');
        throw new Error('TTS request aborted');
      } else {
        console.error('TTS request error:', error);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Streaming TTS (if supported)
   * @param options TTS options
   * @param onChunk Callback for audio chunks
   */
  async speakStream(
    options: TTSSpeakOptions,
    onChunk: (chunk: ArrayBuffer) => void
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable', // Enable streaming
        },
        body: JSON.stringify({
          model: 'cosyvoice-v1',
          input: {
            text: options.text,
          },
          parameters: {
            voice: options.voiceId || this.config.voiceId,
            speed: options.speed || this.config.speed,
            volume: options.volume || this.config.volume,
            format: 'mp3',
          },
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        onChunk(value.buffer);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('TTS stream aborted');
      } else {
        console.error('TTS stream error:', error);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Abort current TTS request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
