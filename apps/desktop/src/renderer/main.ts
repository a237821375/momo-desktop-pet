// Main renderer entry point
import { Live2DRuntime } from './live2d/runtime';
import { ControlIsland } from './ui/control-island';
import { MotionButtons } from './ui/motion-buttons';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import * as PIXI from 'pixi.js';

// 配置 pixi-live2d-display 使用 Cubism 5
window.PIXI = PIXI;

console.log('Desktop Pet AI Renderer Starting...');

let live2dRuntime: Live2DRuntime | null = null;
let controlIsland: ControlIsland | null = null;
let motionButtons: MotionButtons | null = null;

// Test IPC
if (window.electronAPI) {
  window.electronAPI.ping().then((response: string) => {
    console.log('IPC Test:', response);
  }).catch((error) => {
    console.error('IPC Test failed:', error);
  });
}

// Initialize Live2D
async function initLive2D() {
  const canvas = document.getElementById('live2d-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Live2D canvas not found');
    return;
  }

  // 设置 canvas 的实际像素尺寸（非常重要！）
  const resizeCanvas = () => {
    // 获取 CSS 逻辑尺寸
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    
    // 防止无效的尺寸设置
    if (cssWidth <= 0 || cssHeight <= 0) {
      console.warn('Invalid canvas size:', cssWidth, cssHeight);
      return;
    }
    
    // 关键：高 DPI 屏幕上，Canvas 物理像素 = CSS 尺寸 × devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const physicalWidth = Math.floor(cssWidth * dpr);
    const physicalHeight = Math.floor(cssHeight * dpr);
    
    // 只在尺寸真正改变时才更新
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      
      // 重要：设置 Canvas 的 CSS 样式为逻辑尺寸
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      
      console.log('Canvas CSS size:', cssWidth, 'x', cssHeight);
      console.log('Canvas physical size:', canvas.width, 'x', canvas.height);
      console.log('Device Pixel Ratio:', dpr);
    }
  };
  
  // 初始化时设置一次即可（窗口大小固定）
  resizeCanvas();

  try {
    // Cubism Core 已经在 HTML 中加载，直接验证
    if (!(window as any).Live2DCubismCore) {
      throw new Error('Cubism Core not loaded properly');
    }
    
    // 配置 Live2DModel 使用 Cubism 5 SDK
    // 注册 Cubism 5 SDK
    if ((Live2DModel as any).registerTicker) {
      (Live2DModel as any).registerTicker((window as any).PIXI.Ticker);
    }
    
    console.log('Cubism Core loaded successfully');
    
    // Create runtime
    live2dRuntime = new Live2DRuntime(canvas);
    await live2dRuntime.initialize();
    
    // Load model - hiyori_pro_zh - 专业版中文模型
    const modelPath = './live2d-models/hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json';
    console.log('Loading model:', modelPath);
    await live2dRuntime.loadModel(modelPath);
    
    // 暴露到全局供控制台调试
    (window as any).live2d = live2dRuntime;
    console.log('\n=== Live2D 控制台调试 ===');
    console.log('可用表情:', live2dRuntime.getAvailableExpressions());
    console.log('可用动作组:', Object.keys(live2dRuntime.getAvailableMotions()));
    
    // 调试：打印内部结构
    const model = (live2dRuntime as any).model;
    if (model) {
      console.log('\n=== 模型内部结构调试 ===');
      console.log('model.internalModel:', !!model.internalModel);
      if (model.internalModel) {
        console.log('settings:', !!model.internalModel.settings);
        if (model.internalModel.settings) {
          console.log('settings.expressions:', model.internalModel.settings.expressions);
          console.log('settings.motions:', model.internalModel.settings.motions);
        }
        console.log('motionManager:', !!model.internalModel.motionManager);
        if (model.internalModel.motionManager) {
          console.log('motionManager.definitions:', model.internalModel.motionManager.definitions);
          console.log('motionManager.definitions keys:', Object.keys(model.internalModel.motionManager.definitions || {}));
          console.log('expressionManager:', !!model.internalModel.motionManager.expressionManager);
          if (model.internalModel.motionManager.expressionManager) {
            console.log('expressionManager.definitions:', model.internalModel.motionManager.expressionManager.definitions);
          }
        }
      }
    }
    
    if (window.electronAPI && window.electronAPI.lipSync) {
      window.electronAPI.lipSync.onStart(() => {
        if (live2dRuntime && (live2dRuntime as any).lipSyncController) {
          const lipSync = (live2dRuntime as any).lipSyncController;
          lipSync.startVolumeMode();
        }
      });
      
      window.electronAPI.lipSync.onStop(() => {
        if (live2dRuntime && (live2dRuntime as any).lipSyncController) {
          (live2dRuntime as any).lipSyncController.stop();
        }
      });
      
      window.electronAPI.lipSync.onUpdateVolume((volume: number) => {
        if (live2dRuntime && (live2dRuntime as any).lipSyncController) {
          (live2dRuntime as any).lipSyncController.updateVolume(volume);
        }
      });
    }
    
    // 动作按钮已移除
    // motionButtons = new MotionButtons(live2dRuntime);
    // console.log('Motion buttons initialized');
    
    // 初始化控制岛
    controlIsland = new ControlIsland();
    console.log('Control Island initialized');
    
    console.log('Live2D initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Live2D:', error);
  }
}

// Start initialization
initLive2D();

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      llmChatStart: (params: any) => Promise<any>;
      llmChatAbort: (conversationId: string) => Promise<void>;
      onLlmChatChunk: (callback: (chunk: string) => void) => void;
      getLlmConfig: () => Promise<any>;
      ttsSpeak: (params: any) => Promise<void>;
      ttsStop: () => Promise<void>;
      onTtsStart: (callback: () => void) => void;
      onTtsEnd: (callback: () => void) => void;
      onTtsAudioData: (callback: (data: Float32Array) => void) => void;
      getCharacterProfile: (id: string) => Promise<any>;
      saveCharacterProfile: (profile: any) => Promise<void>;
      listCharacterProfiles: () => Promise<any[]>;
      moveWindow: (deltaX: number, deltaY: number) => Promise<void>;
      setIgnoreMouse: (ignore: boolean) => Promise<void>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      openMotionWindow: () => Promise<void>;
      playMotion: (group: string, index: number) => Promise<void>;
      playExpression: (name: string) => Promise<void>;
      getMotions: () => Promise<any>;
      getExpressions: () => Promise<any[]>;
      openSettings: () => Promise<void>;
      closeSettings: () => Promise<void>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      openChat: () => Promise<void>;
      closeChat: () => Promise<void>;
      createConversation: (title: string) => Promise<any>;
      getConversations: () => Promise<any[]>;
      getConversation: (id: string) => Promise<any>;
      updateConversationTitle: (id: string, title: string) => Promise<any>;
      deleteConversation: (id: string) => Promise<any>;
      saveMessage: (message: any) => Promise<any>;
      getMessages: (conversationId: string, limit?: number) => Promise<any[]>;
      deleteMessage: (id: string) => Promise<any>;
      getChatStats: () => Promise<any>;
      tts: {
        synthesize: (text: string) => Promise<ArrayBuffer>;
      };
      lipSync: {
        start: () => Promise<void>;
        stop: () => Promise<void>;
        updateVolume: (volume: number) => Promise<void>;
        onStart: (callback: () => void) => void;
        onStop: (callback: () => void) => void;
        onUpdateVolume: (callback: (volume: number) => void) => void;
      };
      memory: {
        generate: (conversationId: string, assistantId: string, recentMessages: any[], llmConfig: any) => Promise<any>;
        getAll: (conversationId: string, assistantId: string) => Promise<any[]>;
        getForPrompt: (conversationId: string, assistantId: string, currentContext: string, limit: number, llmConfig?: any) => Promise<any[]>;
        clear: (conversationId: string, assistantId: string) => Promise<any>;
        getStats: (conversationId: string, assistantId: string) => Promise<any>;
        merge: (conversationId: string, assistantId: string, newText: string, category: string, llmConfig: any) => Promise<any>;
      };
    };
    // 暴露 Live2D 运行时到控制台，便于调试
    live2d?: Live2DRuntime;
  }
}

export {};
