import { SupabaseClient } from '@supabase/supabase-js';
import { Message } from '../types';

export class MessageRepository {
  constructor(
    private client: SupabaseClient,
    private tableName: string,
    private conversationTableName: string
  ) {}

  async create(
    conversationId: string,
    type: 'user' | 'assistant' | 'system',
    content: string,
    parentMessageId?: string,
    metadata?: Record<string, any>
  ): Promise<Message> {
    // Get conversation internal ID
    const { data: convData, error: convError } = await this.client
      .from(this.conversationTableName)
      .select('id')
      .eq('uuid', conversationId)
      .single();

    if (convError) throw new Error(`Conversation not found: ${convError.message}`);

    // Get parent message internal ID if provided
    let parentId = null;
    if (parentMessageId) {
      const { data: parentData } = await this.client
        .from(this.tableName)
        .select('id')
        .eq('uuid', parentMessageId)
        .single();
      
      if (parentData) parentId = parentData.id;
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .insert({
        conversation_id: convData.id,
        parent_message_id: parentId,
        type,
        content,
        status: 'completed',
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return this.mapRow(data, conversationId);
  }

  async getById(messageId: string): Promise<Message | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(`
        *,
        ${this.conversationTableName}!inner(uuid)
      `)
      .eq('uuid', messageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get message: ${error.message}`);
    }

    const conversationUuid = (data as any)[this.conversationTableName]?.uuid;
    return this.mapRow(data, conversationUuid);
  }

  async listByConversation(conversationId: string, limit = 50): Promise<Message[]> {
    // Get conversation internal ID
    const { data: convData, error: convError } = await this.client
      .from(this.conversationTableName)
      .select('id')
      .eq('uuid', conversationId)
      .single();

    if (convError) throw new Error(`Conversation not found: ${convError.message}`);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('conversation_id', convData.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to list messages: ${error.message}`);
    return (data || []).map(row => this.mapRow(row, conversationId));
  }

  async updateStatus(messageId: string, status: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('uuid', messageId);

    if (error) throw new Error(`Failed to update message status: ${error.message}`);
  }

  private mapRow(row: any, conversationId: string): Message {
    return {
      uuid: row.uuid,
      conversationId,
      parentMessageId: row.parent_message_id,
      type: row.type,
      content: row.content,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

