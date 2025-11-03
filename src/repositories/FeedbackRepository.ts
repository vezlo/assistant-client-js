import { SupabaseClient } from '@supabase/supabase-js';
import { MessageFeedback } from '../types';

export class FeedbackRepository {
  constructor(
    private client: SupabaseClient,
    private tableName: string,
    private messageTableName: string
  ) {}

  async create(
    messageId: string,
    userId: string,
    rating: 'positive' | 'negative',
    options?: {
      category?: string;
      comment?: string;
      suggestedImprovement?: string;
    }
  ): Promise<MessageFeedback> {
    // Get message internal ID
    const { data: msgData, error: msgError } = await this.client
      .from(this.messageTableName)
      .select('id')
      .eq('uuid', messageId)
      .single();

    if (msgError) throw new Error(`Message not found: ${msgError.message}`);

    const { data, error } = await this.client
      .from(this.tableName)
      .insert({
        message_id: msgData.id,
        user_id: userId,
        rating,
        category: options?.category,
        comment: options?.comment,
        suggested_improvement: options?.suggestedImprovement,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create feedback: ${error.message}`);
    return this.mapRow(data, messageId);
  }

  async getByMessage(messageId: string): Promise<MessageFeedback[]> {
    // Get message internal ID
    const { data: msgData, error: msgError } = await this.client
      .from(this.messageTableName)
      .select('id')
      .eq('uuid', messageId)
      .single();

    if (msgError) throw new Error(`Message not found: ${msgError.message}`);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('message_id', msgData.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get feedback: ${error.message}`);
    return (data || []).map(row => this.mapRow(row, messageId));
  }

  async getByUser(userId: string, limit = 50): Promise<MessageFeedback[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(`
        *,
        ${this.messageTableName}!inner(uuid)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get user feedback: ${error.message}`);
    
    return (data || []).map(row => {
      const messageUuid = (row as any)[this.messageTableName]?.uuid;
      return this.mapRow(row, messageUuid);
    });
  }

  private mapRow(row: any, messageId: string): MessageFeedback {
    return {
      uuid: row.uuid,
      messageId,
      userId: row.user_id,
      rating: row.rating,
      category: row.category,
      comment: row.comment,
      suggestedImprovement: row.suggested_improvement,
      createdAt: new Date(row.created_at)
    };
  }
}

