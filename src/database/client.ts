import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AssistantAIConfig } from '../types';

export class DatabaseClient {
  private client: SupabaseClient;
  private tablePrefix: string;

  constructor(config: AssistantAIConfig) {
    this.client = createClient(config.dbUrl, config.dbKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    this.tablePrefix = config.tablePrefix || 'ai_';
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getTableName(table: string): string {
    return `${this.tablePrefix}${table}`;
  }
}

