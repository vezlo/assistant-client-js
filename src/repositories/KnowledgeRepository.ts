import { SupabaseClient } from '@supabase/supabase-js';
import { KnowledgeItem, KnowledgeItemInput, SearchResult } from '../types';

export class KnowledgeRepository {
  constructor(
    private client: SupabaseClient,
    private tableName: string
  ) {}

  async create(item: KnowledgeItemInput, embedding?: number[]): Promise<string> {
    const insertData: any = {
      title: item.title,
      description: item.description,
      type: item.type,
      content: item.content,
      file_url: item.fileUrl,
      file_size: item.fileSize,
      file_type: item.fileType,
      metadata: item.metadata || {},
      created_by: item.createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (item.parentId) {
      const { data: parentData } = await this.client
        .from(this.tableName)
        .select('id')
        .eq('uuid', item.parentId)
        .single();
      
      if (parentData) insertData.parent_id = parentData.id;
    }

    if (embedding) {
      insertData.embedding = embedding;
      insertData.processed_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(insertData)
      .select('uuid')
      .single();

    if (error) throw new Error(`Failed to create knowledge item: ${error.message}`);
    return data.uuid;
  }

  async getById(itemId: string): Promise<KnowledgeItem | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('uuid', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get knowledge item: ${error.message}`);
    }

    return this.mapRow(data);
  }

  async update(itemId: string, updates: Partial<KnowledgeItemInput>, embedding?: number[]): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.fileUrl !== undefined) updateData.file_url = updates.fileUrl;
    if (updates.fileSize !== undefined) updateData.file_size = updates.fileSize;
    if (updates.fileType !== undefined) updateData.file_type = updates.fileType;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    if (embedding) {
      updateData.embedding = embedding;
      updateData.processed_at = new Date().toISOString();
    }

    const { error } = await this.client
      .from(this.tableName)
      .update(updateData)
      .eq('uuid', itemId);

    if (error) throw new Error(`Failed to update knowledge item: ${error.message}`);
  }

  async delete(itemId: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('uuid', itemId);

    if (error) throw new Error(`Failed to delete knowledge item: ${error.message}`);
  }

  async semanticSearch(queryEmbedding: number[], limit: number, threshold: number): Promise<SearchResult[]> {
    const { data, error } = await this.client.rpc('match_knowledge_items', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) throw new Error(`Semantic search failed: ${error.message}`);

    return (data || []).map((item: any) => ({
      uuid: item.uuid,
      title: item.title,
      description: item.description,
      content: item.content,
      type: item.type,
      score: item.similarity,
      metadata: item.metadata
    }));
  }

  async keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('uuid, title, description, content, type, metadata')
      .textSearch('title,description,content', query, {
        type: 'websearch',
        config: 'english'
      })
      .limit(limit);

    if (error) return [];

    return (data || []).map(item => ({
      uuid: item.uuid,
      title: item.title,
      description: item.description,
      content: item.content,
      type: item.type,
      score: 0.8,
      metadata: item.metadata
    }));
  }

  async listRecent(limit: number): Promise<KnowledgeItem[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to list knowledge items: ${error.message}`);
    return (data || []).map(row => this.mapRow(row));
  }

  private mapRow(row: any): KnowledgeItem {
    return {
      uuid: row.uuid,
      parentId: row.parent_id,
      title: row.title,
      description: row.description,
      type: row.type,
      content: row.content,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      fileType: row.file_type,
      metadata: row.metadata || {},
      embedding: row.embedding,
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

