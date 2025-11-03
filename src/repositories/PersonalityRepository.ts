import { SupabaseClient } from '@supabase/supabase-js';
import { Personality, PersonalityProfile } from '../types';

export class PersonalityRepository {
  constructor(
    private client: SupabaseClient,
    private tableName: string
  ) {}

  async get(): Promise<Personality | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('last_built_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get personality: ${error.message}`);
    }

    return this.mapRow(data);
  }

  async save(
    name: string,
    systemPrompt: string,
    profile?: PersonalityProfile
  ): Promise<Personality> {
    // Delete existing personality (we only keep one)
    await this.client.from(this.tableName).delete().neq('uuid', '00000000-0000-0000-0000-000000000000');

    const { data, error } = await this.client
      .from(this.tableName)
      .insert({
        name,
        description: profile?.description,
        system_prompt: systemPrompt,
        metadata: profile ? { tone: profile.tone, domain: profile.domain } : {},
        last_built_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save personality: ${error.message}`);
    return this.mapRow(data);
  }

  private mapRow(row: any): Personality {
    const metadata = row.metadata || {};
    return {
      uuid: row.uuid,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      metadata,
      lastBuiltAt: new Date(row.last_built_at)
    };
  }
}

