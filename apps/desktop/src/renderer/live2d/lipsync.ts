/**
 * Live2D Lip Sync
 * 
 * 负责根据音频数据驱动 Live2D 模型的口型
 */

import { Live2DModel } from 'pixi-live2d-display';

export class LipSyncController {
  private model: Live2DModel;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isActive: boolean = false;
  private animationFrameId: number | null = null;
  private currentSource: MediaElementAudioSourceNode | null = null;
  private sourceMap: WeakMap<HTMLAudioElement, MediaElementAudioSourceNode> = new WeakMap();
  private volumeMode: boolean = false;
  private currentVolume: number = 0;

  constructor(model: Live2DModel) {
    this.model = model;
  }

  /**
   * Initialize audio context and analyser
   */
  async initialize(): Promise<void> {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    console.log('LipSync initialized');
  }

  /**
   * Start lip sync with audio element
   */
  start(audioElement: HTMLAudioElement): void {
    if (!this.audioContext || !this.analyser) {
      console.error('[LipSync] Not initialized');
      return;
    }

    try {
      console.log('[LipSync] Starting with audio element');
      
      // 检查是否已经为这个 audio 元素创建过源
      let source = this.sourceMap.get(audioElement);
      
      if (!source) {
        console.log('[LipSync] Creating new MediaElementSource');
        source = this.audioContext.createMediaElementSource(audioElement);
        this.sourceMap.set(audioElement, source);
        
        // 连接到分析器和音频输出
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } else {
        console.log('[LipSync] Reusing existing MediaElementSource');
      }
      
      this.currentSource = source;
      this.isActive = true;
      this.updateLipSync();
      
      console.log('[LipSync] Started successfully, isActive:', this.isActive);
    } catch (error) {
      console.error('[LipSync] Failed to start:', error);
    }
  }

  /**
   * Start lip sync without audio (simple animation)
   */
  startSimple(): void {
    this.isActive = true;
    this.volumeMode = false;
    this.updateLipSyncSimple();
  }

  /**
   * Start lip sync with volume data (from remote audio)
   */
  startVolumeMode(): void {
    this.isActive = true;
    this.volumeMode = true;
    this.currentVolume = 0;
  }

  /**
   * Update volume (called from IPC)
   */
  updateVolume(volume: number): void {
    if (!this.isActive || !this.volumeMode) {
      return;
    }
    
    this.currentVolume = volume;
    this.setMouthOpenY(volume);
  }

  /**
   * Update loop for volume-based lip sync
   * 注：已废弃，现在直接在 updateVolume() 中设置
   */
  private updateLipSyncVolume(): void {
    // 不再使用循环，直接在 updateVolume 中设置
  }

  /**
   * Update loop for simple lip sync (without audio analysis)
   */
  private updateLipSyncSimple(): void {
    if (!this.isActive) return;

    // 简单的周期性动画：模拟说话时的嘴巴张合
    const time = Date.now() / 100; // 时间缩放
    const baseOpen = 0.3; // 基础张口度
    const variation = 0.4; // 变化幅度
    
    // 使用正弦波模拟说话
    const mouthOpen = baseOpen + Math.sin(time) * variation + Math.sin(time * 2.3) * (variation * 0.3);
    const normalized = Math.max(0, Math.min(1, mouthOpen));
    
    this.setMouthOpenY(normalized);

    this.animationFrameId = requestAnimationFrame(() => this.updateLipSyncSimple());
  }

  /**
   * Stop lip sync
   */
  stop(): void {
    this.isActive = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 断开当前音频源
    if (this.currentSource) {
      try {
        this.currentSource.disconnect();
      } catch (e) {
        // 忽略错误
      }
      this.currentSource = null;
    }

    // Reset mouth parameter
    this.setMouthOpenY(0);
  }

  /**
   * Update loop for lip sync (from analyser)
   */
  private updateLipSync(): void {
    if (!this.isActive || !this.analyser) {
      console.log('[LipSync] Update stopped - isActive:', this.isActive, 'analyser:', !!this.analyser);
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalized = Math.min(average / 128, 1.0);

    if (normalized > 0.01) {
      console.log('[LipSync] Volume:', normalized.toFixed(3));
    }

    this.setMouthOpenY(normalized);

    this.animationFrameId = requestAnimationFrame(() => this.updateLipSync());
  }

  /**
   * Update lip sync from raw audio data
   */
  private updateLipSyncFromData(audioData: Float32Array): void {
    if (!this.isActive) return;

    // Calculate RMS (Root Mean Square) for volume
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    const normalized = Math.min(rms * 3, 1.0); // Amplify and clamp

    this.setMouthOpenY(normalized);
  }

  /**
   * Set mouth open parameter (ParamMouthOpenY)
   */
  private setMouthOpenY(value: number): void {
    if (!this.model) return;

    try {
      const coreModel = this.model.internalModel.coreModel as any;
      const paramIndex = coreModel.getParameterIndex('ParamMouthOpenY');
      
      if (paramIndex >= 0) {
        coreModel.setParameterValueByIndex(paramIndex, value);
      }
    } catch (error) {
      // 静默处理错误
    }
  }

  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
