/**
 * Secure Storage Manager
 * 
 * 使用 electron-store 的加密功能安全存储敏感信息(API Keys)
 * 跨平台兼容，无需原生模块依赖
 */

import Store from 'electron-store';

const SERVICE_NAME = 'Desktop Pet AI';

export class SecureStorage {
  private store: Store;

  constructor() {
    this.store = new Store({
      name: 'config',
      encryptionKey: 'desktop-pet-config-encryption-key', // In production, use unique key per installation
    });
  }

  /**
   * Store API key securely (encrypted by electron-store)
   */
  async setApiKey(keyRef: string, apiKey: string): Promise<void> {
    try {
      this.store.set(`apikey_${keyRef}`, apiKey);
      console.log(`API key stored (encrypted): ${keyRef}`);
    } catch (error) {
      console.error(`Failed to store API key: ${keyRef}`, error);
      throw new Error(`Failed to store API key: ${error}`);
    }
  }

  /**
   * Retrieve API key (decrypted by electron-store)
   */
  async getApiKey(keyRef: string): Promise<string | null> {
    try {
      const apiKey = this.store.get(`apikey_${keyRef}`) as string | undefined;
      return apiKey || null;
    } catch (error) {
      console.error(`Failed to retrieve API key: ${keyRef}`, error);
      return null;
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(keyRef: string): Promise<boolean> {
    try {
      this.store.delete(`apikey_${keyRef}`);
      console.log(`API key deleted: ${keyRef}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete API key: ${keyRef}`, error);
      return false;
    }
  }

  /**
   * Store non-sensitive configuration
   */
  setConfig(key: string, value: any): void {
    this.store.set(key, value);
  }

  /**
   * Retrieve configuration
   */
  getConfig(key: string, defaultValue?: any): any {
    return this.store.get(key, defaultValue);
  }

  /**
   * Delete configuration
   */
  deleteConfig(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get all configuration
   */
  getAllConfig(): Record<string, any> {
    return this.store.store;
  }

  /**
   * Clear all configuration (use with caution)
   */
  clearAllConfig(): void {
    this.store.clear();
  }
}

// Singleton instance
let instance: SecureStorage | null = null;

export function getSecureStorage(): SecureStorage {
  if (!instance) {
    instance = new SecureStorage();
  }
  return instance;
}
