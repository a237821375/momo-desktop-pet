import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload Script
 * 
 * 安全地暴露 IPC API 给渲染进程
 */

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Basic
  ping: () => ipcRenderer.invoke('ping'),

  // LLM
  llmChatStart: (params: any) => ipcRenderer.invoke('llm.chat.start', params),
  llmChatAbort: (conversationId: string) => ipcRenderer.invoke('llm.chat.abort', conversationId),
  onLlmChatChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('llm.chat.chunk', (_event, chunk) => callback(chunk));
  },
  getLlmConfig: () => ipcRenderer.invoke('llm:getConfig'),

  // TTS
  ttsSpeak: (params: any) => ipcRenderer.invoke('tts.speak', params),
  ttsStop: () => ipcRenderer.invoke('tts.stop'),
  onTtsStart: (callback: () => void) => {
    ipcRenderer.on('tts.start', () => callback());
  },
  onTtsEnd: (callback: () => void) => {
    ipcRenderer.on('tts.end', () => callback());
  },
  onTtsAudioData: (callback: (data: Float32Array) => void) => {
    ipcRenderer.on('tts.audioData', (_event, data) => callback(data));
  },

  // Configuration
  getCharacterProfile: (id: string) => ipcRenderer.invoke('config.getProfile', id),
  saveCharacterProfile: (profile: any) => ipcRenderer.invoke('config.saveProfile', profile),
  listCharacterProfiles: () => ipcRenderer.invoke('config.listProfiles'),

  // Window control
  moveWindow: (deltaX: number, deltaY: number) => 
    ipcRenderer.invoke('window:move', deltaX, deltaY),
  setIgnoreMouse: (ignore: boolean) => 
    ipcRenderer.invoke('window:set-ignore-mouse', ignore),
  minimizeWindow: () => 
    ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => 
    ipcRenderer.invoke('window:maximize'),
  closeWindow: () => 
    ipcRenderer.invoke('window:close'),
  
  // Motion window
  openMotionWindow: () => ipcRenderer.invoke('motion:open'),
  
  // Live2D control
  playMotion: (group: string, index: number) => ipcRenderer.invoke('live2d:playMotion', group, index),
  playExpression: (name: string) => ipcRenderer.invoke('live2d:playExpression', name),
  getMotions: () => ipcRenderer.invoke('live2d:getMotions'),
  getExpressions: () => ipcRenderer.invoke('live2d:getExpressions'),
  
  // Settings
  openSettings: () => ipcRenderer.invoke('settings:open'),
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // Chat
  openChat: () => ipcRenderer.invoke('chat:open'),
  closeChat: () => ipcRenderer.invoke('chat:close'),
  
  // Chat History Storage
  createConversation: (title: string) => ipcRenderer.invoke('chat:createConversation', title),
  getConversations: () => ipcRenderer.invoke('chat:getConversations'),
  getConversation: (id: string) => ipcRenderer.invoke('chat:getConversation', id),
  updateConversationTitle: (id: string, title: string) => ipcRenderer.invoke('chat:updateConversationTitle', id, title),
  deleteConversation: (id: string) => ipcRenderer.invoke('chat:deleteConversation', id),
  saveMessage: (message: any) => ipcRenderer.invoke('chat:saveMessage', message),
  getMessages: (conversationId: string, limit?: number) => ipcRenderer.invoke('chat:getMessages', conversationId, limit),
  deleteMessage: (id: string) => ipcRenderer.invoke('chat:deleteMessage', id),
  getChatStats: () => ipcRenderer.invoke('chat:getStats'),
  
  // TTS
  tts: {
    synthesize: (text: string) => ipcRenderer.invoke('tts:synthesize', text),
  },
  
  // LipSync
  lipSync: {
    start: () => ipcRenderer.invoke('lipsync:start'),
    stop: () => ipcRenderer.invoke('lipsync:stop'),
    updateVolume: (volume: number) => ipcRenderer.invoke('lipsync:updateVolume', volume),
    onStart: (callback: () => void) => {
      ipcRenderer.on('lipsync:start', () => callback());
    },
    onStop: (callback: () => void) => {
      ipcRenderer.on('lipsync:stop', () => callback());
    },
    onUpdateVolume: (callback: (volume: number) => void) => {
      ipcRenderer.on('lipsync:updateVolume', (_event, volume) => callback(volume));
    },
  },
  
  // Long-term Memory
  memory: {
    generate: (conversationId: string, assistantId: string, recentMessages: any[], llmConfig: any) => 
      ipcRenderer.invoke('memory:generate', conversationId, assistantId, recentMessages, llmConfig),
    getAll: (conversationId: string, assistantId: string) => 
      ipcRenderer.invoke('memory:getAll', conversationId, assistantId),
    getForPrompt: (conversationId: string, assistantId: string, currentContext: string, limit: number, llmConfig?: any) => 
      ipcRenderer.invoke('memory:getForPrompt', conversationId, assistantId, currentContext, limit, llmConfig),
    clear: (conversationId: string, assistantId: string) => 
      ipcRenderer.invoke('memory:clear', conversationId, assistantId),
    getStats: (conversationId: string, assistantId: string) => 
      ipcRenderer.invoke('memory:getStats', conversationId, assistantId),
    merge: (conversationId: string, assistantId: string, newText: string, category: string, llmConfig: any) => 
      ipcRenderer.invoke('memory:merge', conversationId, assistantId, newText, category, llmConfig),
  },
});
