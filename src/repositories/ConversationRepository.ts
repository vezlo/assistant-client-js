import { SupabaseClient } from '@supabase/supabase-js';
import { Conversation } from '../types';

export class ConversationRepository {
  constructor(
    private client: SupabaseClient,
    private tableName: string
  ) {}

  async create(userId: string, title: string): Promise<Conversation> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert({
        creator_id: userId,
        title,
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return this.mapRow(data);
  }

  async getById(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('uuid', conversationId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return this.mapRow(data);
  }

  async listByUser(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('creator_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Failed to list conversations: ${error.message}`);
    return (data || []).map(row => this.mapRow(row));
  }

  async updateMessageCount(conversationId: string, count: number): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .update({
        message_count: count,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', conversationId);

    if (error) throw new Error(`Failed to update conversation: ${error.message}`);
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', conversationId);

    if (error) throw new Error(`Failed to update conversation title: ${error.message}`);
  }

  async delete(conversationId: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('uuid', conversationId);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
    return true;
  }

  private mapRow(row: any): Conversation {
    return {
      uuid: row.uuid,
      creatorId: row.creator_id,
      title: row.title,
      messageCount: row.message_count || 0,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }
}

