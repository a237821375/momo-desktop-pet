/**
 * 音频管理器
 * 
 * 负责麦克风录音和音频播放
 */

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  
  // 播放队列
  private playQueue: ArrayBuffer[] = [];
  private isPlaying: boolean = false;
  
  // 口型回调
  private onLipSyncCallback: ((volume: number) => void) | null = null;

  /**
   * 初始化音频上下文
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      console.log('AudioManager initialized');
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      throw error;
    }
  }

  /**
   * 开始录音
   */
  async startRecording(onDataAvailable: (audioData: ArrayBuffer) => void): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // 请求麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm',
      });

      this.audioChunks = [];

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // 录音停止时处理
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // 转换为 PCM 16000Hz
        const pcmData = await this.convertToPCM(arrayBuffer, 16000);
        onDataAvailable(pcmData);
        
        this.audioChunks = [];
      };

      // 开始录音（每500ms触发一次 dataavailable）
      this.mediaRecorder.start(500);
      this.isRecording = true;
      
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * 停止录音
   */
  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    this.mediaRecorder.stop();
    
    // 释放媒体流
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isRecording = false;
    console.log('Recording stopped');
  }

  /**
   * 播放音频（PCM 24000Hz）
   */
  async playAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    // 添加到播放队列
    this.playQueue.push(audioData);

    // 如果没有在播放，开始播放
    if (!this.isPlaying) {
      this.processPlayQueue();
    }
  }

  /**
   * 处理播放队列
   */
  private async processPlayQueue(): Promise<void> {
    if (this.playQueue.length === 0) {
      this.isPlaying = false;
      // 停止口型同步
      if (this.onLipSyncCallback) {
        this.onLipSyncCallback(0);
      }
      return;
    }

    this.isPlaying = true;
    const audioData = this.playQueue.shift()!;

    try {
      await this.playPCM(audioData);
      // 继续播放下一个
      this.processPlayQueue();
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.isPlaying = false;
    }
  }

  /**
   * 播放 PCM 数据
   */
  private async playPCM(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    // 将 PCM Buffer 转换为 Float32Array
    const pcmData = new DataView(audioData);
    const sampleCount = pcmData.byteLength / 2; // int16 = 2 bytes
    const audioBuffer = this.audioContext.createBuffer(1, sampleCount, 24000);
    const channelData = audioBuffer.getChannelData(0);

    // 转换 int16 到 float32
    for (let i = 0; i < sampleCount; i++) {
      const int16 = pcmData.getInt16(i * 2, true); // little-endian
      channelData[i] = int16 / 32768.0; // 归一化到 [-1, 1]
    }

    // 创建音频源
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // 创建分析器用于口型同步
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);
    analyser.connect(this.audioContext.destination);

    // 口型同步
    const updateLipSync = () => {
      if (this.onLipSyncCallback) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const volume = average / 255.0; // 归一化到 [0, 1]
        this.onLipSyncCallback(volume);
      }
    };

    const lipSyncInterval = setInterval(updateLipSync, 50); // 每50ms更新一次

    // 播放
    return new Promise((resolve) => {
      source.onended = () => {
        clearInterval(lipSyncInterval);
        resolve();
      };
      source.start(0);
    });
  }

  /**
   * 转换 WebM 音频到 PCM
   */
  private async convertToPCM(webmData: ArrayBuffer, targetSampleRate: number): Promise<ArrayBuffer> {
    if (!this.audioContext) {
      await this.initialize();
    }

    // 解码音频
    const audioBuffer = await this.audioContext!.decodeAudioData(webmData);

    // 重采样到目标采样率
    const offlineContext = new OfflineAudioContext(
      1, // 单声道
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();

    // 转换为 PCM int16
    const channelData = renderedBuffer.getChannelData(0);
    const pcmData = new Int16Array(channelData.length);

    for (let i = 0; i < channelData.length; i++) {
      // 限制在 [-1, 1]
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      // 转换为 int16
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return pcmData.buffer;
  }

  /**
   * 设置口型同步回调
   */
  setLipSyncCallback(callback: (volume: number) => void): void {
    this.onLipSyncCallback = callback;
  }

  /**
   * 清空播放队列
   */
  clearPlayQueue(): void {
    this.playQueue = [];
    this.isPlaying = false;
  }

  /**
   * 获取录音状态
   */
  getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopRecording();
    this.clearPlayQueue();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// 导出单例
export const audioManager = new AudioManager();
