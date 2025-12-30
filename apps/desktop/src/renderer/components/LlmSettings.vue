<template>
  <div class="llm-settings">
    <div class="subsection">
      <h3 class="subsection-title">模型提供商配置</h3>
      
      <!-- 千问 -->
      <div class="provider-config">
        <div class="provider-header">
          <span class="provider-icon">💬</span>
          <span class="provider-name">通义千问</span>
          <span class="status-badge" :class="{ configured: providers.qwen.models.length > 0 }">
            {{ providers.qwen.models.length > 0 ? `已配置 (${providers.qwen.models.length} 个模型)` : '未配置' }}
          </span>
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input 
            :value="providers.qwen.apiKey" 
            @input="updateProviderKey('qwen', $event)"
            type="password" 
            placeholder="请输入千问 API Key"
          >
        </div>
        <div class="button-row">
          <button class="btn-small btn-primary" @click="saveProvider('qwen')">💾 保存</button>
          <button class="btn-small" @click="refreshModels('qwen')">🔄 刷新模型</button>
        </div>
        <p v-if="qwenHint" class="hint" :style="{ color: qwenHintColor }">{{ qwenHint }}</p>
      </div>

      <!-- OpenRouter -->
      <div class="provider-config">
        <div class="provider-header">
          <span class="provider-icon">🌐</span>
          <span class="provider-name">OpenRouter</span>
          <span class="status-badge" :class="{ configured: providers.openrouter.models.length > 0 }">
            {{ providers.openrouter.models.length > 0 ? `已配置 (${providers.openrouter.models.length} 个模型)` : '未配置' }}
          </span>
        </div>
        <div class="form-group">
          <label>API Key</label>
          <input 
            :value="providers.openrouter.apiKey" 
            @input="updateProviderKey('openrouter', $event)"
            type="password" 
            placeholder="请输入 OpenRouter API Key"
          >
        </div>
        <div class="button-row">
          <button class="btn-small btn-primary" @click="saveProvider('openrouter')">💾 保存</button>
          <button class="btn-small" @click="refreshModels('openrouter')">🔄 刷新模型</button>
        </div>
        <p v-if="openrouterHint" class="hint" :style="{ color: openrouterHintColor }">{{ openrouterHint }}</p>
      </div>
    </div>

    <div class="subsection">
      <h3 class="subsection-title">当前使用的模型</h3>
      <div class="form-group">
        <label>选择模型</label>
        <select :value="currentModel" @change="onModelChange">
          <option value="">-- 请先配置并刷新模型 --</option>
          <optgroup v-if="providers.qwen.models.length > 0" label="通义千问">
            <option 
              v-for="model in providers.qwen.models" 
              :key="model.id" 
              :value="`qwen:${model.id}`"
            >
              {{ model.id }}
            </option>
          </optgroup>
          <optgroup v-if="providers.openrouter.models.length > 0" label="OpenRouter">
            <option 
              v-for="model in providers.openrouter.models" 
              :key="model.id" 
              :value="`openrouter:${model.id}`"
            >
              {{ model.id }}
            </option>
          </optgroup>
        </select>
        <p v-if="modelHint" class="hint" :style="{ color: modelHintColor }">{{ modelHint }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ProviderConfig {
  apiKey: string
  models: any[]
}

interface Props {
  providers: {
    qwen: ProviderConfig
    openrouter: ProviderConfig
  }
  currentModel: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:providers': [value: typeof props.providers]
  'update:currentModel': [value: string]
  'saveSuccess': [message: string, type?: 'success' | 'error']
}>()

const qwenHint = ref('')
const qwenHintColor = ref('')
const openrouterHint = ref('')
const openrouterHintColor = ref('')
const modelHint = ref('')
const modelHintColor = ref('')

function updateProviderKey(provider: 'qwen' | 'openrouter', event: Event) {
  const value = (event.target as HTMLInputElement).value
  const newProviders = { ...props.providers }
  newProviders[provider].apiKey = value
  emit('update:providers', newProviders)
}

async function saveProvider(provider: 'qwen' | 'openrouter') {
  const apiKey = props.providers[provider].apiKey.trim()
  
  if (!apiKey) {
    emit('saveSuccess', '请输入 API Key', 'error')
    return
  }

  try {
    const settings = {
      qwenApiKey: props.providers.qwen.apiKey,
      qwenModels: JSON.parse(JSON.stringify(props.providers.qwen.models)),
      openrouterApiKey: props.providers.openrouter.apiKey,
      openrouterModels: JSON.parse(JSON.stringify(props.providers.openrouter.models)),
      currentModel: props.currentModel
    }
    
    await (window as any).electronAPI.saveSettings(settings)
    emit('saveSuccess', `${provider === 'qwen' ? '千问' : 'OpenRouter'} API Key 已保存`, 'success')
    
    await refreshModels(provider)
  } catch (error: any) {
    emit('saveSuccess', '保存失败: ' + error.message, 'error')
  }
}

async function refreshModels(provider: 'qwen' | 'openrouter') {
  const apiKey = props.providers[provider].apiKey
  
  if (!apiKey) {
    emit('saveSuccess', '请先保存 API Key', 'error')
    return
  }

  const hintRef = provider === 'qwen' ? qwenHint : openrouterHint
  const colorRef = provider === 'qwen' ? qwenHintColor : openrouterHintColor
  
  hintRef.value = '正在加载模型列表...'
  colorRef.value = 'rgba(102, 126, 234, 0.8)'

  try {
    const urls = {
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      openrouter: 'https://openrouter.ai/api/v1/models'
    }

    const response = await fetch(urls[provider], {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const models = data.data || []
    
    const newProviders = { ...props.providers }
    newProviders[provider].models = models
    emit('update:providers', newProviders)
    
    hintRef.value = `✅ 已加载 ${models.length} 个模型`
    colorRef.value = '#4caf50'
    
    const settings = {
      qwenApiKey: newProviders.qwen.apiKey,
      qwenModels: JSON.parse(JSON.stringify(newProviders.qwen.models)),
      openrouterApiKey: newProviders.openrouter.apiKey,
      openrouterModels: JSON.parse(JSON.stringify(newProviders.openrouter.models)),
      currentModel: props.currentModel
    }
    await (window as any).electronAPI.saveSettings(settings)
    
    emit('saveSuccess', `${provider === 'qwen' ? '千问' : 'OpenRouter'} 模型列表已缓存`, 'success')
  } catch (error: any) {
    hintRef.value = `❌ 加载失败: ${error.message}`
    colorRef.value = '#f44336'
    emit('saveSuccess', '加载模型失败', 'error')
  }
}

async function onModelChange(event: Event) {
  const selectedModel = (event.target as HTMLSelectElement).value
  emit('update:currentModel', selectedModel)
  
  if (!selectedModel) return
  
  try {
    const settings = {
      qwenApiKey: props.providers.qwen.apiKey,
      qwenModels: JSON.parse(JSON.stringify(props.providers.qwen.models)),
      openrouterApiKey: props.providers.openrouter.apiKey,
      openrouterModels: JSON.parse(JSON.stringify(props.providers.openrouter.models)),
      currentModel: selectedModel
    }
    
    await (window as any).electronAPI.saveSettings(settings)
    
    modelHint.value = `✅ 已选择: ${selectedModel}`
    modelHintColor.value = '#4caf50'
    
    // 显示成功提示
    emit('saveSuccess', `已切换到: ${selectedModel}`, 'success')
  } catch (error: any) {
    emit('saveSuccess', '保存模型失败: ' + error.message, 'error')
  }
}
</script>

<style scoped>
.subsection {
  margin-bottom: 30px;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.subsection-title {
  font-size: 18px;
  margin-bottom: 20px;
  color: #1f2937;
  border-bottom: 2px solid rgba(148, 163, 184, 0.4);
  padding-bottom: 10px;
}

.provider-config {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 8px;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.provider-icon {
  font-size: 24px;
}

.provider-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
  font-weight: 500;
}

.status-badge.configured {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.button-row {
  display: flex;
  gap: 10px;
}

.btn-small {
  padding: 8px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-small:hover {
  background: rgba(102, 126, 234, 0.2);
  transform: translateY(-1px);
}

.btn-small.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.btn-small.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.hint {
  font-size: 12px;
  margin-top: 8px;
}
</style>
