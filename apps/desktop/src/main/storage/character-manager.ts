/**
 * Character Profile Manager
 * 
 * 管理角色配置文件（CharacterProfile）
 */

import { getSecureStorage } from './secure-storage';
import { v4 as uuidv4 } from 'uuid';

// Inline type definitions
export interface CharacterProfile {
  id: string;
  name: string;
  live2d: {
    modelPath: string;
    scale: number;
    position: { x: number; y: number };
    opacity: number;
    alwaysOnTop: boolean;
  };
  llm: {
    provider: 'qwen' | 'openrouter';
    baseUrl: string;
    apiKeyRef: string;
    model: string;
    temperature: number;
  };
  tts: {
    provider: 'volcengine';
    apiKeyRef: string;
    appId: string;
    voiceType: string;
    speed: number;
    volume: number;
  };
}

export class CharacterManager {
  private storage = getSecureStorage();
  private profiles: Map<string, CharacterProfile> = new Map();

  constructor() {
    this.loadProfiles();
  }

  /**
   * Load all character profiles from storage
   */
  private loadProfiles(): void {
    const profilesData = this.storage.getConfig('character_profiles', []);
    this.profiles = new Map(profilesData.map((p: CharacterProfile) => [p.id, p]));
    console.log(`Loaded ${this.profiles.size} character profiles`);
  }

  /**
   * Save all profiles to storage
   */
  private saveProfiles(): void {
    const profilesArray = Array.from(this.profiles.values());
    this.storage.setConfig('character_profiles', profilesArray);
  }

  /**
   * Create a new character profile
   */
  async createProfile(profile: Omit<CharacterProfile, 'id'>): Promise<CharacterProfile> {
    const newProfile: CharacterProfile = {
      id: uuidv4(),
      ...profile,
    };

    this.profiles.set(newProfile.id, newProfile);
    this.saveProfiles();
    
    console.log(`Created character profile: ${newProfile.name} (${newProfile.id})`);
    return newProfile;
  }

  /**
   * Get a character profile by ID
   */
  getProfile(id: string): CharacterProfile | null {
    return this.profiles.get(id) || null;
  }

  /**
   * Update an existing character profile
   */
  async updateProfile(id: string, updates: Partial<CharacterProfile>): Promise<CharacterProfile | null> {
    const profile = this.profiles.get(id);
    if (!profile) {
      console.error(`Profile not found: ${id}`);
      return null;
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.profiles.set(id, updatedProfile);
    this.saveProfiles();
    
    console.log(`Updated character profile: ${id}`);
    return updatedProfile;
  }

  /**
   * Delete a character profile
   */
  async deleteProfile(id: string): Promise<boolean> {
    const profile = this.profiles.get(id);
    if (!profile) {
      return false;
    }

    // Delete associated API keys
    try {
      await this.storage.deleteApiKey(profile.llm.apiKeyRef);
      await this.storage.deleteApiKey(profile.tts.apiKeyRef);
    } catch (error) {
      console.error('Error deleting API keys:', error);
    }

    this.profiles.delete(id);
    this.saveProfiles();
    
    console.log(`Deleted character profile: ${id}`);
    return true;
  }

  /**
   * List all character profiles
   */
  listProfiles(): CharacterProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get API key for a character's LLM
   */
  async getLLMApiKey(profileId: string): Promise<string | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return null;
    }
    return await this.storage.getApiKey(profile.llm.apiKeyRef);
  }

  /**
   * Get API key for a character's TTS
   */
  async getTTSApiKey(profileId: string): Promise<string | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return null;
    }
    return await this.storage.getApiKey(profile.tts.apiKeyRef);
  }

  /**
   * Set API key for a character's LLM
   */
  async setLLMApiKey(profileId: string, apiKey: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    await this.storage.setApiKey(profile.llm.apiKeyRef, apiKey);
  }

  /**
   * Set API key for a character's TTS
   */
  async setTTSApiKey(profileId: string, apiKey: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }
    await this.storage.setApiKey(profile.tts.apiKeyRef, apiKey);
  }
}

// Singleton instance
let instance: CharacterManager | null = null;

export function getCharacterManager(): CharacterManager {
  if (!instance) {
    instance = new CharacterManager();
  }
  return instance;
}
