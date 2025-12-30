/**
 * 长期记忆存储服务
 * 
 * 功能：
 * - 持久化存储长期记忆
 * - 支持记忆分类、检索、更新、合并
 * - 预留云端同步接口
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * 长期记忆类型
 */
export type MemoryCategory = 'fact' | 'preference' | 'relationship' | 'project' | 'event';

/**
 * 长期记忆接口
 */
export interface LongTermMemory {
  id: string;
  conversationId: string;  // 关联的对话 ID
  assistantId: string;     // 助手/角色 ID（多角色隔离）
  category: MemoryCategory;
  text: string;
  weight: number;  // 重要性评分 0-100
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'pending';
}

export class MemoryStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // 数据库文件位置：%APPDATA%/desktop-pet/memory.db
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'database');
    
    // 确保目录存在
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = join(dbDir, 'memory.db');
    this.db = new Database(this.dbPath);
    
    // 初始化数据库表
    this.initDatabase();
    
    console.log('✅ 长期记忆数据库已初始化:', this.dbPath);
  }

  /**
   * 初始化数据库表结构
   */
  private initDatabase(): void {
    // 长期记忆表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS long_term_memories (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        assistant_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('fact', 'preference', 'relationship', 'project', 'event')),
        text TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 50,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local'
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_conversation 
      ON long_term_memories(conversation_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_assistant 
      ON long_term_memories(assistant_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_conv_assistant 
      ON long_term_memories(conversation_id, assistant_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_category 
      ON long_term_memories(category)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_weight 
      ON long_term_memories(weight DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_updated 
      ON long_term_memories(updated_at DESC)
    `);
  }

  /**
   * 保存长期记忆
   */
  saveMemory(memory: Omit<LongTermMemory, 'id' | 'createdAt' | 'updatedAt'>): LongTermMemory {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const fullMemory: LongTermMemory = {
      id,
      ...memory,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'local'
    };

    const stmt = this.db.prepare(`
      INSERT INTO long_term_memories 
      (id, conversation_id, assistant_id, category, text, weight, created_at, updated_at, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.conversationId,
      memory.assistantId,
      memory.category,
      memory.text,
      memory.weight,
      now,
      now,
      'local'
    );

    console.log('[MemoryStorage] 保存长期记忆:', { id, assistantId: memory.assistantId, category: memory.category, text: memory.text.substring(0, 50) });
    return fullMemory;
  }

  /**
   * 更新长期记忆
   */
  updateMemory(id: string, updates: Partial<Pick<LongTermMemory, 'text' | 'weight' | 'category'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.text !== undefined) {
      fields.push('text = ?');
      values.push(updates.text);
    }
    if (updates.weight !== undefined) {
      fields.push('weight = ?');
      values.push(updates.weight);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE long_term_memories SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    console.log('[MemoryStorage] 更新长期记忆:', { id, updates });
  }

  /**
   * 删除长期记忆
   */
  deleteMemory(id: string): void {
    const stmt = this.db.prepare('DELETE FROM long_term_memories WHERE id = ?');
    stmt.run(id);
    console.log('[MemoryStorage] 删除长期记忆:', id);
  }

  /**
   * 获取指定对话的所有长期记忆
   */
  getMemoriesByConversation(conversationId: string, assistantId: string, limit?: number): LongTermMemory[] {
    let sql = `
      SELECT 
        id,
        conversation_id as conversationId,
        assistant_id as assistantId,
        category,
        text,
        weight,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM long_term_memories
      WHERE conversation_id = ? AND assistant_id = ?
      ORDER BY weight DESC, updated_at DESC
    `;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(conversationId, assistantId) as LongTermMemory[];
  }

  /**
   * 按分类获取记忆
   */
  getMemoriesByCategory(conversationId: string, assistantId: string, category: MemoryCategory, limit?: number): LongTermMemory[] {
    let sql = `
      SELECT 
        id,
        conversation_id as conversationId,
        assistant_id as assistantId,
        category,
        text,
        weight,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM long_term_memories
      WHERE conversation_id = ? AND assistant_id = ? AND category = ?
      ORDER BY weight DESC, updated_at DESC
    `;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(conversationId, assistantId, category) as LongTermMemory[];
  }

  /**
   * 搜索记忆（简单文本匹配）
   */
  searchMemories(conversationId: string, assistantId: string, keyword: string, limit?: number): LongTermMemory[] {
    let sql = `
      SELECT 
        id,
        conversation_id as conversationId,
        assistant_id as assistantId,
        category,
        text,
        weight,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM long_term_memories
      WHERE conversation_id = ? AND assistant_id = ? AND text LIKE ?
      ORDER BY weight DESC, updated_at DESC
    `;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(conversationId, assistantId, `%${keyword}%`) as LongTermMemory[];
  }

  /**
   * 获取最近更新的记忆
   */
  getRecentMemories(conversationId: string, assistantId: string, limit: number = 5): LongTermMemory[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        conversation_id as conversationId,
        assistant_id as assistantId,
        category,
        text,
        weight,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM long_term_memories
      WHERE conversation_id = ? AND assistant_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    return stmt.all(conversationId, assistantId, limit) as LongTermMemory[];
  }

  /**
   * 清空指定对话+助手的所有长期记忆
   */
  clearMemories(conversationId: string, assistantId: string): void {
    const stmt = this.db.prepare('DELETE FROM long_term_memories WHERE conversation_id = ? AND assistant_id = ?');
    const result = stmt.run(conversationId, assistantId);
    console.log(`[MemoryStorage] 清空对话 ${conversationId} (助手: ${assistantId}) 的所有记忆，共删除 ${result.changes} 条`);
  }

  /**
   * 获取统计信息
   */
  getStats(conversationId?: string, assistantId?: string) {
    if (conversationId && assistantId) {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM long_term_memories WHERE conversation_id = ? AND assistant_id = ?');
      const count = countStmt.get(conversationId, assistantId) as { count: number };

      const categoryStmt = this.db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM long_term_memories 
        WHERE conversation_id = ? AND assistant_id = ?
        GROUP BY category
      `);
      const byCategory = categoryStmt.all(conversationId, assistantId) as Array<{ category: string; count: number }>;

      return {
        total: count.count,
        byCategory,
        dbPath: this.dbPath
      };
    } else {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM long_term_memories');
      const count = countStmt.get() as { count: number };

      return {
        total: count.count,
        dbPath: this.dbPath
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

// 单例模式
let memoryStorage: MemoryStorage | null = null;

export function getMemoryStorage(): MemoryStorage {
  if (!memoryStorage) {
    memoryStorage = new MemoryStorage();
  }
  return memoryStorage;
}
