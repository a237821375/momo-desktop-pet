/**
 * Live2D Motion Manager
 * 
 * 负责管理 Live2D 模型的动作和表情
 */

import { Live2DModel } from 'pixi-live2d-display';

export type MotionState = 'idle' | 'thinking' | 'speaking' | 'custom';

export interface MotionConfig {
  idle: string[];
  thinking: string[];
  speaking: string[];
}

export class MotionManager {
  private currentMotion: string | null = null;
  private motionConfig: MotionConfig;
  private model: Live2DModel;

  constructor(model: Live2DModel, motionConfig: MotionConfig) {
    this.model = model;
    this.motionConfig = motionConfig;
  }

  /**
   * Play motion by name
   */
  async playMotion(motionName: string, priority: number = 2): Promise<void> {
    if (!this.model) {
      console.warn('Model not loaded');
      return;
    }

    console.log(`Playing motion: ${motionName}`);
    this.currentMotion = motionName;
    
    try {
      await this.model.motion(motionName, priority);
    } catch (error) {
      console.error(`Failed to play motion: ${motionName}`, error);
    }
  }

  /**
   * Play random motion from a state
   */
  async playStateMotion(state: MotionState): Promise<void> {
    const motions = this.motionConfig[state];
    if (!motions || motions.length === 0) {
      console.warn(`No motions configured for state: ${state}`);
      return;
    }

    const randomMotion = motions[Math.floor(Math.random() * motions.length)];
    await this.playMotion(randomMotion);
  }

  /**
   * Set expression by name
   */
  async setExpression(expressionName: string): Promise<void> {
    if (!this.model) {
      console.warn('Model not loaded');
      return;
    }

    console.log(`Setting expression: ${expressionName}`);
    
    try {
      await this.model.expression(expressionName);
    } catch (error) {
      console.error(`Failed to set expression: ${expressionName}`, error);
    }
  }

  /**
   * Stop current motion
   */
  stopMotion(): void {
    if (!this.model) return;
    
    console.log('Stopping motion');
    this.currentMotion = null;
    
    try {
      this.model.internalModel.motionManager.stopAllMotions();
    } catch (error) {
      console.error('Failed to stop motion:', error);
    }
  }

  getCurrentMotion(): string | null {
    return this.currentMotion;
  }
}
