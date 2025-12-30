<template>
  <div class="chat-window">
    <!-- 系统提示词设置按钮 -->
    <div class="system-prompt-btn" @click="showSystemPrompt = !showSystemPrompt" title="系统提示词">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
        <path d="M12 12.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
        <path d="M12 18.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
      </svg>
    </div>
    
    <!-- 自动语音朗读开关 -->
    <div class="tts-toggle" title="自动语音朗读">
      <label class="tts-label">
        <input 
          type="checkbox" 
          v-model="autoTTS" 
          @change="saveConfig"
          class="tts-checkbox"
        />
        <svg v-if="autoTTS" class="tts-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        <svg v-else class="tts-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      </label>
    </div>

    <!-- 遗罩 -->
    <div v-if="showSystemPrompt" class="modal-overlay" @click="showSystemPrompt = false"></div>

    <!-- 系统提示词设置面板 -->
    <div v-if="showSystemPrompt" class="system-prompt-panel">
      <div class="panel-header">
        <h3>系统提示词</h3>
        <button @click="showSystemPrompt = false" class="close-btn">×</button>
      </div>
      
      <div class="panel-content">
        <!-- 模板选择 -->
        <div class="template-section">
          <h4>角色模板</h4>
          <div class="template-grid">
            <div 
              v-for="template in promptTemplates" 
              :key="template.name"
              class="template-card"
              @click="selectTemplate(template)"
            >
              <span class="template-name">{{ template.name }}</span>
            </div>
          </div>
        </div>
        
        <!-- 助手昵称 -->
        <div class="config-section">
          <label>助手昵称</label>
          <input 
            type="text" 
            v-model="assistantName" 
            placeholder="例如：小智"
            class="text-input"
            @blur="saveConfig"
          />
        </div>
        
        <!-- 你是桌宠的谁 -->
        <div class="config-section">
          <label>你是桌宠的谁</label>
          <input 
            type="text" 
            v-model="userRelation" 
            placeholder="例如：男朋友、爸爸、女朋友、姐姐"
            class="text-input"
            @blur="saveConfig"
          />
        </div>
        
        <!-- 对话语言 -->
        <div class="config-section">
          <label>对话语言</label>
          <select v-model="dialogLanguage" class="select-input" @change="saveConfig">
            <option>普通话</option>
            <option>英语</option>
            <option>粤语</option>
            <option>四川话</option>
            <option>东北话</option>
          </select>
        </div>
        <!-- 角色介绍（系统提示词） -->
        <div class="role-description-section">
          <div class="section-header">
            <label>角色介绍（系统提示词）</label>
            <div class="header-actions">
              <button @click="optimizeRoleDescription" class="ai-generate-btn" :disabled="isGenerating || !roleDescription.trim()">
                {{ isGenerating ? '优化中...' : '✨ AI一键优化' }}
              </button>
              <span class="char-count">{{ roleDescription.length }} / 2000</span>
            </div>
          </div>
          <textarea 
            v-model="roleDescription" 
            placeholder="输入角色介绍，可以简单描述，然后点击 AI一键优化...\n\n支持变量：\n{assistant_name} - 助手昵称"
            maxlength="2000"
            class="role-textarea"
            @blur="saveConfig"
          ></textarea>
          <div class="variable-hint">
            💡 提示：可使用 {assistant_name} 等变量，例如："大家好，我叫{assistant_name}"
          </div>
        </div>
        
        <!-- 历史消息轮数设置 -->
        <div class="history-rounds-setting">
          <div class="setting-header">
            <label>历史消息轮数</label>
            <span class="rounds-value">{{ maxHistoryRounds }} 轮 ({{ maxHistoryRounds * 2 }} 条消息)</span>
          </div>
          <input 
            type="range" 
            v-model.number="maxHistoryRounds" 
            min="10" 
            :max="MAX_ROUNDS_LIMIT" 
            class="rounds-slider"
            @change="saveHistoryRounds"
          />
          <div class="slider-labels">
            <span>10 轮</span>
            <span>{{ MAX_ROUNDS_LIMIT }} 轮</span>
          </div>
        </div>
        
        <!-- 当前记忆 -->
        <div class="memory-section">
          <div class="section-header">
            <label>当前记忆</label>
            <button @click="clearMemory" class="clear-memory-btn">清除记忆</button>
          </div>
          <textarea 
            v-model="currentMemory" 
            placeholder="对话记忆将显示在这里..."
            maxlength="1000"
            class="memory-textarea"
            @blur="saveConfig"
          ></textarea>
          <div class="char-count">{{ currentMemory.length }} / 1000</div>
        </div>
      </div>
      
      <div class="panel-footer">
        <button @click="clearHistory" class="clear-history-btn">🗑️ 清空历史消息</button>
        <button @click="saveSystemPrompt" class="save-btn">保存</button>
        <button @click="resetSystemPrompt" class="reset-btn">重置</button>
      </div>
    </div>

    <vue-advanced-chat
      height="100%"
      :current-user-id="currentUserId"
      :rooms="JSON.stringify(rooms)"
      :rooms-loaded="true"
      :messages="JSON.stringify(messages)"
      :messages-loaded="messagesLoaded"
      :room-id="currentRoomId || ''"
      :show-add-room="false"
      :show-rooms-list="false"
      :rooms-list-opened="false"
      :show-audio="false"
      :show-files="false"
      :show-emojis="true"
      :show-reaction-emojis="false"
      :show-new-messages-divider="false"
      :text-messages="JSON.stringify(textMessages)"
      theme="dark"
      :styles="JSON.stringify(chatStyles)"
      @send-message="sendMessage"
      @fetch-messages="loadMessages"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { register } from 'vue-advanced-chat'
import { buildOptimizeRolePrompt, SPEECH_RULES } from '../config/ai-prompts'

register()

const currentUserId = ref('user-1')
const messagesLoaded = ref(false)
const currentRoomId = ref<string | null>(null)

// 角色介绍设置
const showSystemPrompt = ref(false)
const DEFAULT_SYSTEM_PROMPT = '你是一个友好、乐于助人的 AI 助手。'

// 历史消息轮数设置
const maxHistoryRounds = ref(10) // 默认 10 轮（20 条消息）
const MAX_ROUNDS_LIMIT = 80 // 最大 80 轮（160 条消息）
const MIN_ROUNDS_FOR_MEMORY = 10 // 长期记忆最小轮数

// 长期记忆计数器
const totalTurns = ref(0) // 全局对话轮计数

// 助手配置
const assistantName = ref('Momo') // 助手昵称
const userRelation = ref('') // 用户与助手的关系（例如：男朋友、爸爸）
const dialogLanguage = ref('普通话') // 对话语言
const roleDescription = ref('') // 角色介绍
const memoryType = ref('长期记忆（持续积累）') // 记忆类型（固定为长期记忆）
const currentMemory = ref('') // 当前记忆
const isGenerating = ref(false) // AI生成状态
const autoTTS = ref(false) // 自动语音朗读

/**
 * 格式化时间为 YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(date: Date | string | number): string {
  try {
    let d: Date
    
    if (typeof date === 'string') {
      // 如果已经是格式化的字符串（YYYY-MM-DD HH:mm:ss），直接返回
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
        return date
      }
      d = new Date(date)
    } else if (typeof date === 'number') {
      d = new Date(date)
    } else if (date instanceof Date) {
      d = date
    } else {
      console.warn('[formatDateTime] 无效的日期参数:', date)
      return new Date().toLocaleString('zh-CN')
    }
    
    // 检查是否为有效日期
    if (isNaN(d.getTime())) {
      console.warn('[formatDateTime] 无效的日期对象:', date)
      return new Date().toLocaleString('zh-CN')
    }
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.error('[formatDateTime] 格式化失败:', error, '原始值:', date)
    return new Date().toLocaleString('zh-CN')
  }
}

// 系统提示词模板
const promptTemplates = [
  {
    name: '台湾女友',
    prompt: '我是你的台湾女朋友，说话带点台湾腔调，温柔甜美又有点小任性。喜欢叫你宝贝或老公，说话用"哦"、"啦"等语气词。'
  },
  {
    name: '贴心女儿',
    prompt: '我是你的20岁的大学生女儿，很关心父母，心思细腻又体贴。性格活泼跳脱，说话有点鬼马精怪，但心里始终惦记着家人。喜欢叫你爸地或老爸，说话时而调皮时而温柔。'
  },
  {
    name: 'English Tutor',
    prompt: 'I am a friendly English tutor. I speak naturally in English and help with language learning in a relaxed way.'
  },
  {
    name: '好奇小男孩',
    prompt: '我是个好奇心很强的小男孩，充满探索精神，喜欢问为什么，对科学和技术感兴趣。说话天真烂漫、充满好奇。'
  },
  {
    name: '默认助手',
    prompt: '我是一个友好乐于助人的AI助手，语气温和自然。'
  },
  {
    name: '贴心女友',
    prompt: '我是你的贴心女朋友，温柔体贴善解人意，说话亲昵自然，会关心你的感受，偶尔撒撒娇。语气要甜美可爱，但不要过分夸张。'
  },
  {
    name: '可爱妹妹',
    prompt: '我是你的可爱妹妹，活泼开朗爱撒娇，说话俏皮有趣，喜欢叫你哥哥或者欧尼酱。语气要天真烂漫，带点小孩子气，但也很聪明懂事。'
  },
  {
    name: '温柔男友',
    prompt: '我是你的温柔男友，成熟稳重又贴心，说话低调有分寸，会默默关心照顾你。语气温和有力，给人安全感。'
  },
  {
    name: '女王大人',
    prompt: '我是高贵优雅的女王，强势又有魅力，说话自信从容，略带命令的口吻但不刻薄。偶尔会温柔一下，但大多时候保持高冷姿态。'
  },
  {
    name: '高冷御姐',
    prompt: '我是成熟知性的御姐，高冷又优雅，说话简洁精准，不会啰嗦。偶尔会露出一丝温柔，但大多时候保持距离感。语气要冷静理性，但不失魅力。'
  },
  {
    name: '元气少女',
    prompt: '我是充满活力的元气少女，乐观开朗充满正能量，说话热情洋溢带着感叹号。喜欢用可爱的语气词，但不过分夸张。'
  },
  {
    name: '知心姐姐',
    prompt: '我是温柔的知心姐姐，善于倾听和开导，说话温暖治愈，会给出真诚的建议。语气要亲切自然，像朋友聊天一样轻松。'
  }
]

// 对话列表
const rooms = ref<any[]>([])

// 当前对话的消息
const messages = ref<any[]>([])

const textMessages = ref({
  ROOMS_EMPTY: '暂无聊天',
  ROOM_EMPTY: '请选择聊天',
  NEW_MESSAGES: '新消息',
  MESSAGE_DELETED: '消息已删除',
  MESSAGES_EMPTY: '暂无消息',
  CONVERSATION_STARTED: '对话开始于',
  TYPE_MESSAGE: '输入消息...',
  SEARCH: '搜索',
  IS_ONLINE: '在线',
  LAST_SEEN: '最后在线',
  IS_TYPING: '正在输入...',
  CANCEL_SELECT_MESSAGE: '取消选择'
})

const chatStyles = ref({
  general: {
    color: '#e0e0e0',
    colorButtonClear: '#fff',
    colorButton: '#1976d2',
    backgroundInput: '#2a2a2a',
    colorPlaceholder: '#9e9e9e',
    colorCaret: '#1976d2',
    colorSpinner: '#1976d2',
    borderStyle: '1px solid #3a3a3a',
    backgroundScrollIcon: '#2a2a2a'
  },
  container: {
    borderRadius: '0px',
    boxShadow: 'none'
  },
  header: {
    background: '#1e1e1e',
    colorRoomName: '#fff',
    colorRoomInfo: '#9e9e9e'
  },
  footer: {
    background: '#1e1e1e',
    backgroundReply: '#2a2a2a'
  },
  content: {
    background: '#2a2a2a'
  },
  sidemenu: {
    background: '#1e1e1e',
    backgroundHover: '#2a2a2a',
    backgroundActive: '#333',
    colorActive: '#fff',
    borderColorSearch: '#3a3a3a'
  },
  dropdown: {
    background: '#1e1e1e',
    backgroundHover: '#2a2a2a'
  },
  message: {
    background: '#0b93f6',
    backgroundMe: '#1976d2',
    color: '#fff',
    colorStarted: '#9e9e9e',
    backgroundDeleted: '#3a3a3a'
  },
  markdown: {
    background: '#1e1e1e',
    border: '#3a3a3a',
    color: '#e0e0e0',
    colorMulti: '#e0e0e0'
  },
  room: {
    colorUsername: '#fff',
    colorMessage: '#9e9e9e',
    colorTimestamp: '#757575',
    colorStateOnline: '#4caf50',
    colorStateOffline: '#9e9e9e',
    backgroundCounterBadge: '#e53935',
    colorCounterBadge: '#fff'
  },
  emoji: {
    background: '#1e1e1e'
  },
  icons: {
    search: '#9e9e9e',
    add: '#1976d2',
    toggle: '#fff',
    menu: '#fff',
    close: '#fff',
    closeImage: '#fff',
    file: '#1976d2',
    paperclip: '#fff',
    closeOutline: '#fff',
    send: '#fff',
    sendDisabled: '#646464',
    emoji: '#fff',
    emojiReaction: 'rgba(255, 255, 255, 0.3)',
    document: '#1976d2',
    pencil: '#9e9e9e',
    checkmark: '#9e9e9e',
    checkmarkSeen: '#0696c7',
    eye: '#fff',
    dropdownMessage: '#fff',
    dropdownMessageBackground: 'rgba(0, 0, 0, 0.25)',
    dropdownRoom: '#9e9e9e',
    dropdownScroll: '#0a0a0a',
    microphone: '#fff',
    audioPlay: '#b0b0b0',
    audioPause: '#b0b0b0',
    audioCancel: '#b0b0b0',
    audioConfirm: '#1976d2'
  }
})

/**
 * 保存配置（包括角色介绍）
 */
function saveSystemPrompt() {
  saveConfig()
  console.log('助手配置已保存')
  // 显示保存成功提示
  alert('✅ 助手配置已保存')
  // 自动关闭设置面板
  showSystemPrompt.value = false
}

/**
 * 保存历史消息轮数
 */
function saveHistoryRounds() {
  // 🔥 强制最小值为 10
  if (maxHistoryRounds.value < MIN_ROUNDS_FOR_MEMORY) {
    maxHistoryRounds.value = MIN_ROUNDS_FOR_MEMORY
  }
  localStorage.setItem('maxHistoryRounds', maxHistoryRounds.value.toString())
  console.log(`历史消息轮数已设置为: ${maxHistoryRounds.value} 轮`)
}

/**
 * 保存助手配置
 */
function saveConfig() {
  const config = {
    assistantName: assistantName.value,
    userRelation: userRelation.value,
    dialogLanguage: dialogLanguage.value,
    roleDescription: roleDescription.value,
    memoryType: memoryType.value,
    currentMemory: currentMemory.value,
    autoTTS: autoTTS.value,
    totalTurns: totalTurns.value // 🔥 保存对话轮数
  }
  localStorage.setItem('assistantConfig', JSON.stringify(config))
  console.log('助手配置已保存')
}

/**
 * 清空历史消息
 */
async function clearHistory() {
  if (!confirm('确认清空所有历史消息吗？此操作不可恢复！')) {
    return
  }
  
  try {
    if (!currentRoomId.value) {
      alert('⚠️ 没有当前对话')
      return
    }
    
    // 删除当前对话
    await (window as any).electronAPI.deleteConversation(currentRoomId.value)
    
    // 创建新对话
    const conv = await (window as any).electronAPI.createConversation(`与 ${assistantName.value} 的对话`)
    
    // 添加欢迎消息
    await (window as any).electronAPI.saveMessage({
      conversationId: conv.id,
      role: 'assistant',
      content: `你好呀！`
    })
    
    // 更新界面
    rooms.value = [{
      roomId: conv.id,
      roomName: conv.title,
      avatar: '🐱',
      users: [
        { _id: 'user-1', username: '你' },
        { _id: 'assistant-1', username: assistantName.value, avatar: '🐱' }
      ],
      lastMessage: {
        content: '',
        timestamp: new Date(conv.createdAt).toISOString(),
        senderId: 'assistant-1'
      },
      index: new Date(conv.createdAt).getTime()
    }]
    
    currentRoomId.value = conv.id
    await loadMessages({ room: rooms.value[0] })
    
    // 🔥 重置对话轮数
    totalTurns.value = 0
    saveConfig()
    
    alert('✅ 历史消息已清空')
    showSystemPrompt.value = false
  } catch (error) {
    console.error('清空历史消息失败:', error)
    alert('❌ 清空失败，请重试')
  }
}

/**
 * 清除记忆
 */
async function clearMemory() {
  if (confirm('确定要清除所有长期记忆吗？\n\n清除后将无法恢复，AI 将失去对你的所有记忆。')) {
    if (currentRoomId.value) {
      // 清空长期记忆（只清除当前助手的）
      try {
        await (window as any).electronAPI.memory.clear(
          currentRoomId.value,
          assistantName.value // 传递 assistantId
        )
        
        // 🔥 重置对话轮数
        totalTurns.value = 0
        saveConfig()
        
        await loadMemoryDisplay()
        console.log(`[长期记忆] 已清除助手 "${assistantName.value}" 的记忆`)
        alert('✅ 长期记忆已清除')
      } catch (error) {
        console.error('清除长期记忆失败:', error)
        alert('❌ 清除失败')
      }
    }
  }
}

/**
 * 加载长期记忆到 UI 显示
 */
async function loadMemoryDisplay() {
  if (!currentRoomId.value) {
    return
  }
  
  try {
    // 传递 assistantId
    const memories = await (window as any).electronAPI.memory.getAll(
      currentRoomId.value,
      assistantName.value
    )
    
    if (memories.length === 0) {
      currentMemory.value = '还没有任何长期记忆。每 10 轮对话将自动生成阶段性总结...'
    } else {
      // 格式化显示
      const memoryText = memories
        .sort((a: any, b: any) => b.weight - a.weight) // 按重要性排序
        .slice(0, 10) // 最多显示 10 条
        .map((mem: any) => `• [重要度: ${mem.weight}] ${mem.text}`)
        .join('\n')
      
      currentMemory.value = `当前有 ${memories.length} 条长期记忆：\n\n${memoryText}`
    }
  } catch (error) {
    console.error('加载长期记忆失败:', error)
    currentMemory.value = '加载记忆失败'
  }
}

/**
 * AI优化角色介绍
 */
async function optimizeRoleDescription() {
  if (isGenerating.value || !roleDescription.value.trim()) return
  
  // 获当前角色介绍作为参考
  const userInput = roleDescription.value.trim()
  
  isGenerating.value = true
  
  try {
    // 获取 LLM 配置
    const config = await (window as any).electronAPI.getLlmConfig()
    
    // 使用配置文件中的提示词模板
    const optimizePrompt = buildOptimizeRolePrompt(userInput)

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          { role: 'user', content: optimizePrompt }
        ],
        stream: false,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    let optimizedText = data.choices[0].message.content.trim()
    
    // 清理可能的 markdown 格式
    optimizedText = optimizedText
      .replace(/^#+\s+/gm, '') // 移除标题
      .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗体
      .replace(/\*(.+?)\*/g, '$1') // 移除斜体
      .replace(/^[-*+]\s+/gm, '') // 移除列表标记
      .replace(/^\d+\.\s+/gm, '') // 移除数字列表
      .trim()
    
    roleDescription.value = optimizedText
    saveConfig()
    
  } catch (error) {
    console.error('AI优化角色介绍失败:', error)
    alert('❌ 优化失败，请检查网络和 API配置')
  } finally {
    isGenerating.value = false
  }
}

/**
 * 替换角色介绍中的变量
 */
function replaceVariables(text: string): string {
  return text.replace(/{assistant_name}/g, assistantName.value)
}

// TTS 播放队列管理
interface AudioQueueItem {
  audioUrl: string | null  // null 表示还在合成中
  text: string
  index: number  // 序号，确保顺序
}

const ttsQueue: AudioQueueItem[] = [] // 存储音频（包括正在合成的）
let isPlayingTTS = false
let currentAudio: HTMLAudioElement | null = null // 当前播放的音频
let synthesisIndex = 0 // 合成序号计数器

/**
 * 停止所有 TTS 播放并清空队列
 */
function stopAllTTS() {
  // 停止 Live2D 口型同步
  const electronAPI = (window as any).electronAPI
  if (electronAPI && electronAPI.lipSync) {
    electronAPI.lipSync.stop()
  }
  
  // 停止当前播放的音频
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  
  // 清空队列并释放资源
  while (ttsQueue.length > 0) {
    const item = ttsQueue.shift()!
    if (item.audioUrl) {
      URL.revokeObjectURL(item.audioUrl)
    }
  }
  
  isPlayingTTS = false
  synthesisIndex = 0
}

/**
 * 处理 TTS 播放队列（按顺序播放）
 */
async function processTTSQueue() {
  if (isPlayingTTS || ttsQueue.length === 0) {
    return
  }
  
  // 检查队首是否已合成完成
  const item = ttsQueue[0]
  if (!item.audioUrl) {
    // 还在合成中，等待
    return
  }
  
  // 已合成完成，开始播放
  isPlayingTTS = true
  ttsQueue.shift() // 从队列移除
  
  try {
    // 创建 Audio 元素播放
    const audio = new Audio(item.audioUrl)
    currentAudio = audio
    
    // 启动 Live2D 口型同步 - 通过 IPC 通知主窗口
    const electronAPI = (window as any).electronAPI
    if (electronAPI && electronAPI.lipSync) {
      try {
        electronAPI.lipSync.start()
        
        // 创建音频分析器
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        
        const source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        
        // 实时发送音量数据
        let volumeUpdateId: number | undefined
        const updateVolume = () => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          const normalized = Math.min(average / 60, 1.0)
          
          electronAPI.lipSync.updateVolume(normalized)
          
          if (currentAudio === audio) {
            volumeUpdateId = requestAnimationFrame(updateVolume)
          }
        }
        updateVolume()
        
        // 绑定清理函数
        ;(audio as any)._volumeUpdateId = volumeUpdateId
        ;(audio as any)._audioContext = audioContext
      } catch (error) {
        console.error('[LipSync] 初始化失败:', error)
      }
    }
    
    // 等待播放完成
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        // 停止音量更新
        if ((audio as any)._volumeUpdateId) {
          cancelAnimationFrame((audio as any)._volumeUpdateId)
        }
        
        // 停止口型同步
        if (electronAPI && electronAPI.lipSync) {
          electronAPI.lipSync.stop()
        }
        
        // 关闭 AudioContext
        if ((audio as any)._audioContext) {
          ;(audio as any)._audioContext.close()
        }
        
        URL.revokeObjectURL(item.audioUrl!)
        currentAudio = null
        resolve()
      }
      
      audio.onerror = (e) => {
        console.error('[TTS Queue] 播放失败:', e)
        
        // 停止音量更新
        if ((audio as any)._volumeUpdateId) {
          cancelAnimationFrame((audio as any)._volumeUpdateId)
        }
        
        // 停止口型同步
        if (electronAPI && electronAPI.lipSync) {
          electronAPI.lipSync.stop()
        }
        
        // 关闭 AudioContext
        if ((audio as any)._audioContext) {
          ;(audio as any)._audioContext.close()
        }
        
        URL.revokeObjectURL(item.audioUrl!)
        currentAudio = null
        reject(e)
      }
      
      audio.play().catch(reject)
    })
  } catch (error) {
    console.error('[TTS Queue] 播放失败:', error)
    currentAudio = null
  } finally {
    isPlayingTTS = false
    // 继续处理下一个
    processTTSQueue()
  }
}

/**
 * TTS 语音合成（立即开始合成，按序号插入队列）
 */
async function speakText(text: string) {
  if (!autoTTS.value || !text.trim()) {
    return
  }
  
  // 分配序号并立即加入队列（占位）
  const index = synthesisIndex++
  const queueItem: AudioQueueItem = {
    audioUrl: null,  // 标记为合成中
    text: text.trim(),
    index
  }
  ttsQueue.push(queueItem)
  
  // 异步合成（不阻塞）
  try {
    const audioBuffer = await (window as any).electronAPI.tts.synthesize(text.trim())
    
    // 将 ArrayBuffer 转换为 Blob URL
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
    const audioUrl = URL.createObjectURL(blob)
    
    // 更新队列中的项（标记为已完成）
    queueItem.audioUrl = audioUrl
    
    // 尝试触发播放
    processTTSQueue()
  } catch (error) {
    console.error('[TTS] 合成失败:', error)
    // 合成失败，从队列移除
    const idx = ttsQueue.indexOf(queueItem)
    if (idx !== -1) {
      ttsQueue.splice(idx, 1)
    }
  }
}

/**
 * 重置角色介绍
 */
function resetSystemPrompt() {
  roleDescription.value = DEFAULT_SYSTEM_PROMPT
  saveConfig()
  alert('✅ 角色介绍已重置')
}

/**
 * 选择模板
 */
function selectTemplate(template: any) {
  roleDescription.value = template.prompt
}

/**
 * 初始化：加载单一对话
 */
async function loadConversations() {
  try {
    let conversations = await (window as any).electronAPI.getConversations()
    
    // 如果没有对话，创建默认对话
    if (conversations.length === 0) {
      const conv = await (window as any).electronAPI.createConversation(`与 ${assistantName.value} 的对话`)
      conversations = [conv]
      
      // 添加欢迎消息
      await (window as any).electronAPI.saveMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: `你好呀！`
      })
    }
    
    // 只使用第一个对话
    const conv = conversations[0]
    
    // 转换为 vue-advanced-chat 的格式
    rooms.value = [{
      roomId: conv.id,
      roomName: conv.title,
      avatar: '🐱',
      users: [
        { _id: 'user-1', username: '你' },
        { _id: 'assistant-1', username: assistantName.value, avatar: '🐱' }
      ],
      lastMessage: {
        content: '',
        timestamp: new Date(conv.updatedAt || conv.createdAt).toISOString(),
        senderId: 'assistant-1'
      },
      index: new Date(conv.updatedAt || conv.createdAt).getTime()
    }]

    currentRoomId.value = conv.id
    await loadMessages({ room: rooms.value[0] })
  } catch (error) {
    console.error('加载对话失败:', error)
    // 即使失败也要设置 messagesLoaded，否则输入框无法使用
    messagesLoaded.value = true
  }
}

/**
 * 加载对话的消息
 */
async function loadMessages(event: any) {
  try {
    messagesLoaded.value = false
    
    // 处理不同的参数格式
    // vue-advanced-chat 可能传递 CustomEvent，需要从 detail 中提取
    let room = event
    if (event?.detail) {
      room = event.detail.room || event.detail
    } else if (event?.room) {
      room = event.room
    }
    
    if (!room || !room.roomId) {
      console.warn('loadMessages: 无效的 room 参数', event)
      messagesLoaded.value = true
      return
    }
    
    currentRoomId.value = room.roomId
    
    const dbMessages = await (window as any).electronAPI.getMessages(room.roomId)
    
    // 转换为 vue-advanced-chat 的格式
    messages.value = dbMessages.map((msg: any) => ({
      _id: msg.id,
      content: msg.content,
      senderId: msg.role === 'user' ? 'user-1' : 'assistant-1',
      timestamp: formatDateTime(msg.timestamp),
      date: formatDateTime(msg.timestamp)
    }))
    
    messagesLoaded.value = true
  } catch (error) {
    console.error('加载消息失败:', error)
    messagesLoaded.value = true
  }
}

async function sendMessage(event: any) {
  // 停止上一轮的所有 TTS 播放
  stopAllTTS()
  
  // vue-advanced-chat 传递的是 CustomEvent，detail 是数组
  const data = event?.detail?.[0] || event
  
  // 提取 content 和 roomId
  const content = data?.content
  const roomId = data?.roomId || currentRoomId.value
  
  // 验证 content
  if (!content || typeof content !== 'string' || !content.trim()) {
    console.error('无效的消息内容:', content, '数据:', data)
    return
  }
  
  // 使用当前激活的对话 ID
  const activeRoomId = roomId || currentRoomId.value
  
  if (!activeRoomId) {
    console.error('无效的对话 ID')
    return
  }
  
  // 清理内容
  const messageContent = content.trim()
  
  // 添加用户消息
  const userMessage = {
    _id: Date.now().toString(),
    content: messageContent,
    senderId: 'user-1',
    timestamp: formatDateTime(new Date()),
    date: formatDateTime(new Date())
  }
  messages.value.push(userMessage)

  // 保存用户消息到数据库
  try {
    await (window as any).electronAPI.saveMessage({
      conversationId: activeRoomId,
      role: 'user',
      content: messageContent
    })
  } catch (error) {
    console.error('保存用户消息失败:', error)
  }

  // 添加"正在输入"占位符
  const thinkingMsgId = (Date.now() + 1).toString()
  const thinkingMessage = {
    _id: thinkingMsgId,
    content: '正在思考...',
    senderId: 'assistant-1',
    timestamp: formatDateTime(new Date()),
    date: formatDateTime(new Date())
  }
  messages.value.push(thinkingMessage)

  try {
    // 获取 LLM 配置
    const config = await (window as any).electronAPI.getLlmConfig()
    
    // 构建消息历史（加入系统提示词）
    const MAX_HISTORY_MESSAGES = maxHistoryRounds.value * 2 // 每轮 = 2 条消息（user + assistant）
    
    // 构建系统提示词（角色介绍 + 关系描述 + Speech Rules）
    const baseSystemPrompt = roleDescription.value 
      ? replaceVariables(roleDescription.value) 
      : DEFAULT_SYSTEM_PROMPT
    
    // 添加关系描述
    let relationText = ''
    if (userRelation.value.trim()) {
      relationText = `\n\n接下来和我说话的都是我的${userRelation.value.trim()}。`
    }
    
    // 注入长期记忆（如果启用）
    let memoryText = ''
    if (memoryType.value === '长期记忆（持续积累）' && activeRoomId) {
      try {
        const currentContext = messageContent // 当前用户输入作为上下文
        memoryText = await (window as any).electronAPI.memory.getForPrompt(
          activeRoomId,
          assistantName.value, // 传递 assistantId
          currentContext,
          5, // 最多检索 5 条记忆
          config // 传递 LLM 配置用于压缩
        )
        console.log('[长期记忆] 注入系统提示词:', memoryText)
      } catch (error) {
        console.error('[长期记忆] 获取失败:', error)
      }
    }
    
    // 自动追加 Speech Rules 强制规则
    const systemPromptText = baseSystemPrompt + relationText + memoryText + SPEECH_RULES
    
    const chatMessages = [
      // 系统提示词
      { role: 'system', content: systemPromptText },
      // 用户消息历史（只取最近的 N 条）
      ...messages.value
        .filter(msg => msg._id !== thinkingMsgId)
        .slice(-MAX_HISTORY_MESSAGES) // 只保留最后 N 条
        .map(msg => ({
          role: msg.senderId === 'user-1' ? 'user' : 'assistant',
          content: msg.content
        }))
    ]

    // 调用 LLM
    const response = await fetch(`${config.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: chatMessages,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }

    // 移除"正在思考"消息
    const thinkingIndex = messages.value.findIndex(m => m._id === thinkingMsgId)
    if (thinkingIndex !== -1) {
      messages.value.splice(thinkingIndex, 1)
    }

    // 创建助手消息
    const assistantMsgId = (Date.now() + 2).toString()
    const assistantMessage = {
      _id: assistantMsgId,
      content: '',
      senderId: 'assistant-1',
      timestamp: formatDateTime(new Date()),
      date: formatDateTime(new Date())
    }
    messages.value.push(assistantMessage)

    // 读取流式响应
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let pendingSentence = '' // 待合成的句子片段

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue
        
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          
          if (content) {
            fullContent += content
            pendingSentence += content
            
            // 更新消息内容
            const msgIndex = messages.value.findIndex(m => m._id === assistantMsgId)
            if (msgIndex !== -1) {
              messages.value[msgIndex] = {
                ...messages.value[msgIndex],
                content: fullContent
              }
            }
            
            // 检查是否完成一个句子（只在句号、问号、感叹号结尾）
            const sentenceEnd = /[。！？.!?]$/
            if (sentenceEnd.test(pendingSentence.trim())) {
              // 触发 TTS 合成当前句子
              const sentence = pendingSentence.trim()
              if (autoTTS.value && sentence) {
                // 异步播放，不阻塞流式接收
                speakText(sentence).catch(err => {
                  console.error('[TTS] 句子合成失败:', err)
                })
              }
              pendingSentence = '' // 清空待合成片段
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    // 流式响应完成后，保存助手消息到数据库
    if (fullContent) {
      try {
        await (window as any).electronAPI.saveMessage({
          conversationId: activeRoomId,
          role: 'assistant',
          content: fullContent
        })
      } catch (error) {
        console.error('保存助手消息失败:', error)
      }
      
      // 如果还有未播放的片段（最后一句可能没有标点），也播放
      if (autoTTS.value && pendingSentence.trim()) {
        await speakText(pendingSentence.trim())
      }
      
      // 🔥 自动生成长期记忆（每 10 轮一次）
      if (memoryType.value === '长期记忆（持续积累）') {
        // 增加对话轮数
        totalTurns.value++
        console.log(`[长期记忆] 当前对话轮数: ${totalTurns.value}`)
        
        // 每 10 轮生成一次记忆
        if (totalTurns.value % 10 === 0) {
          // 延迟 2 秒生成记忆，避免卡界面
          setTimeout(async () => {
            try {
              console.log(`[长期记忆] 达到 ${totalTurns.value} 轮，开始生成阶段性总结...`)
              
              // 获取最近 N 轮对话（用于生成记忆）
              // 强制最小为 10 轮
              const memoryRounds = Math.max(maxHistoryRounds.value, MIN_ROUNDS_FOR_MEMORY)
              const recentMessages = await (window as any).electronAPI.getMessages(
                activeRoomId,
                memoryRounds * 2 // 每轮 = 2 条消息
              )
              
              if (recentMessages.length > 0) {
                // 调用记忆生成，传递 assistantId
                const result = await (window as any).electronAPI.memory.generate(
                  activeRoomId,
                  assistantName.value, // 使用助手名作为 assistantId
                  recentMessages,
                  {
                    endpoint: config.endpoint,
                    apiKey: config.apiKey,
                    model: config.modelId
                  }
                )
                
                if (result.success) {
                  console.log(`[长期记忆] 生成成功！候选: ${result.candidates}, 保存: ${result.saved}`)
                  
                  // 更新 UI 显示
                  await loadMemoryDisplay()
                } else {
                  console.error('[长期记忆] 生成失败:', result.error)
                  if (result.details) {
                    console.error('[长期记忆] 错误详情:', result.details)
                  }
                }
              }
            } catch (error) {
              console.error('[长期记忆] 生成失败:', error)
            }
          }, 2000)
        } else {
          console.log(`[长期记忆] 距离下次总结还有 ${10 - (totalTurns.value % 10)} 轮`)
        }
      }
    }
  } catch (error: any) {
    console.error('聊天错误:', error)
    
    // 移除"正在思考"消息
    const thinkingIndex = messages.value.findIndex(m => m._id === thinkingMsgId)
    if (thinkingIndex !== -1) {
      messages.value.splice(thinkingIndex, 1)
    }
    
    // 添加错误消息
    messages.value.push({
      _id: Date.now().toString(),
      content: `❌ 抱歉，出现了错误：${error.message}`,
      senderId: 'assistant-1',
      timestamp: formatDateTime(new Date()),
      date: formatDateTime(new Date())
    })
  }
}

// close 函数已移除

onMounted(async () => {
  // 加载保存的历史消息轮数
  const savedRounds = localStorage.getItem('maxHistoryRounds')
  if (savedRounds) {
    maxHistoryRounds.value = Math.max(parseInt(savedRounds, 10), MIN_ROUNDS_FOR_MEMORY) // 🔥 强制最小值
  }
  
  // 加载助手配置
  const savedConfig = localStorage.getItem('assistantConfig')
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig)
      assistantName.value = config.assistantName || 'Momo'
      userRelation.value = config.userRelation || ''
      dialogLanguage.value = config.dialogLanguage || '普通话'
      roleDescription.value = config.roleDescription || ''
      // memoryType 固定为长期记忆，不再从配置加载
      currentMemory.value = config.currentMemory || ''
      autoTTS.value = config.autoTTS || false
      totalTurns.value = config.totalTurns || 0 // 🔥 加载对话轮数
      
      console.log(`[长期记忆] 加载历史轮数: ${totalTurns.value}`)
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  }
  
  await loadConversations()
  
  // 加载长期记忆显示
  await loadMemoryDisplay()
})
</script>

<style scoped>
.chat-window {
  width: 100%;
  height: 100vh;
  background: #2a2a2a;
  position: relative;
}

/* 强制隐藏左侧会话列表 - 多种可能的类名 */
.chat-window :deep(.vac-rooms-container),
.chat-window :deep(.vac-rooms-list),
.chat-window :deep(.rooms-container),
.chat-window :deep(.vac-room-list),
.chat-window :deep(.vac-rooms-wrapper),
.chat-window :deep(div[class*="rooms"]:not([class*="room-header"]):not([class*="room-name"])) {
  display: none !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}

/* 左侧所有列 */
.chat-window :deep(.vac-col-1),
.chat-window :deep([class*="col-1"]) {
  display: none !important;
  width: 0 !important;
}

.chat-window :deep(.vac-container-center),
.chat-window :deep(.vac-col-messages),
.chat-window :deep([class*="container-center"]),
.chat-window :deep([class*="col-messages"]) {
  margin-left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  flex: 1 !important;
}

/* 系统提示词按钮 */
.system-prompt-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  background: #1976d2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  transition: background 0.3s;
}

.system-prompt-btn:hover {
  background: #1565c0;
}

.system-prompt-btn svg {
  width: 20px;
  height: 20px;
  color: white;
}

/* TTS 开关按钮 */
.tts-toggle {
  position: absolute;
  top: 10px;
  right: 56px;
  z-index: 1000;
}

.tts-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #2a2a2a;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.tts-label:hover {
  background: #333;
  border-color: #1976d2;
}

.tts-checkbox {
  display: none;
}

.tts-icon {
  width: 20px;
  height: 20px;
  color: #9e9e9e;
  transition: color 0.3s;
}

.tts-checkbox:checked + .tts-icon,
.tts-label:has(.tts-checkbox:checked) .tts-icon {
  color: #1976d2;
}

.tts-label:hover .tts-icon {
  color: #1976d2;
}

/* 遗罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  backdrop-filter: blur(2px);
}

/* 系统提示词面板 */
.system-prompt-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 650px;
  max-width: calc(100vw - 40px);
  max-height: 85vh;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

/* 模板选择区域 */
.template-section {
  padding: 0;
  background: transparent;
  border: none;
}

.template-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #9e9e9e;
  font-weight: normal;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}

.template-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.template-card:hover {
  background: #333;
  border-color: #1976d2;
  transform: translateY(-2px);
}

.template-name {
  font-size: 13px;
  color: #e0e0e0;
  text-align: center;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: #9e9e9e;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  line-height: 1;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #fff;
}

.panel-content {
  padding: 20px 24px;
  max-height: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

/* 自定义滚动条 */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #3a3a3a;
  border-radius: 4px;
  transition: background 0.3s;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}

/* 配置区块 */
.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-section label {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: 500;
}

.text-input,
.select-input {
  width: 100%;
  padding: 10px;
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.text-input:focus,
.select-input:focus {
  border-color: #1976d2;
}

.select-input {
  cursor: pointer;
}

/* 复选框样式 */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #1976d2;
}

.hint-text {
  margin-top: 4px;
  font-size: 12px;
  color: #9e9e9e;
  padding-left: 26px;
}

/* 角色介绍区域 */
.role-description-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header label {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-generate-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.ai-generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.ai-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.char-count {
  font-size: 12px;
  color: #9e9e9e;
}

.role-textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px;
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.3s;
  font-family: inherit;
}

.role-textarea:focus {
  border-color: #1976d2;
}

.variable-hint {
  margin-top: 8px;
  padding: 8px 12px;
  background: #2a2a2a;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 12px;
  color: #9e9e9e;
  line-height: 1.5;
}

.panel-content textarea {
  width: 100%;
  min-height: 150px;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.panel-content textarea:focus {
  border-color: #1976d2;
}

/* 历史消息轮数设置 */
.history-rounds-setting {
  margin-top: 16px;
  padding: 12px;
  background: #252525;
  border-radius: 4px;
  border: 1px solid #3a3a3a;
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.setting-header label {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: 500;
}

.rounds-value {
  font-size: 13px;
  color: #1976d2;
  font-weight: 500;
}

.rounds-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #3a3a3a;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.rounds-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: #1976d2;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.3s;
}

.rounds-slider::-webkit-slider-thumb:hover {
  background: #1565c0;
}

.rounds-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #1976d2;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.3s;
}

.rounds-slider::-moz-range-thumb:hover {
  background: #1565c0;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #9e9e9e;
}

/* 记忆功能区 */
.memory-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.memory-type-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.memory-type-section label {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: 500;
}

.current-memory-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clear-memory-btn {
  padding: 4px 12px;
  background: #d32f2f;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.3s;
}

.clear-memory-btn:hover {
  background: #c62828;
}

.memory-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px;
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.3s;
  font-family: inherit;
}

.memory-textarea:focus {
  border-color: #1976d2;
}

.panel-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
}

.save-btn,
.reset-btn,
.clear-history-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s;
}

.clear-history-btn {
  background: #d32f2f;
  color: white;
  flex: 1.5;
}

.clear-history-btn:hover {
  background: #c62828;
}

.save-btn {
  background: #1976d2;
  color: white;
}

.save-btn:hover {
  background: #1565c0;
}

.reset-btn {
  background: #424242;
  color: #e0e0e0;
}

.reset-btn:hover {
  background: #616161;
}

/* 隐藏日期分割线 */
:deep(.vac-date-divider) {
  display: none !important;
}

/* 隐藏“对话开始于”文本 */
:deep(.vac-text-started) {
  display: none !important;
}
</style>
