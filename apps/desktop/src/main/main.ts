import { app, BrowserWindow, ipcMain, Tray, Menu, screen } from 'electron';
import { join } from 'path';
import Store from 'electron-store';

let mainWindow: BrowserWindow | null = null;
let motionWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 初始化配置存储
const store = new Store({
  name: 'window-state',
  defaults: {
    windowPosition: { x: undefined, y: undefined }
  }
});

function createWindow() {
  // 读取上次保存的位置
  const savedPosition = store.get('windowPosition') as { x?: number; y?: number };
  
  // 验证位置是否在屏幕范围内
  let x: number | undefined = savedPosition.x;
  let y: number | undefined = savedPosition.y;
  
  if (x !== undefined && y !== undefined) {
    const displays = screen.getAllDisplays();
    const isOnScreen = displays.some(display => {
      const { x: dx, y: dy, width, height } = display.bounds;
      return x! >= dx && x! < dx + width && y! >= dy && y! < dy + height;
    });
    
    // 如果位置不在屏幕范围内，重置为 undefined
    if (!isOnScreen) {
      x = undefined;
      y = undefined;
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 338,
    height: 500,
    x,  // 使用保存的位置，如果没有则由 Electron 自动居中
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load renderer
  // 统一使用构建后的文件，避免开发/生产环境不一致
  const rendererPath = app.isPackaged
    ? join(__dirname, '../renderer/index.html')
    : join(__dirname, '../renderer/index.html'); // 开发时也用构建后的文件
  
  mainWindow.loadFile(rendererPath);
  
  // 开发模式下打开 DevTools
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 保存窗口位置 - 当窗口移动时
  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    store.set('windowPosition', { x, y });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // 创建系统托盘
  createTray();
}

function createTray() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../assets/icon.png'); // dist/main -> desktop/assets
  
  try {
    tray = new Tray(iconPath);
    console.log('✅ 托盘图标加载成功:', iconPath);
  } catch (error) {
    console.warn('⚠️ 托盘图标加载失败，使用空图标:', error);
    const { nativeImage } = require('electron');
    const emptyIcon = nativeImage.createEmpty();
    tray = new Tray(emptyIcon);
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '位置重置',
      click: () => {
        if (mainWindow) {
          // 重置到屏幕中心
          mainWindow.center();
          const [x, y] = mainWindow.getPosition();
          store.set('windowPosition', { x, y });
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Desktop Pet AI');
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示/隐藏窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

app.whenReady().then(async () => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers placeholder
ipcMain.handle('ping', () => 'pong');

// 创建动作/表情窗口
ipcMain.handle('motion:open', async () => {
  if (motionWindow) {
    motionWindow.focus();
    return;
  }
  
  motionWindow = new BrowserWindow({
    width: 600,
    height: 700,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '动作 & 表情控制',
  });
  
  // 加载动作窗口页面
  const motionHtmlPath = app.isPackaged
    ? join(__dirname, '../renderer/motion.html')
    : join(__dirname, '../renderer/motion.html');
  
  motionWindow.loadFile(motionHtmlPath);
  
  // 开发模式下打开 DevTools
  if (!app.isPackaged) {
    motionWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  motionWindow.on('closed', () => {
    motionWindow = null;
  });
});

// 执行动作
ipcMain.handle('live2d:playMotion', async (event, group: string, index: number) => {
  if (mainWindow) {
    console.log(`[Main] Executing motion: ${group}[${index}]`);
    mainWindow.webContents.executeJavaScript(`
      if (window.live2d) {
        window.live2d.playMotion("${group}", ${index});
        console.log('Motion executed: ${group}[${index}]');
      } else {
        console.error('window.live2d not available');
      }
    `);
  }
});

// 执行表情
ipcMain.handle('live2d:playExpression', async (event, name: string) => {
  if (mainWindow) {
    console.log(`[Main] Executing expression: ${name}`);
    mainWindow.webContents.executeJavaScript(`
      if (window.live2d) {
        window.live2d.playExpression("${name}");
        console.log('Expression executed: ${name}');
      } else {
        console.error('window.live2d not available');
      }
    `);
  }
});

// 获取模型动作列表
ipcMain.handle('live2d:getMotions', async () => {
  if (mainWindow) {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (function() {
          console.log('[Main Window] 检查 window.live2d:', !!window.live2d);
          if (window.live2d) {
            const motions = window.live2d.getAvailableMotions();
            console.log('[Main Window] 获取到的动作:', motions);
            return motions;
          }
          return {};
        })()
      `);
      console.log('[IPC] 返回动作数据:', result);
      return result;
    } catch (error) {
      console.error('[IPC] 获取动作失败:', error);
      return {};
    }
  }
  return {};
});

// 获取模型表情列表
ipcMain.handle('live2d:getExpressions', async () => {
  if (mainWindow) {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (function() {
          console.log('[Main Window] 检查 window.live2d:', !!window.live2d);
          if (window.live2d) {
            const expressions = window.live2d.getAvailableExpressions();
            console.log('[Main Window] 获取到的表情:', expressions);
            return expressions;
          }
          return [];
        })()
      `);
      console.log('[IPC] 返回表情数据:', result);
      return result;
    } catch (error) {
      console.error('[IPC] 获取表情失败:', error);
      return [];
    }
  }
  return [];
});

// Window control handlers
ipcMain.handle('window:move', async (event, deltaX: number, deltaY: number) => {
  if (!mainWindow) return;
  
  const [currentX, currentY] = mainWindow.getPosition();
  mainWindow.setPosition(
    Math.round(currentX + deltaX),
    Math.round(currentY + deltaY)
  );
});

// 点击穿透控制
ipcMain.handle('window:set-ignore-mouse', async (event, ignore: boolean) => {
  if (!mainWindow) return;
  
  mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  console.log('点击穿透:', ignore ? '开启' : '关闭');
});

// 通用窗口最小化
ipcMain.handle('window:minimize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

// 通用窗口最大化/还原
ipcMain.handle('window:maximize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

// 通用窗口关闭
ipcMain.handle('window:close', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});

// ========== 设置窗口 IPC 处理器 ==========

// 打开设置窗口
ipcMain.handle('settings:open', async () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 700,
    height: 800,
    frame: false,  // 去掉默认框架
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    backgroundColor: '#1e3c72',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '设置 - Desktop Pet AI',
  });
  
  const settingsHtmlPath = app.isPackaged
    ? join(__dirname, '../renderer/settings.html')
    : join(__dirname, '../renderer/settings.html');
  
  settingsWindow.loadFile(settingsHtmlPath);
  
  if (!app.isPackaged) {
    settingsWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
});

// 关闭设置窗口
ipcMain.handle('settings:close', async () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

// ========== 聊天窗口 IPC 处理器 ==========

// 打开聊天窗口
ipcMain.handle('chat:open', async () => {
  if (chatWindow) {
    chatWindow.focus();
    return;
  }
  
  chatWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '聊天 - Momo',
  });
  
  const chatHtmlPath = app.isPackaged
    ? join(__dirname, '../renderer/chat-window.html')
    : join(__dirname, '../renderer/chat-window.html');
  
  chatWindow.loadFile(chatHtmlPath);
  
  if (!app.isPackaged) {
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  chatWindow.on('closed', () => {
    chatWindow = null;
  });
});

// 关闭聊天窗口
ipcMain.handle('chat:close', async () => {
  if (chatWindow) {
    chatWindow.close();
  }
});

// 获取设置
ipcMain.handle('settings:get', async () => {
  const { getSecureStorage } = require('./storage/secure-storage');
  const storage = getSecureStorage();
  
  // 获取 LLM 配置
  const qwenApiKey = await storage.getApiKey('llm_qwen');
  const qwenModels = storage.getConfig('qwen_models', []);
  const openrouterApiKey = await storage.getApiKey('llm_openrouter');
  const openrouterModels = storage.getConfig('openrouter_models', []);
  const currentModel = storage.getConfig('current_model', '');
  
  // 获取 TTS 配置
  const ttsConfig = storage.getConfig('tts_config', {
    appId: '',
    voiceType: 'BV700_V2_streaming'
  });
  
  // 获取 TTS 认证信息
  const ttsAccessToken = await storage.getApiKey('tts_access_token');
  const ttsSecretKey = await storage.getApiKey('tts_secret_key');
  
  return {
    qwenApiKey,
    qwenModels,
    openrouterApiKey,
    openrouterModels,
    currentModel,
    tts: {
      ...ttsConfig,
      accessToken: ttsAccessToken || '',
      secretKey: ttsSecretKey || ''
    }
  };
});

// 保存设置
ipcMain.handle('settings:save', async (event, settings: any) => {
  const { getSecureStorage } = require('./storage/secure-storage');
  const storage = getSecureStorage();
  
  // 保存千问配置
  if (settings.qwenApiKey !== undefined) {
    await storage.setApiKey('llm_qwen', settings.qwenApiKey);
  }
  if (settings.qwenModels !== undefined) {
    storage.setConfig('qwen_models', settings.qwenModels);
  }
  
  // 保存 OpenRouter 配置
  if (settings.openrouterApiKey !== undefined) {
    await storage.setApiKey('llm_openrouter', settings.openrouterApiKey);
  }
  if (settings.openrouterModels !== undefined) {
    storage.setConfig('openrouter_models', settings.openrouterModels);
  }
  
  // 保存当前模型
  if (settings.currentModel !== undefined) {
    storage.setConfig('current_model', settings.currentModel);
  }
  
  // 保存 TTS 配置
  if (settings.tts !== undefined) {
    const existingTtsConfig = storage.getConfig('tts_config', {
      appId: '',
      voiceType: 'BV700_V2_streaming'
    });

    storage.setConfig('tts_config', {
      appId: settings.tts?.appId ?? existingTtsConfig.appId ?? '',
      voiceType: settings.tts?.voiceType ?? existingTtsConfig.voiceType ?? 'BV700_V2_streaming',
      resourceId: settings.tts?.resourceId ?? existingTtsConfig.resourceId  // 新增：保存 resourceId
    });
  
    // 保存 TTS 认证信息（加密存储）
    if (settings.tts?.accessToken) {
      await storage.setApiKey('tts_access_token', settings.tts.accessToken);
    }
    if (settings.tts?.secretKey) {
      await storage.setApiKey('tts_secret_key', settings.tts.secretKey);
    }
  }
  
  return { success: true };
});

// 获取当前 LLM 配置（用于聊天）
ipcMain.handle('llm:getConfig', async () => {
  const { getSecureStorage } = require('./storage/secure-storage');
  const storage = getSecureStorage();
  
  const currentModel = storage.getConfig('current_model', '');
  
  if (!currentModel) {
    throw new Error('未配置模型，请先在设置中选择模型');
  }
  
  // 解析 provider:modelId
  const [provider, modelId] = currentModel.split(':');
  
  if (!provider || !modelId) {
    throw new Error('模型格式错误');
  }
  
  // 获取对应的 API Key
  let apiKey: string | null = null;
  let endpoint = '';
  
  if (provider === 'qwen') {
    apiKey = await storage.getApiKey('llm_qwen');
    endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  } else if (provider === 'openrouter') {
    apiKey = await storage.getApiKey('llm_openrouter');
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  } else {
    throw new Error(`未知的模型提供商: ${provider}`);
  }
  
  if (!apiKey) {
    throw new Error(`${provider} API Key 未配置`);
  }
  
  return {
    provider,
    modelId,
    apiKey,
    endpoint,
    fullModelName: currentModel
  };
});

// ========== 聊天历史存储 IPC 处理器 ==========

// 创建新对话
ipcMain.handle('chat:createConversation', async (_, title: string) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.createConversation(title);
});

// 获取所有对话列表
ipcMain.handle('chat:getConversations', async () => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.getConversations();
});

// 获取单个对话
ipcMain.handle('chat:getConversation', async (_, id: string) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.getConversation(id);
});

// 更新对话标题
ipcMain.handle('chat:updateConversationTitle', async (_, id: string, title: string) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  storage.updateConversationTitle(id, title);
  return { success: true };
});

// 删除对话
ipcMain.handle('chat:deleteConversation', async (_, id: string) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  storage.deleteConversation(id);
  return { success: true };
});

// 保存消息
ipcMain.handle('chat:saveMessage', async (_, message: any) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.saveMessage(message);
});

// 获取对话的所有消息
ipcMain.handle('chat:getMessages', async (_, conversationId: string, limit?: number) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.getMessages(conversationId, limit);
});

// 删除消息
ipcMain.handle('chat:deleteMessage', async (_, id: string) => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  storage.deleteMessage(id);
  return { success: true };
});

// 获取统计信息
ipcMain.handle('chat:getStats', async () => {
  const { getChatStorage } = require('./storage/chat-storage');
  const storage = getChatStorage();
  return storage.getStats();
});

// ========== TTS IPC 处理器 ==========

// TTS 语音合成
ipcMain.handle('tts:synthesize', async (_, text: string) => {
  const { getSecureStorage } = require('./storage/secure-storage');
  const storage = getSecureStorage();
  
  // 获取 TTS 配置
  const ttsConfig = storage.getConfig('tts_config', {
    appId: '',
    voiceType: 'BV700_V2_streaming'
  });
  
  const accessToken = await storage.getApiKey('tts_access_token');
  
  console.log('========== TTS 配置调试 ==========')
  console.log('[TTS] All config:', JSON.stringify(storage.getAllConfig(), null, 2));  // 打印所有配置
  console.log('[TTS] ttsConfig 原始值:', JSON.stringify(ttsConfig, null, 2));
  console.log('[TTS] accessToken 长度:', accessToken ? accessToken.length : 0);
  console.log('[TTS] ttsConfig.appId:', ttsConfig.appId);
  console.log('[TTS] ttsConfig.voiceType:', ttsConfig.voiceType);
  console.log('[TTS] ttsConfig.resourceId:', ttsConfig.resourceId);
  console.log('[TTS] resourceId 类型:', typeof ttsConfig.resourceId);
  console.log('[TTS] resourceId 是否为空字符串:', ttsConfig.resourceId === '');
  console.log('====================================')
  
  if (!accessToken || !ttsConfig.appId) {
    throw new Error('请先在设置中配置 TTS 服务');
  }
  
  try {
    const { VolcengineTTSV3Provider } = require('./providers/tts/volcengine-tts-v3');
    
    // 构建 Provider 配置
    const providerConfig: any = {
      provider: 'volcengine-v3',
      appId: ttsConfig.appId,
      accessToken: accessToken,
      voiceType: ttsConfig.voiceType || 'BV700_V2_streaming',
      speed: 1.0,
      volume: 1.0,
      format: 'mp3'
    };
    
    // 只有当 resourceId 存在且不为空时才传递
    if (ttsConfig.resourceId && ttsConfig.resourceId.trim()) {
      providerConfig.resourceId = ttsConfig.resourceId.trim();
    }
    
    console.log('[TTS] Provider 配置:', providerConfig);
    const ttsProvider = new VolcengineTTSV3Provider(providerConfig);
    
    console.log('[TTS] 开始合成:', text.substring(0, 50));
    const audioBuffer = await ttsProvider.speak({ text });
    console.log('[TTS] 合成完成:', audioBuffer.byteLength, 'bytes');
    
    return audioBuffer;
  } catch (error) {
    console.error('[TTS] 合成失败:', error);
    throw error;
  }
});

// LipSync 控制 - 转发到主窗口
ipcMain.handle('lipsync:start', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('lipsync:start');
  }
});

ipcMain.handle('lipsync:stop', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('lipsync:stop');
  }
});

// LipSync 音量数据转发
ipcMain.handle('lipsync:updateVolume', async (event, volume: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('lipsync:updateVolume', volume);
  }
});

// ========== 长期记忆 IPC 处理器 ==========

// 生成并保存长期记忆
ipcMain.handle('memory:generate', async (_, conversationId: string, assistantId: string, recentMessages: any[], llmConfig: any) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  
  try {
    console.log('[Memory IPC] 开始生成记忆, conversationId:', conversationId, 'assistantId:', assistantId, '消息数:', recentMessages.length);
    
    // 生成候选记忆
    const candidates = await manager.generateCandidateMemories(conversationId, assistantId, recentMessages, llmConfig);
    
    // 筛选并保存重要记忆（使用配置阈值）
    const saved = await manager.filterAndSaveMemories(conversationId, assistantId, candidates);
    
    return { success: true, saved: saved.length, candidates: candidates.length };
  } catch (error: any) {
    console.error('[Memory IPC] 生成记忆失败:', error);
    return { 
      success: false, 
      error: String(error),
      details: error.message || error.toString() // 🔥 返回详细错误信息
    };
  }
});

// 获取所有长期记忆
ipcMain.handle('memory:getAll', async (_, conversationId: string, assistantId: string) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  return manager.getAllMemories(conversationId, assistantId);
});

// 获取用于注入系统提示词的记忆
ipcMain.handle('memory:getForPrompt', async (_, conversationId: string, assistantId: string, currentContext: string, limit: number, llmConfig?: any) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  return manager.getRelevantMemoriesForPrompt(conversationId, assistantId, currentContext, limit, llmConfig);
});

// 清空长期记忆
ipcMain.handle('memory:clear', async (_, conversationId: string, assistantId: string) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  manager.clearMemories(conversationId, assistantId);
  return { success: true };
});

// 获取记忆统计
ipcMain.handle('memory:getStats', async (_, conversationId: string, assistantId: string) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  return manager.getMemoryStats(conversationId, assistantId);
});

// 合并或更新记忆
ipcMain.handle('memory:merge', async (_, conversationId: string, assistantId: string, newText: string, category: string, llmConfig: any) => {
  const { getMemoryManager } = require('./storage/memory-manager');
  const manager = getMemoryManager();
  
  try {
    await manager.mergeOrUpdateMemory(conversationId, assistantId, newText, category as any, llmConfig);
    return { success: true };
  } catch (error) {
    console.error('[Memory IPC] 合并记忆失败:', error);
    return { success: false, error: String(error) };
  }
});
