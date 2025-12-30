/**
 * Default Character Profile
 * 
 * 基于 Haru 模型的默认配置
 */

export const DEFAULT_PROFILE = {
  name: 'Haru',
  live2d: {
    modelPath: '../../live2D/mode/Haru/Haru.model3.json',
    scale: 1.0,
    position: { x: 0, y: 0 },
    opacity: 1.0,
    alwaysOnTop: true,
  },
  llm: {
    provider: 'qwen' as const,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyRef: 'llm_api_key_haru',
    model: 'qwen-plus',
    temperature: 0.7,
  },
  tts: {
    provider: 'volcengine' as const,
    apiKeyRef: 'tts_api_key_haru',
    appId: '',
    voiceType: 'BV700_V2_streaming',
    speed: 1.0,
    volume: 1.0,
  },
};
