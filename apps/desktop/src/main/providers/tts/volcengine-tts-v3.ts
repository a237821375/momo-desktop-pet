import fetch from 'node-fetch'
import { randomUUID } from 'crypto'

export interface VolcengineTTSV3Config {
  provider: 'volcengine-v3'
  appId: string
  accessToken: string
  resourceId?: string
  voiceType: string
  speed?: number
  volume?: number
  sampleRate?: number
  format?: 'mp3' | 'wav' | 'pcm'
}

export interface TTSV3SpeakOptions {
  text: string
  voiceType?: string
  speed?: number
  volume?: number
}

interface ChunkData {
  code: number
  data?: string
  sentence?: any
  usage?: any
  message?: string
}

/**
 * 火山引擎 TTS V3 HTTP 单向流式 Provider
 * 支持大模型音色
 */
export class VolcengineTTSV3Provider {
  private config: VolcengineTTSV3Config
  private endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'

  constructor(config: VolcengineTTSV3Config) {
    this.config = {
      format: 'mp3',
      sampleRate: 24000,
      speed: 1.0,
      volume: 1.0,
      ...config,
    }
  }

  /**
   * 合成语音
   */
  async speak(options: TTSV3SpeakOptions): Promise<ArrayBuffer> {
    const text = options.text
    const voiceType = options.voiceType || this.config.voiceType
    const speed = options.speed || this.config.speed || 1.0
    const volume = options.volume || this.config.volume || 1.0

    const headers: Record<string, string> = {
      'X-Api-App-Id': this.config.appId,
      'X-Api-Access-Key': this.config.accessToken,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
    }

    // 如果有 resourceId（声音复刻），添加到 header
    if (this.config.resourceId) {
      headers['X-Api-Resource-Id'] = this.config.resourceId
    }

    const payload = {
      user: {
        uid: randomUUID(),
      },
      req_params: {
        text: text,
        speaker: voiceType,
        audio_params: {
          format: this.config.format,
          sample_rate: this.config.sampleRate,
          speed_ratio: speed,
          volume_ratio: volume,
        },
        additions: JSON.stringify({
          explicit_language: 'zh',
          disable_markdown_filter: true,
        }),
      },
    }

    console.log('[VolcengineTTS-V3] Request:', {
      endpoint: this.endpoint,
      voiceType,
      textLength: text.length,
    })

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        // 读取错误响应体
        const errorText = await response.text()
        console.error('[VolcengineTTS-V3] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          headers: Object.fromEntries(response.headers.entries())
        })
        console.error('[VolcengineTTS-V3] Request details:', {
          endpoint: this.endpoint,
          headers: headers,
          payload: payload
        })
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }

      const logid = response.headers.get('X-Tt-Logid')
      console.log('[VolcengineTTS-V3] X-Tt-Logid:', logid)

      // 读取流式响应
      const audioChunks: Buffer[] = []
      let totalSize = 0

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // 处理流式响应
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk as Buffer, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data: ChunkData = JSON.parse(line)

            // 音频数据
            if (data.code === 0 && data.data) {
              const audioBuffer = Buffer.from(data.data, 'base64')
              audioChunks.push(audioBuffer)
              totalSize += audioBuffer.length
              continue
            }

            // 句子信息（可选）
            if (data.code === 0 && data.sentence) {
              console.log('[VolcengineTTS-V3] Sentence:', data.sentence)
              continue
            }

            // 合成完成
            if (data.code === 20000000) {
              if (data.usage) {
                console.log('[VolcengineTTS-V3] Usage:', data.usage)
              }
              break
            }

            // 错误
            if (data.code > 0) {
              throw new Error(`TTS Error (code ${data.code}): ${data.message || 'Unknown error'}`)
            }
          } catch (parseError) {
            console.warn('[VolcengineTTS-V3] Failed to parse line:', line, parseError)
          }
        }
      }

      // 合并音频数据
      if (audioChunks.length === 0) {
        throw new Error('No audio data received')
      }

      const totalAudio = Buffer.concat(audioChunks, totalSize)
      console.log(`[VolcengineTTS-V3] Audio synthesized: ${(totalSize / 1024).toFixed(2)} KB`)

      // 转换为 ArrayBuffer
      return totalAudio.buffer.slice(
        totalAudio.byteOffset,
        totalAudio.byteOffset + totalAudio.byteLength
      ) as ArrayBuffer
    } catch (error) {
      console.error('[VolcengineTTS-V3] Error:', error)
      throw error
    }
  }

  /**
   * 中止当前合成（V3 HTTP 不支持中止）
   */
  abort(): void {
    console.warn('[VolcengineTTS-V3] Abort not supported for HTTP requests')
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.speak({ text: '测试' })
      return true
    } catch (error) {
      console.error('[VolcengineTTS-V3] Connection test failed:', error)
      return false
    }
  }
}
