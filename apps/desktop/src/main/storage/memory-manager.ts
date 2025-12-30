/**
 * 长期记忆管理器
 * 
 * 功能：
 * - 候选记忆生成（调用 LLM）
 * - 重要性筛选
 * - 记忆合并与更新
 * - 记忆注入到系统提示词
 */

import { getMemoryStorage, LongTermMemory, MemoryCategory } from './memory-storage';
import { Message } from './chat-storage';

/**
 * 配置常量
 */
export const MEMORY_CONFIG = {
  // 重要性阈值（可后续暴露到设置界面）
  IMPORTANCE_THRESHOLD: 60,
  
  // 注入记忆最大字数（防止上下文爆炸）
  MAX_INJECT_CHARS: 800,
  
  // 相似度阈值（用于去重）
  SIMILARITY_THRESHOLD: 0.7
};

/**
 * LLM 配置接口
 */
export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

/**
 * 候选记忆
 */
interface CandidateMemory {
  category: MemoryCategory;
  text: string;
  importance: number;  // 0-100
  reasoning: string;   // LLM 给出的理由
}

export class MemoryManager {
  private storage = getMemoryStorage();

  /**
   * 生成候选长期记忆
   * @param conversationId 对话 ID
   * @param assistantId 助手 ID
   * @param recentMessages 最近 N 轮对话
   * @param llmConfig LLM 配置
   */
  async generateCandidateMemories(
    conversationId: string,
    assistantId: string,
    recentMessages: Message[],
    llmConfig: LLMConfig
  ): Promise<CandidateMemory[]> {
    console.log('[MemoryManager] 开始生成候选记忆，消息数:', recentMessages.length);

    // 🔥 获取历史记忆（全量重生成）
    const existingMemories = this.storage.getMemoriesByConversation(conversationId, assistantId);
    console.log('[MemoryManager] 历史记忆数:', existingMemories.length);

    // 构建对话文本
    const dialogText = recentMessages
      .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
      .join('\n');

    console.log('[MemoryManager] 对话文本:', dialogText);

    // 🔥 构建包含历史记忆的提示词
    const prompt = this.buildMemoryGenerationPrompt(dialogText, existingMemories);

    console.log('[MemoryManager] 提示词:', prompt);
    console.log('[MemoryManager] LLM 配置:', { endpoint: llmConfig.endpoint, model: llmConfig.model, hasApiKey: !!llmConfig.apiKey });

    try {
      // 调用 LLM 生成候选记忆
      const response = await fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content: '你是一个记忆提取专家，负责从对话中提取有价值的长期记忆。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,  // 低温度确保稳定输出
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MemoryManager] LLM 请求失败:', response.status, response.statusText);
        console.error('[MemoryManager] 错误详情:', errorText);
        
        // 🔥 抛出错误，让上层捕获并传给渲染进程
        throw new Error(`LLM API 错误: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = (data as any).choices?.[0]?.message?.content || '';

      // 临时调试：打印 LLM 返回内容
      console.log('[MemoryManager] LLM 返回内容:', content);

      // 解析 LLM 返回的 JSON
      const candidates = this.parseMemoryCandidates(content);
      console.log('[MemoryManager] 生成候选记忆:', candidates.length, '条');

      return candidates;
    } catch (error) {
      console.error('[MemoryManager] 生成候选记忆失败:', error);
      return [];
    }
  }

  /**
   * 筛选并保存重要记忆（全量重生成模式）
   * @param conversationId 对话 ID
   * @param assistantId 助手 ID
   * @param candidates 候选记忆列表
   * @param threshold 重要性阈值（默认使用配置）
   */
  async filterAndSaveMemories(
    conversationId: string,
    assistantId: string,
    candidates: CandidateMemory[],
    threshold: number = MEMORY_CONFIG.IMPORTANCE_THRESHOLD
  ): Promise<LongTermMemory[]> {
    console.log('[MemoryManager] 筛选记忆，阈值:', threshold);

    // 🔥 全量重生成：清空旧记忆
    console.log('[MemoryManager] 清空旧记忆...');
    this.storage.clearMemories(conversationId, assistantId);

    const saved: LongTermMemory[] = [];

    for (const candidate of candidates) {
      // 重要性筛选
      if (candidate.importance < threshold) {
        console.log('[MemoryManager] 跳过低重要性记忆:', candidate.text.substring(0, 30), '重要性:', candidate.importance);
        continue;
      }

      // 保存新记忆
      const memory = this.storage.saveMemory({
        conversationId,
        assistantId,
        category: candidate.category,
        text: candidate.text,
        weight: candidate.importance
      });

      saved.push(memory);
    }

    console.log('[MemoryManager] 保存记忆:', saved.length, '条');
    return saved;
  }

  /**
   * 合并或更新相似记忆
   * @param conversationId 对话 ID
   * @param assistantId 助手 ID
   * @param newText 新记忆文本
   * @param category 记忆分类
   * @param llmConfig LLM 配置
   */
  async mergeOrUpdateMemory(
    conversationId: string,
    assistantId: string,
    newText: string,
    category: MemoryCategory,
    llmConfig: LLMConfig
  ): Promise<void> {
    console.log('[MemoryManager] 合并记忆:', newText.substring(0, 30));

    // 获取同类别的已有记忆
    const existingMemories = this.storage.getMemoriesByCategory(conversationId, assistantId, category);

    if (existingMemories.length === 0) {
      // 没有已有记忆，直接保存
      this.storage.saveMemory({
        conversationId,
        assistantId,
        category,
        text: newText,
        weight: 70
      });
      return;
    }

    // 调用 LLM 判断是否需要合并
    const prompt = this.buildMergePrompt(newText, existingMemories);

    try {
      const response = await fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content: '你是一个记忆合并专家，负责将新信息与已有记忆合并或更新。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        console.error('[MemoryManager] LLM 合并请求失败');
        return;
      }

      const data = await response.json();
      const content = (data as any).choices?.[0]?.message?.content || '';

      // 解析合并结果
      const mergeResult = this.parseMergeResult(content);

      if (mergeResult.action === 'merge' && mergeResult.targetId) {
        // 合并到已有记忆
        this.storage.updateMemory(mergeResult.targetId, {
          text: mergeResult.mergedText!,
          weight: Math.min(100, mergeResult.newWeight!)
        });
        console.log('[MemoryManager] 已合并记忆:', mergeResult.targetId);
      } else if (mergeResult.action === 'new') {
        // 创建新记忆
        this.storage.saveMemory({
          conversationId,
          assistantId,
          category,
          text: newText,
          weight: 70
        });
        console.log('[MemoryManager] 创建新记忆');
      }
    } catch (error) {
      console.error('[MemoryManager] 合并记忆失败:', error);
    }
  }

  /**
   * 检索相关记忆并注入系统提示词
   * @param conversationId 对话 ID
   * @param assistantId 助手 ID
   * @param currentContext 当前对话上下文
   * @param limit 返回记忆数量
   * @param llmConfig LLM 配置（用于压缩）
   */
  async getRelevantMemoriesForPrompt(
    conversationId: string,
    assistantId: string,
    currentContext: string,
    limit: number = 5,
    llmConfig?: LLMConfig
  ): Promise<string> {
    // 获取最近更新的记忆
    const recentMemories = this.storage.getRecentMemories(conversationId, assistantId, limit);

    if (recentMemories.length === 0) {
      return this.formatMemoryBlock('');
    }

    // 格式化为系统提示词（包含分类和重要度）
    const memoryText = recentMemories
      .map(mem => `- [${this.getCategoryLabel(mem.category)}][重要度: ${mem.weight}] ${mem.text}`)
      .join('\n');

    // 检查是否超过最大字数限制
    if (memoryText.length > MEMORY_CONFIG.MAX_INJECT_CHARS && llmConfig) {
      console.log(`[MemoryManager] 记忆过长 (${memoryText.length} 字)，开始压缩...`);
      
      try {
        // 调用 LLM 压缩记忆
        const compressed = await this.compressMemories(memoryText, llmConfig);
        return this.formatMemoryBlock(compressed);
      } catch (error) {
        console.error('[MemoryManager] 记忆压缩失败，使用原文:', error);
        // 如果压缩失败，截断到最大字数
        return this.formatMemoryBlock(memoryText.substring(0, MEMORY_CONFIG.MAX_INJECT_CHARS) + '...');
      }
    }

    return this.formatMemoryBlock(memoryText);
  }

  /**
   * 清空指定对话的所有记忆
   */
  clearMemories(conversationId: string, assistantId: string): void {
    this.storage.clearMemories(conversationId, assistantId);
  }

  /**
   * 获取记忆统计
   */
  getMemoryStats(conversationId: string, assistantId: string) {
    return this.storage.getStats(conversationId, assistantId);
  }

  /**
   * 获取所有记忆（用于 UI 显示）
   */
  getAllMemories(conversationId: string, assistantId: string): LongTermMemory[] {
    return this.storage.getMemoriesByConversation(conversationId, assistantId);
  }

  /**
   * 构建记忆生成提示词（全量重生成模式）
   */
  private buildMemoryGenerationPrompt(dialogText: string, existingMemories?: LongTermMemory[]): string {
    // 🔥 构建历史记忆文本
    let existingMemoryText = '';
    if (existingMemories && existingMemories.length > 0) {
      existingMemoryText = `

【当前已有记忆】（请在新对话基础上重新整理，如果新对话与旧记忆矛盾，以新信息为准）：
${ existingMemories.map(m => `- [${this.getCategoryLabel(m.category)}][重要度: ${m.weight}] ${m.text}`).join('\n')}`;
    }

    return `请分析以下对话，${existingMemories && existingMemories.length > 0 ? '结合已有记忆，重新整理所有长期记忆' : '提取有价值的长期记忆'}。

【最近对话】：
${dialogText}${existingMemoryText}

记忆分类：
- fact: 客观事实（如职业、爱好、家庭状况）
- preference: 用户偏好（如喜欢的食物、风格）
- relationship: 关系信息（如称呼、亲密度）
- project: 项目或任务信息
- event: 重要事件

请以 JSON 数组格式返回整理后的记忆（覆盖所有旧记忆）：
[
  {
    "category": "fact",
    "text": "用户是一名软件工程师",
    "importance": 80,
    "reasoning": "这是用户的职业信息，对后续对话很重要"
  }
]

重要要求：
1. 如果新对话纠正了旧记忆（如"开玩笑的，没病"纠正"得了绝症"），应该删除或更新旧记忆
2. 如果新对话补充了旧记忆，应该合并
3. 每条记忆文本简洁自然（1-2句话）
4. importance 范围 0-100，只提取重要性 ≥ 60 的信息
5. 不要提取临时性、无意义的信息
6. 如果没有值得记忆的内容，返回空数组 []

请只返回 JSON，不要其他解释。`;
  }

  /**
   * 构建记忆合并提示词
   */
  private buildMergePrompt(newText: string, existingMemories: LongTermMemory[]): string {
    const existingText = existingMemories
      .map((mem, idx) => `${idx + 1}. [ID: ${mem.id}] ${mem.text}`)
      .join('\n');

    return `新信息：${newText}

已有记忆：
${existingText}

请判断：
1. 新信息是否与已有记忆重复？
2. 是否需要合并到某条已有记忆？
3. 还是应该作为新记忆保存？

请以 JSON 格式返回：
{
  "action": "merge" 或 "new",
  "targetId": "要合并的记忆 ID（仅 action=merge 时）",
  "mergedText": "合并后的文本（仅 action=merge 时）",
  "newWeight": 更新后的重要性 0-100,
  "reasoning": "判断理由"
}

请只返回 JSON，不要其他解释。`;
  }

  /**
   * 解析候选记忆
   */
  private parseMemoryCandidates(content: string): CandidateMemory[] {
    try {
      // 移除可能的 markdown 代码块标记
      const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonText);

      if (!Array.isArray(parsed)) {
        console.warn('[MemoryManager] LLM 返回非数组格式');
        return [];
      }

      return parsed.filter(item => 
        item.category && item.text && typeof item.importance === 'number'
      );
    } catch (error) {
      console.error('[MemoryManager] 解析候选记忆失败:', error);
      return [];
    }
  }

  /**
   * 解析合并结果
   */
  private parseMergeResult(content: string): {
    action: 'merge' | 'new';
    targetId?: string;
    mergedText?: string;
    newWeight?: number;
  } {
    try {
      const jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('[MemoryManager] 解析合并结果失败:', error);
      return { action: 'new' };
    }
  }

  /**
   * 检查记忆是否重复
   */
  private checkDuplicate(newText: string, existingMemories: LongTermMemory[]): boolean {
    const newLower = newText.toLowerCase();
    
    for (const existing of existingMemories) {
      const existingLower = existing.text.toLowerCase();
      
      // 简单相似度检查（实际可用更复杂的算法）
      if (this.calculateSimilarity(newLower, existingLower) > 0.7) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 计算文本相似度（简单实现）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * 压缩记忆文本（调用 LLM）
   */
  private async compressMemories(memoryText: string, llmConfig: LLMConfig): Promise<string> {
    const prompt = `请将以下长期记忆压缩成更简洁的版本，保留核心信息，控制在 ${MEMORY_CONFIG.MAX_INJECT_CHARS} 字以内：

${memoryText}

请直接返回压缩后的记忆，每条一行，以 "- " 开头。`;

    const response = await fetch(llmConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: '你是记忆压缩专家，擅长提炼关键信息。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error('LLM 压缩请求失败');
    }

    const data = await response.json();
    return (data as any).choices?.[0]?.message?.content || memoryText;
  }

 /**
   * 格式化记忆块（显式区分与系统提示词）
   */
  private formatMemoryBlock(memoryText: string): string {
    // 记忆为空时的处理
    if (!memoryText.trim()) {
      return `

----【长期记忆】----
（当前没有可用的长期记忆。）
----【长期记忆结束】----
`;
    }

    return `

你是一名桌面数字人助手，需要在与用户对话时自然地利用你对ta的长期记忆，
但不能直接暴露"记忆系统"的存在。

下面是你当前掌握的【长期记忆】，这些信息可能并不完整，也可能有部分已经过时，
但可以帮助你更好地理解用户、延续之前的对话风格和偏好：

----【长期记忆开始】----
${memoryText}
----【长期记忆结束】----

使用这些记忆时，请遵守以下原则：
1. 只在与当前问题相关时使用记忆，不要强行引用无关内容。
2. 如果记忆与用户最新说的话发生冲突，以「用户当前说法」为准，并温和地根据新信息更新你的理解。
3. 不要向用户说明"我在调用记忆""我记得我记录过……"，而是自然地表现出"熟悉感"。
4. 不要逐条复述记忆的原文，更不要暴露记忆的内部格式（例如"category""重要度"等词）。
5. 如果你不确定记忆是否仍然有效，可以先向用户确认，而不是武断下结论。
`;
  }

  /**
   * 获取分类标签
   */
  private getCategoryLabel(category: MemoryCategory): string {
    const labels = {
      fact: '事实',
      preference: '偏好',
      relationship: '关系',
      project: '项目',
      event: '事件'
    };
    return labels[category] || category;
  }
}

// 单例模式
let memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}
