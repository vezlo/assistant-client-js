import { KnowledgeRepository } from '../repositories/KnowledgeRepository';
import { AIService } from './AIService';
import { KnowledgeItemInput, SearchResult } from '../types';

export class KnowledgeService {
  constructor(
    private repository: KnowledgeRepository,
    private aiService: AIService
  ) {}

  async createItem(item: KnowledgeItemInput): Promise<string> {
    // Generate embedding if content exists
    let embedding: number[] | undefined;
    if (item.content && (item.type === 'document' || item.type === 'file')) {
      try {
        embedding = await this.aiService.generateEmbedding(item.content);
      } catch (error) {
        console.error('Failed to generate embedding:', error);
      }
    }

    return await this.repository.create(item, embedding);
  }

  async updateItem(itemId: string, updates: Partial<KnowledgeItemInput>): Promise<void> {
    // Regenerate embedding if content changed
    let embedding: number[] | undefined;
    if (updates.content) {
      try {
        embedding = await this.aiService.generateEmbedding(updates.content);
      } catch (error) {
        console.error('Failed to generate embedding:', error);
      }
    }

    await this.repository.update(itemId, updates, embedding);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.repository.delete(itemId);
  }

  async search(
    query: string,
    limit: number = 5,
    threshold: number = 0.7,
    type: 'semantic' | 'keyword' | 'hybrid' = 'hybrid'
  ): Promise<SearchResult[]> {
    if (type === 'semantic') {
      return await this.semanticSearch(query, limit, threshold);
    } else if (type === 'keyword') {
      return await this.repository.keywordSearch(query, limit);
    } else {
      // Hybrid: combine both
      const [semanticResults, keywordResults] = await Promise.all([
        this.semanticSearch(query, Math.ceil(limit / 2), threshold),
        this.repository.keywordSearch(query, Math.ceil(limit / 2))
      ]);

      // Deduplicate by UUID
      const seen = new Set<string>();
      const combined: SearchResult[] = [];
      
      for (const result of [...semanticResults, ...keywordResults]) {
        if (!seen.has(result.uuid)) {
          seen.add(result.uuid);
          combined.push(result);
        }
      }

      return combined.slice(0, limit);
    }
  }

  async getTopItems(limit: number = 10): Promise<SearchResult[]> {
    const items = await this.repository.listRecent(limit);
    return items.map(item => ({
      uuid: item.uuid,
      title: item.title,
      description: item.description,
      content: item.content,
      type: item.type,
      score: 1.0,
      metadata: item.metadata
    }));
  }

  private async semanticSearch(query: string, limit: number, threshold: number): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.aiService.generateEmbedding(query);
      return await this.repository.semanticSearch(queryEmbedding, limit, threshold);
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  formatKnowledgeContext(results: SearchResult[]): string {
    if (results.length === 0) return '';

    let context = 'Relevant information from knowledge base:\n\n';
    for (const result of results) {
      const content = result.content || result.description || '';
      context += `- ${result.title}: ${content.substring(0, 300)}\n`;
    }
    return context;
  }
}

