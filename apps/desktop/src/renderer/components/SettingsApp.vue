<template>
  <div class="app-wrapper">
    <!-- 自定义标题栏 -->
    <div class="title-bar">
      <div class="title-bar-drag">
        <span class="title-icon">⚙️</span>
        <span class="title-text">设置</span>
      </div>
      <div class="title-bar-controls">
        <button class="title-bar-button" @click="minimizeWindow" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="5" width="12" height="2" fill="currentColor"/>
          </svg>
        </button>
        <button class="title-bar-button" @click="maximizeWindow" title="最大化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
        </button>
        <button class="title-bar-button close-button" @click="closeWindow" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="container">
      <h1>⚙️ 设置</h1>

    <!-- Tab 导航 -->
    <div class="tabs">
      <button 
        class="tab" 
        :class="{ active: activeTab === 'llm' }"
        @click="activeTab = 'llm'"
      >
        🤖 LLM 设置
      </button>
      <button 
        class="tab" 
        :class="{ active: activeTab === 'tts' }"
        @click="activeTab = 'tts'"
      >
        🔊 TTS 设置
      </button>
    </div>

    <!-- LLM Tab -->
    <div v-show="activeTab === 'llm'" class="tab-content active">
      <LlmSettings 
        v-model:providers="providers"
        v-model:currentModel="currentModel"
        @save-success="showToast"
      />
    </div>

    <!-- TTS Tab -->
    <div v-show="activeTab === 'tts'" class="tab-content active">
      <TtsSettings 
        v-model:config="ttsConfig"
        @save-success="showToast"
      />
    </div>

    <!-- Toast 提示 -->
    <Transition name="toast">
      <div v-if="toast.show" class="status" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LlmSettings from './LlmSettings.vue'
import TtsSettings from './TtsSettings.vue'

interface ProviderConfig {
  apiKey: string
  models: any[]
}

interface Providers {
  qwen: ProviderConfig
  openrouter: ProviderConfig
}

interface TtsConfig {
  appId: string
  accessToken: string
  voiceType: string
}

const activeTab = ref<'llm' | 'tts'>('llm')
const currentModel = ref('')
const providers = ref<Providers>({
  qwen: { apiKey: '', models: [] },
  openrouter: { apiKey: '', models: [] }
})
const ttsConfig = ref<TtsConfig>({
  appId: '',
  accessToken: '',
  voiceType: 'zh_female_cancan_mars_bigtts'
})

const toast = ref({
  show: false,
  message: '',
  type: 'success'
})

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// 加载设置
onMounted(async () => {
  try {
    const settings = await (window as any).electronAPI.getSettings()
    
    if (settings.qwenApiKey) {
      providers.value.qwen.apiKey = settings.qwenApiKey
    }
    if (settings.qwenModels) {
      providers.value.qwen.models = settings.qwenModels
    }
    if (settings.openrouterApiKey) {
      providers.value.openrouter.apiKey = settings.openrouterApiKey
    }
    if (settings.openrouterModels) {
      providers.value.openrouter.models = settings.openrouterModels
    }
    if (settings.currentModel) {
      currentModel.value = settings.currentModel
    }
    if (settings.tts) {
      ttsConfig.value = { ...ttsConfig.value, ...settings.tts }
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
})

// 窗口控制
function minimizeWindow() {
  // @ts-ignore
  window.electronAPI?.minimizeWindow?.()
}

function maximizeWindow() {
  // @ts-ignore
  window.electronAPI?.maximizeWindow?.()
}

function closeWindow() {
  // @ts-ignore
  window.electronAPI?.closeWindow?.()
}
</script>

<style scoped>
.app-wrapper {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 自定义标题栏 */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
}

.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  -webkit-app-region: drag;  /* 可拖动区域 */
}

.title-icon {
  font-size: 14px;
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.title-bar-controls {
  display: flex;
  -webkit-app-region: no-drag;  /* 按钮不可拖动 */
}

.title-bar-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-bar-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.title-bar-button.close-button:hover {
  background: #e81123;
  color: white;
}

.container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  color: #111827;
}

.container > div:first-child {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 32px;
  color: #333;
  margin-bottom: 30px;
  text-align: center;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.tab {
  padding: 12px 24px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border-bottom: 3px solid transparent;
  position: relative;
  bottom: -2px;
}

.tab:hover {
  color: #ffffff;
}

.tab.active {
  color: #ffffff;
  border-bottom-color: #ffffff;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  z-index: 10000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  min-width: 200px;
  text-align: center;
}

.status.success {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.status.error {
  background: linear-gradient(135deg, #f44336 0%, #e53935 100%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.container::-webkit-scrollbar {
  width: 8px;
}

.container::-webkit-scrollbar-track {
  background: transparent;
}

.container::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.3);
  border-radius: 999px;
}

.container::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 23, 42, 0.45);
}
</style>
