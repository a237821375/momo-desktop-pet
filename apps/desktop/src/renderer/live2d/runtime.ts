/**
 * Live2D Runtime Manager
 * 
 * 使用 pixi-live2d-display/cubism4 + 官方 Cubism SDK
 */

import * as PIXI from 'pixi.js';
// 关键：从 cubism4 子路径导入，支持 Cubism 4/5
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { LipSyncController } from './lipsync';

// 声明全局变量
declare global {
  interface Window {
    PIXI: typeof PIXI;
    Live2DCubismCore?: any;
  }
}

if (!window.PIXI) {
  window.PIXI = PIXI;
}

export class Live2DRuntime {
  private app: PIXI.Application | null = null;
  private canvas: HTMLCanvasElement;
  private model: Live2DModel | null = null;
  private lipSyncController: LipSyncController | null = null;
  private config: {
    scale: number;
    position: { x: number; y: number };
    opacity: number;
  };
  
  // 眼睛追踪相关
  private mouse = { x: 0, y: 0, inside: false };  // 鼠标位置状态
  private hasLoggedParams: boolean = false;  // 是否已打印参数信息
  
  // 口型同步相关
  private mouthOpen: number = 0;  // 当前口型开合度 (0-1)
  private disableRuntimeMouthSync: boolean = false;  // 是否禁用 runtime 的口型同步（当使用 IPC 音量驱动时）

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.config = {
      scale: 1.0,
      position: { x: 0, y: 0 },
      opacity: 1.0,
    };
  }

  async initialize(): Promise<void> {
    // 检查 Cubism Core 是否加载
    if (!window.Live2DCubismCore) {
      throw new Error('Cubism Core not loaded');
    }

    console.log('Cubism Core loaded successfully');

    // Initialize PixiJS
    // 关键：高 DPI 屏幕上需要高分辨率渲染，但由我们手动控制 Canvas CSS
    const dpr = window.devicePixelRatio || 1;
    
    this.app = new PIXI.Application({
      view: this.canvas,
      width: this.canvas.width,
      height: this.canvas.height,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: false,  // 禁用自动，我们已手动设置 CSS
      resolution: dpr,     // 使用设备像素比，高清渲染
    });

    console.log('Live2D Runtime initialized with pixi-live2d-display');
    console.log('Canvas physical size:', this.canvas.width, 'x', this.canvas.height);
    console.log('Device Pixel Ratio:', dpr);
    console.log('PixiJS resolution:', this.app.renderer.resolution);
  }

  async loadModel(modelPath: string): Promise<void> {
    if (!this.app) {
      throw new Error('Runtime not initialized');
    }

    console.log(`Loading Live2D model: ${modelPath}`);
    
    try {
      // 使用 pixi-live2d-display 加载模型
      this.model = await Live2DModel.from(modelPath);
      
      console.log('Model loaded successfully');
      console.log('Model original size:', this.model.width, 'x', this.model.height);
      console.log('Canvas physical size:', this.canvas.width, 'x', this.canvas.height);
      console.log('Renderer resolution:', this.app.renderer.resolution);
      
      // 关键：获取逻辑尺寸（物理尺寸 / resolution）
      const dpr = this.app.renderer.resolution;
      const logicalWidth = this.canvas.width / dpr;
      const logicalHeight = this.canvas.height / dpr;
      
      console.log('Canvas logical size:', logicalWidth, 'x', logicalHeight);
      
      // 计算缩放比例 - 基于逻辑尺寸
      const scaleX = logicalWidth / this.model.width;
      const scaleY = logicalHeight / this.model.height;
      
      // 使用更大的缩放比例，让人物占满更多空间
      const scale = Math.min(scaleX, scaleY) * 1.0;  // 改为 1.0，几乎占满窗口
      
      this.model.scale.set(scale);
      
      // 居中显示，稍微向下偏移
      this.model.anchor.set(0.5, 0.5);
      this.model.x = logicalWidth / 2;
      this.model.y = logicalHeight / 2 + 20;  // 向下偏移 20 像素，让头部有更多空间
      
      console.log('Model scale:', scale);
      console.log('Model position (logical):', this.model.x, this.model.y);
      console.log('Model scaled size:', this.model.width * scale, 'x', this.model.height * scale);
      
      // 添加到舞台
      this.app.stage.addChild(this.model as any);
      
      // 启用眼睛跟随鼠标
      this.enableMouseTracking();
      
      // 设置每帧更新回调
      this.app.ticker.add(() => this.updateModelParameters());
      
      console.log('Model added to stage');
      console.log('Eye tracking enabled');
      
      // 初始化 LipSync 控制器
      this.lipSyncController = new LipSyncController(this.model);
      await this.lipSyncController.initialize();
      console.log('LipSync controller initialized');
      
    } catch (error) {
      console.error('Failed to load Live2D model:', error);
      
      // 显示错误信息
      const errorText = new PIXI.Text(
        '模型加载失败\n\n' +
        '错误: ' + (error as Error).message,
        {
          fontFamily: 'Arial',
          fontSize: 16,
          fill: 0xff0000,
          align: 'left',
        }
      );
      
      errorText.position.set(20, 20);
      this.app.stage.addChild(errorText);
      
      throw error;
    }
  }

  setScale(scale: number): void {
    this.config.scale = scale;
    if (this.model) {
      this.model.scale.set(scale);
    }
  }

  setPosition(x: number, y: number): void {
    this.config.position = { x, y };
    if (this.model) {
      this.model.x = x;
      this.model.y = y;
    }
  }

  setOpacity(opacity: number): void {
    this.config.opacity = opacity;
    if (this.model) {
      this.model.alpha = opacity;
    }
  }

  /**
   * 设置口型开合度（用于语音同步）
   * @param openAmount 0-1之间，0=闭嘴，1=大张嘴巴
   */
  setMouthOpen(openAmount: number): void {
    this.mouthOpen = this.clamp(openAmount, 0, 1);
  }

  /**
   * 播放动作
   * @param group 动作组名（如 'Idle', 'Tap', 'Flick' 等）
   * @param index 动作索引（可选，默认为 0）
   */
  async playMotion(group: string, index: number = 0): Promise<void> {
    if (!this.model) {
      console.warn('Model not loaded');
      return;
    }

    try {
      // 使用 pixi-live2d-display 的 motion 方法
      await this.model.motion(group, index);
      console.log(`Playing motion: ${group}[${index}]`);
    } catch (error) {
      console.error(`Failed to play motion ${group}[${index}]:`, error);
    }
  }

  /**
   * 获取可用的动作列表
   */
  getAvailableMotions(): Record<string, number> {
    if (!this.model) return {};
    
    const model = this.model as any;
    
    // 尝试从 settings 获取
    if (model.internalModel && model.internalModel.settings) {
      const settings = model.internalModel.settings;
      if (settings.motions) {
        const motions: Record<string, number> = {};
        Object.entries(settings.motions).forEach(([group, defs]: [string, any]) => {
          if (Array.isArray(defs)) {
            motions[group] = defs.length;
          } else {
            motions[group] = 1;
          }
        });
        return motions;
      }
    }
    
    // 备用方案：从 motionManager 获取
    if (model.internalModel && model.internalModel.motionManager) {
      const motionManager = model.internalModel.motionManager;
      if (motionManager.definitions) {
        const motions: Record<string, number> = {};
        Object.entries(motionManager.definitions).forEach(([group, defs]: [string, any]) => {
          if (Array.isArray(defs)) {
            motions[group] = defs.length;
          } else {
            motions[group] = 1;
          }
        });
        return motions;
      }
    }
    
    return {};
  }

  /**
   * 获取可用的表情列表
   */
  getAvailableExpressions(): string[] {
    if (!this.model) return [];
    
    const model = this.model as any;
    
    // 方法1：尝试从 expressions 数组中获取
    if (model.internalModel && model.internalModel.settings) {
      const settings = model.internalModel.settings;
      if (settings.expressions && Array.isArray(settings.expressions)) {
        // expressions 是数组，每个元素有 Name 和 File 字段
        return settings.expressions.map((expr: any) => {
          // 返回 Name，如果没有则从 File中提取
          if (expr.Name) return expr.Name;
          if (expr.File) {
            // 从 "black.exp3.json" 提取 "black"
            return expr.File.replace('.exp3.json', '');
          }
          return null;
        }).filter((name: any) => name !== null);
      }
    }
    
    // 方法2：尝试从 expressionManager 获取
    if (model.internalModel && model.internalModel.motionManager) {
      const motionManager = model.internalModel.motionManager;
      if (motionManager.expressionManager && motionManager.expressionManager.definitions) {
        const keys = Object.keys(motionManager.expressionManager.definitions);
        // 如果 keys 是数字索引，尝试获取其 Name
        if (keys.length > 0 && !isNaN(Number(keys[0]))) {
          // 索引式存储，尝试获取每个表情的名称
          return keys.map(key => {
            const expr = motionManager.expressionManager.definitions[key];
            return expr?.Name || expr?.name || key;
          });
        }
        return keys;
      }
    }
    
    return [];
  }

  /**
   * 播放表情
   * @param name 表情名称
   */
  async playExpression(name: string): Promise<void> {
    if (!this.model) {
      console.warn('Model not loaded');
      return;
    }

    try {
      // 使用 pixi-live2d-display 的 expression 方法
      await this.model.expression(name);
      console.log(`Playing expression: ${name}`);
    } catch (error) {
      console.error(`Failed to play expression ${name}:`, error);
    }
  }

  /**
   * 启用眼睛跟随鼠标
   */
  private enableMouseTracking(): void {
    if (!this.model) return;
    
    console.log('Initializing mouse tracking...');
    
    // 监听整个文档的鼠标移动事件
    document.addEventListener('mousemove', (event: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      
      // 检查鼠标是否在 Canvas 内
      const isInside = (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
      
      // 更新 inside 状态
      if (isInside !== this.mouse.inside) {
        this.mouse.inside = isInside;
      }
      
      if (isInside) {
        // 计算相对位置 (0 到 1)
        const cx = (event.clientX - rect.left) / rect.width;
        const cy = (event.clientY - rect.top) / rect.height;
        
        // 归一化到 -1 到 1，注意 y 方向反转（上为正）
        this.mouse.x = (cx - 0.5) * 2.0;
        this.mouse.y = (0.5 - cy) * 2.0;
      }
    });
    
    console.log('Mouse tracking initialized');
  }
  
  /**
   * 每帧更新模型参数 - 眼睛追踪
   */
  private updateModelParameters(): void {
    if (!this.model) return;
    
    // 访问底层 Cubism 模型
    const model = this.model as any;
    if (model.internalModel && model.internalModel.coreModel) {
      const coreModel = model.internalModel.coreModel;
      
      // 调试：打印可用的参数（只打印一次）
      if (!this.hasLoggedParams) {
        console.log('=== 模型参数信息 ===');
        console.log('coreModel 类型:', typeof coreModel);
        console.log('setParameterValueById 存在:', typeof coreModel.setParameterValueById);
        console.log('getParameterValueById 存在:', typeof coreModel.getParameterValueById);
        
        // 尝试获取参数列表
        if (typeof coreModel.getParameterCount === 'function') {
          const count = coreModel.getParameterCount();
          console.log('参数总数:', count);
        }
        
        this.hasLoggedParams = true;
      }
      
      // 应用眼睛追踪
      this.applyLookAt(coreModel);
      
      // 应用口型同步
      this.applyMouthSync(coreModel);
    }
  }
  
  /**
   * 应用眼睛和头部追踪
   */
  private applyLookAt(coreModel: any): void {
    if (typeof coreModel.setParameterValueById !== 'function') return;
    
    // 目标值：使用当前鼠标位置（即使离开窗口也保持最后的位置）
    const targetX = this.mouse.x;
    const targetY = this.mouse.y;
    
    // 平滑系数（0.15 = 较平滑，0.3 = 较跟手）
    const smooth = 0.15;
    
    // 眼球：幅度 0.9（稍微限制一下，不要太夸张）
    const eyeX = this.clamp(targetX * 0.9, -1, 1);
    const eyeY = this.clamp(targetY * 0.9, -1, 1);
    
    // 头部角度：[-30, 30] 度左右
    const angleX = this.clamp(targetX * 30, -30, 30);
    const angleY = this.clamp(targetY * 25, -25, 25);
    
    // 身体角度：幅度更小
    const bodyX = this.clamp(targetX * 10, -10, 10);
    
    // 平滑写入参数
    this.setSmooth(coreModel, 'ParamEyeBallX', eyeX, smooth);
    this.setSmooth(coreModel, 'ParamEyeBallY', eyeY, smooth);
    this.setSmooth(coreModel, 'ParamAngleX', angleX, smooth);
    this.setSmooth(coreModel, 'ParamAngleY', angleY, smooth);
    this.setSmooth(coreModel, 'ParamBodyAngleX', bodyX, smooth);
  }
  
  /**
   * 应用口型同步
   */
  private applyMouthSync(coreModel: any): void {
    // 如果启用了 IPC 音量驱动模式，则不在这里控制口型
    if (this.disableRuntimeMouthSync) {
      return;
    }
    
    if (typeof coreModel.setParameterValueById !== 'function') return;
    
    // ParamMouthOpenY: 口型开合度 (0-1)
    // 平滑过渡，避免突变
    const smooth = 0.3;  // 口型要更跟手一些
    this.setSmooth(coreModel, 'ParamMouthOpenY', this.mouthOpen, smooth);
  }
  
  /**
   * 平滑设置参数值
   */
  private setSmooth(coreModel: any, id: string, target: number, t: number): void {
    const current = coreModel.getParameterValueById?.(id) ?? 0;
    const newValue = this.lerp(current, target, t);
    coreModel.setParameterValueById?.(id, newValue);
  }
  
  /**
   * 线性插值
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  /**
   * 限制数值范围
   */
  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * 启动口型同步
   * @param audioElement 正在播放的音频元素
   */
  public startLipSync(audioElement: HTMLAudioElement): void {
    if (this.lipSyncController) {
      this.lipSyncController.start(audioElement);
      console.log('[Runtime] LipSync started');
    } else {
      console.warn('[Runtime] LipSync controller not initialized');
    }
  }

  /**
   * 停止口型同步
   */
  public stopLipSync(): void {
    if (this.lipSyncController) {
      this.lipSyncController.stop();
      console.log('[Runtime] LipSync stopped');
    }
  }

  /**
   * 启用/禁用 runtime 的口型同步（用于 IPC 音量驱动模式）
   */
  public setRuntimeMouthSyncEnabled(enabled: boolean): void {
    this.disableRuntimeMouthSync = !enabled;
    console.log('[Runtime] Runtime mouth sync', enabled ? 'enabled' : 'disabled');
  }

  destroy(): void {
    if (this.lipSyncController) {
      this.lipSyncController.stop();
      this.lipSyncController = null;
    }
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }
    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }
}
