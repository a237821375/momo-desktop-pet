<template>
  <div class="tts-settings">
    <div class="form-group">
      <label>App ID</label>
      <input :value="config.appId" @input="updateConfig('appId', $event)" type="text" placeholder="请输入 App ID">
    </div>
    
    <div class="form-group">
      <label>Access Token</label>
      <input :value="config.accessToken" @input="updateConfig('accessToken', $event)" type="password" placeholder="请输入 Access Token">
    </div>

    <div class="form-group">
      <label>音色选择</label>
      <div class="custom-select-wrapper">
        <div class="select-display" @click="toggleDropdown">
          <span>{{ getVoiceLabel(config.voiceType) || '请选择音色' }}</span>
          <span class="arrow">{{ dropdownOpen ? '▲' : '▼' }}</span>
        </div>
        <div v-if="dropdownOpen" class="dropdown-menu">
          <div class="dropdown-section">
            <div class="section-title">V3 大模型音色（推荐）</div>
            <div
              v-for="voice in v3Voices"
              :key="voice.value"
              class="dropdown-item"
              :class="{ active: config.voiceType === voice.value }"
            >
              <span @click="selectVoice(voice.value)">{{ voice.label }}</span>
              <button 
                class="btn-play"
                @click.stop="testVoice(voice.value)"
                :disabled="testing === voice.value"
                :title="'试听 ' + voice.label"
              >
                {{ testing === voice.value ? '⏸' : '▶' }}
              </button>
            </div>
          </div>
          <div class="dropdown-section">
            <div class="section-title">V1 经典音色</div>
            <div
              v-for="voice in v1Voices"
              :key="voice.value"
              class="dropdown-item"
              :class="{ active: config.voiceType === voice.value }"
            >
              <span @click="selectVoice(voice.value)">{{ voice.label }}</span>
              <button 
                class="btn-play"
                @click.stop="testVoice(voice.value)"
                :disabled="testing === voice.value"
                :title="'试听 ' + voice.label"
              >
                {{ testing === voice.value ? '⏸' : '▶' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <p class="hint">选择一个音色，点击名称选中，点击▶试听。V3（2.0）使用 seed-tts-2.0，V1（1.0）使用 seed-tts-1.0</p>
    </div>
    
    <button class="btn-primary btn-save" @click="saveTtsConfig">
      💾 保存 TTS 配置
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import voicesConfig from '../config/tts-voices.json'

interface TtsConfig {
  appId: string
  accessToken: string
  voiceType: string
}

interface Props {
  config: TtsConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:config': [value: TtsConfig]
  'saveSuccess': [message: string, type?: 'success' | 'error']
}>()

const testing = ref<string | null>(null)
const dropdownOpen = ref(false)
let currentAudio: HTMLAudioElement | null = null

// 从配置文件读取音色列表
const v3Voices = voicesConfig.v3Voices
const v1Voices = voicesConfig.v1Voices

function getResourceId(voiceType: string): string {
  // V3 大模型音色（2.0）使用 seed-tts-2.0
  // 目前只有 uranus_bigtts 系列是 2.0
  const v3Voices = [
    'zh_female_vv_uranus_bigtts',
    'zh_female_xiaohe_uranus_bigtts',
    'zh_male_m191_uranus_bigtts',
    'zh_male_taocheng_uranus_bigtts'
  ];
  
  if (v3Voices.includes(voiceType)) {
    return 'seed-tts-2.0';
  }
  
  // 其他所有音色（包括 _mars_bigtts, _moon_bigtts, _emo_* 等）都使用 1.0
  return 'seed-tts-1.0';
}

function updateConfig(field: keyof TtsConfig, event: any) {
  const value = event.target ? event.target.value : event
  emit('update:config', { ...props.config, [field]: value })
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function selectVoice(voiceType: string) {
  emit('update:config', { ...props.config, voiceType })
  dropdownOpen.value = false
}

function getVoiceLabel(voiceType: string): string {
  const allVoices = [...v3Voices, ...v1Voices]
  const voice = allVoices.find(v => v.value === voiceType)
  return voice ? voice.label : ''
}

async function testVoice(voiceType: string) {
  const appId = props.config.appId.trim()
  const accessToken = props.config.accessToken.trim()
  
  if (!appId || !accessToken) {
    emit('saveSuccess', '请先配置 App ID 和 Access Token', 'error')
    return
  }
  
  testing.value = voiceType
  
  try {
    // 停止当前播放
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    
    const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      method: 'POST',
      headers: {
        'X-Api-App-Id': appId,
        'X-Api-Access-Key': accessToken,
        'X-Api-Resource-Id': getResourceId(voiceType),
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify({
        user: { uid: 'preview_user' },
        req_params: {
          text: '你好呀，我是 momo。爱你哟',
          speaker: voiceType,
          audio_params: {
            format: 'mp3',
            sample_rate: 24000,
          },
          additions: JSON.stringify({
            explicit_language: 'zh',
            disable_markdown_filter: true,
          }),
        },
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    // 读取流式响应
    const audioChunks: Uint8Array[] = []
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.trim()) continue
        
        try {
          const data = JSON.parse(line)
          if (data.code === 0 && data.data) {
            const audioBuffer = Uint8Array.from(atob(data.data), c => c.charCodeAt(0))
            audioChunks.push(audioBuffer)
          }
          if (data.code === 20000000) break
          if (data.code > 0 && data.code !== 20000000) {
            throw new Error(`TTS Error (${data.code}): ${data.message || 'Unknown error'}`)
          }
        } catch (e: any) {
          if (e.message.includes('TTS Error')) throw e
        }
      }
    }
    
    if (audioChunks.length === 0) {
      throw new Error('未收到音频数据')
    }
    
    // 合并音频
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of audioChunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    
    // 播放音频
    const blob = new Blob([merged], { type: 'audio/mp3' })
    const url = URL.createObjectURL(blob)
    currentAudio = new Audio(url)
    currentAudio.play()
  } catch (error: any) {
    console.error('试听失败:', error)
    emit('saveSuccess', '试听失败: ' + (error?.message || String(error)), 'error')
  } finally {
    testing.value = null
  }
}

async function saveTtsConfig() {
  if (!props.config.appId || !props.config.accessToken) {
    emit('saveSuccess', '请填写 App ID 和 Access Token', 'error')
    return
  }
  
  try {
    // 复制配置并自动添加 resourceId
    const configToSave = JSON.parse(JSON.stringify(props.config))
    const resourceId = getResourceId(configToSave.voiceType)
    configToSave.resourceId = resourceId
    
    console.log('========== TTS 保存配置调试 ==========')
    console.log('[TTS 保存] 原始配置:', props.config)
    console.log('[TTS 保存] 音色类型:', configToSave.voiceType)
    console.log('[TTS 保存] 自动生成的 resourceId:', resourceId)
    console.log('[TTS 保存] 最终保存的配置:', configToSave)
    console.log('======================================')
    
    const settings = {
      tts: configToSave
    }
    
    await (window as any).electronAPI.saveSettings(settings)
    emit('saveSuccess', 'TTS 配置已保存！', 'success')
  } catch (error: any) {
    console.error('[TTS 保存] 保存失败:', error)
    emit('saveSuccess', '保存失败: ' + error.message, 'error')
  }
}

// 点击外部关闭下拉框
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.custom-select-wrapper')) {
    dropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tts-settings {
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.voice-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 10px 0;
}

.voice-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.voice-item {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 6px;
  transition: all 0.2s;
}

.voice-item:hover {
  background: rgba(102, 126, 234, 0.1);
  border-color: rgba(102, 126, 234, 0.2);
}

.voice-item input[type="radio"] {
  margin-right: 10px;
  cursor: pointer;
  width: auto;
}

/* 自定义下拉框样式 */
.custom-select-wrapper {
  position: relative;
  width: 100%;
}

.select-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.8);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.select-display:hover {
  border-color: #667eea;
}

.select-display .arrow {
  color: #667eea;
  font-size: 12px;
  transition: transform 0.2s;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  background: white;
  border: 1px solid rgba(148, 163, 184, 0.8);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  z-index: 1000;
}

.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.5);
  border-radius: 999px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.7);
}

.dropdown-section {
  padding: 8px 0;
}

.dropdown-section:not(:last-child) {
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.section-title {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 14px;
  gap: 8px;
}

.dropdown-item:hover {
  background: rgba(102, 126, 234, 0.08);
}

.dropdown-item.active {
  background: rgba(102, 126, 234, 0.12);
  font-weight: 500;
}

.dropdown-item > span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-play {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-play:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.btn-play:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.voice-select-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.voice-select-row select {
  flex: 1;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.8);
  font-size: 14px;
}

.voice-select-row select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.btn-voice-test {
  padding: 6px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-voice-test:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transform: translateY(-1px);
}

.btn-voice-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 12px;
  color: rgba(102, 126, 234, 0.8);
  margin-top: 8px;
}

.btn-save {
  width: 100%;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 20px;
}

.btn-save:hover {
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  transform: translateY(-2px);
}

.voice-list::-webkit-scrollbar {
  width: 6px;
}

.voice-list::-webkit-scrollbar-track {
  background: transparent;
}

.voice-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.8);
  border-radius: 999px;
}

.voice-list::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.95);
}
</style>
