/**
 * Audio Player Manager (Renderer Process)
 * 
 * 负责音频播放和队列管理
 * 注意：音频播放必须在渲染进程中进行
 */

export interface AudioPlayOptions {
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onAudioData?: (data: Float32Array) => void;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  /**
   * Play audio from ArrayBuffer
   */
  async play(audioBuffer: ArrayBuffer, options: AudioPlayOptions = {}): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Stop current playback
    this.stop();

    try {
      // Decode audio data
      const buffer = await this.audioContext.decodeAudioData(audioBuffer);
      
      // Create source
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = buffer;
      
      // Set volume
      if (options.volume !== undefined && this.gainNode) {
        this.gainNode.gain.value = options.volume;
      }
      
      // Connect nodes
      this.currentSource.connect(this.analyser!);
      this.analyser!.connect(this.gainNode!);
      
      // Setup callbacks
      this.currentSource.onended = () => {
        this.isPlaying = false;
        if (options.onEnd) {
          options.onEnd();
        }
      };
      
      // Start playback
      this.currentSource.start(0);
      this.isPlaying = true;
      
      if (options.onStart) {
        options.onStart();
      }
      
      // Start audio data monitoring
      if (options.onAudioData) {
        this.startAudioDataMonitoring(options.onAudioData);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (error) {
        // Already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.isPlaying = false;
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.gainNode?.gain.value || 0;
  }

  /**
   * Check if playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Monitor audio data for visualization/lip sync
   */
  private startAudioDataMonitoring(callback: (data: Float32Array) => void): void {
    if (!this.analyser || !this.isPlaying) return;

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    
    const update = () => {
      if (!this.isPlaying || !this.analyser) return;
      
      this.analyser.getFloatFrequencyData(dataArray);
      callback(dataArray);
      
      requestAnimationFrame(update);
    };
    
    update();
  }

  /**
   * Destroy audio player
   */
  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
