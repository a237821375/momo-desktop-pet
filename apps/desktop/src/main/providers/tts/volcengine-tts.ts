import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'
import {
  sendFullClientRequest,
  receiveMessage,
  MsgType,
  EventType,
} from './volcengine-protocol'

export interface VolcengineTTSConfig {
  provider: 'volcengine'
  apiKeyRef: string
  appId: string
  voiceType: string
  speed: number
  volume: number
  endpoint?: string
  encoding?: 'wav' | 'mp3' | 'ogg_opus'
}

export interface TTSSpeakOptions {
  text: string
  voiceType?: string
  speed?: number
  volume?: number
}

/**
 * 火山引擎 TTS Provider
 * 使用 WebSocket 二进制协议进行语音合成
 */
export class VolcengineTTSProvider {
  private config: VolcengineTTSConfig
  private apiKey: string
  private abortController: AbortController | null = null

  constructor(config: VolcengineTTSConfig, apiKey: string) {
    this.config = {
      endpoint: 'wss://openspeech.bytedance.com/api/v1/tts/ws_binary',
      encoding: 'wav',
      ...config,
    }
    this.apiKey = apiKey
  }

  /**
   * Synthesize speech from text
   * @returns Audio buffer data
   */
  async speak(options: TTSSpeakOptions): Promise<ArrayBuffer> {
    const text = options.text
    const voiceType = options.voiceType || this.config.voiceType
    const speed = options.speed || this.config.speed
    const volume = options.volume || this.config.volume
    const ws = await this.createWebSocketConnection()

    try {
      // 发送 TTS 请求
      await this.sendTTSRequest(ws, text, voiceType, speed, volume)

      // 接收音频数据
      const audioChunks: Uint8Array[] = []

      while (true) {
        const msg = await receiveMessage(ws)

        switch (msg.type) {
          case MsgType.FrontEndResultServer:
            // 元数据消息，记录日志但不处理
            this.logMessage('FrontEnd Result', msg)
            break

          case MsgType.AudioOnlyServer:
            // 音频数据
            if (msg.payload.length > 0) {
              audioChunks.push(msg.payload)
            }

            // 检查是否是最后一帧（sequence < 0）
            if (msg.sequence !== undefined && msg.sequence < 0) {
              console.log('[VolcengineTTS] Received all audio chunks')
              ws.close()
              const buffer = this.mergeAudioChunks(audioChunks)
              // 将 Buffer 转换为 ArrayBuffer
              return buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
              ) as ArrayBuffer
            }
            break

          case MsgType.Error:
            const errorMsg = new TextDecoder().decode(msg.payload)
            throw new Error(`TTS Error (code ${msg.errorCode}): ${errorMsg}`)

          default:
            console.warn(`[VolcengineTTS] Unexpected message type: ${msg.type}`)
        }
      }
    } catch (error) {
      ws.close()
      throw error
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private async createWebSocketConnection(): Promise<WebSocket> {
    const headers = {
      Authorization: `Bearer;${this.apiKey}`,
    }

    const ws = new WebSocket(this.config.endpoint!, {
      headers,
      skipUTF8Validation: true,
    })

    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('[VolcengineTTS] WebSocket connected')
        resolve(ws)
      })

      ws.on('error', (error) => {
        console.error('[VolcengineTTS] WebSocket error:', error)
        reject(error)
      })
    })
  }

  /**
   * 发送 TTS 请求
   */
  private async sendTTSRequest(
    ws: WebSocket,
    text: string,
    voiceType: string,
    speed: number,
    volume: number
  ): Promise<void> {
    const cluster = this.getCluster(voiceType)

    const request = {
      app: {
        appid: this.config.appId,
        token: this.apiKey,
        cluster: cluster,
      },
      user: {
        uid: uuidv4(),
      },
      audio: {
        voice_type: voiceType,
        encoding: this.config.encoding,
        speed_ratio: speed,
        volume_ratio: volume,
        pitch_ratio: 1.0,
      },
      request: {
        reqid: uuidv4(),
        text: text,
        text_type: 'plain',
        operation: 'submit',
        extra_param: JSON.stringify({
          disable_markdown_filter: false,
        }),
        with_timestamp: '1',
      },
    }

    console.log('[VolcengineTTS] Sending TTS request:', {
      voiceType: voiceType,
      textLength: text.length,
    })

    const payload = new TextEncoder().encode(JSON.stringify(request))
    await sendFullClientRequest(ws, payload)
  }

  /**
   * 根据音色类型确定 cluster
   */
  private getCluster(voiceType: string): string {
    // S_ 开头的音色使用 volcano_icl
    if (voiceType.startsWith('S_')) {
      return 'volcano_icl'
    }
    return 'volcano_tts'
  }

  /**
   * 合并音频块
   */
  private mergeAudioChunks(chunks: Uint8Array[]): Buffer {
    if (chunks.length === 0) {
      throw new Error('No audio data received')
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    console.log(`[VolcengineTTS] Merged ${chunks.length} chunks, total size: ${totalLength} bytes`)
    return Buffer.from(merged)
  }

  /**
   * 记录消息（用于调试）
   */
  private logMessage(label: string, msg: any): void {
    try {
      const payload = new TextDecoder().decode(msg.payload)
      console.log(`[VolcengineTTS] ${label}:`, payload)
    } catch (e) {
      console.log(`[VolcengineTTS] ${label}: [Binary data, ${msg.payload.length} bytes]`)
    }
  }

  /**
   * Abort current TTS request
   */
  abort(): void {
    // WebSocket doesn't have built-in abort like fetch
    // This would need to be implemented if we keep a reference to the active WebSocket
    console.log('[VolcengineTTS] Abort not yet implemented for WebSocket')
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const ws = await this.createWebSocketConnection()
      ws.close()
      return true
    } catch (error) {
      console.error('[VolcengineTTS] Connection test failed:', error)
      return false
    }
  }
}
