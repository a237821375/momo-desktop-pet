/**
 * 聊天历史存储服务
 * 
 * 功能：
 * - 本地 SQLite 存储聊天记录
 * - 支持多对话管理
 * - 预留云端同步接口
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'pending'; // 预留：云端同步状态
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  syncStatus?: 'local' | 'synced' | 'pending'; // 预留：云端同步状态
}

export class ChatStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // 数据库文件位置：%APPDATA%/desktop-pet/chat-history.db
    const userDataPath = app.getPath('userData');
    const dbDir = join(userDataPath, 'database');
    
    // 确保目录存在
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = join(dbDir, 'chat-history.db');
    this.db = new Database(this.dbPath);
    
    // 初始化数据库表
    this.initDatabase();
    
    console.log('✅ 聊天历史数据库已初始化:', this.dbPath);
  }

  /**
   * 初始化数据库表结构
   */
  private initDatabase(): void {
    // 对话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local'
      )
    `);

    // 消息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'local',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id, timestamp DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_updated 
      ON conversations(updated_at DESC)
    `);
  }

  /**
   * 创建新对话
   */
  createConversation(title: string): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const conversation: Conversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'local'
    };

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, sync_status)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, title, now, now, 'local');

    return conversation;
  }

  /**
   * 获取所有对话列表
   */
  getConversations(): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        title,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM conversations
      ORDER BY updated_at DESC
    `);

    return stmt.all() as Conversation[];
  }

  /**
   * 获取单个对话
   */
  getConversation(id: string): Conversation | undefined {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        title,
        created_at as createdAt,
        updated_at as updatedAt,
        sync_status as syncStatus
      FROM conversations
      WHERE id = ?
    `);

    return stmt.get(id) as Conversation | undefined;
  }

  /**
   * 更新对话标题
   */
  updateConversationTitle(id: string, title: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET title = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(title, Date.now(), id);
  }

  /**
   * 删除对话（级联删除消息）
   */
  deleteConversation(id: string): void {
    const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 保存消息
   */
  saveMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    const fullMessage: Message = {
      id,
      ...message,
      timestamp,
      syncStatus: 'local'
    };

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      message.conversationId,
      message.role,
      message.content,
      timestamp,
      'local'
    );

    // 更新对话的 updated_at
    this.updateConversationTimestamp(message.conversationId);

    return fullMessage;
  }

  /**
   * 获取对话的所有消息
   */
  getMessages(conversationId: string, limit?: number): Message[] {
    let sql = `
      SELECT 
        id,
        conversation_id as conversationId,
        role,
        content,
        timestamp,
        sync_status as syncStatus
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `;

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(conversationId) as Message[];
  }

  /**
   * 删除消息
   */
  deleteMessage(id: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 更新对话时间戳
   */
  private updateConversationTimestamp(conversationId: string): void {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET updated_at = ?
      WHERE id = ?
    `);

    stmt.run(Date.now(), conversationId);
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    const conversationCount = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
    const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

    return {
      conversations: conversationCount.count,
      messages: messageCount.count,
      dbPath: this.dbPath
    };
  }

  /**
   * 预留：云端同步接口
   * 付费版本实现时使用
   */
  async syncToCloud(): Promise<void> {
    // TODO: 实现云端同步逻辑
    // 1. 获取 sync_status = 'pending' 的数据
    // 2. 调用云端 API 上传
    // 3. 更新 sync_status = 'synced'
    console.log('云端同步功能待实现（付费版）');
  }

  /**
   * 预留：从云端拉取数据
   */
  async syncFromCloud(): Promise<void> {
    // TODO: 实现从云端拉取逻辑
    console.log('云端拉取功能待实现（付费版）');
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

// 单例模式
let chatStorage: ChatStorage | null = null;

export function getChatStorage(): ChatStorage {
  if (!chatStorage) {
    chatStorage = new ChatStorage();
  }
  return chatStorage;
}
