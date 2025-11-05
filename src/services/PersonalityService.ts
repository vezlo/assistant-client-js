import { PersonalityRepository } from '../repositories/PersonalityRepository';
import { KnowledgeService } from './KnowledgeService';
import { AIService } from './AIService';
import { PersonalityProfile, BuildPersonalityInput, BuildPersonalityOutput } from '../types';

// Simple cache implementation
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache<K, V> {
  private store = new Map<K, CacheEntry<V>>();
  private ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttl
    });
  }

  delete(key: K): void {
    this.store.delete(key);
  }
}

export class PersonalityService {
  private cache: SimpleCache<string, BuildPersonalityOutput>;

  constructor(
    private repository: PersonalityRepository,
    private knowledgeService: KnowledgeService,
    private aiService: AIService,
    private defaultPersonality?: { name?: string; tone?: string; customInstructions?: string }
  ) {
    // Initialize cache with 5-minute TTL
    this.cache = new SimpleCache<string, BuildPersonalityOutput>(1000 * 60 * 5);
  }

  async getPersonality(): Promise<BuildPersonalityOutput> {
    // Check cache first
    const cached = this.cache.get('personality');
    if (cached) {
      return cached;
    }

    // Fetch from database
    const existing = await this.repository.get();
    
    if (existing) {
      const result = {
        systemPrompt: existing.systemPrompt,
        profile: {
          name: existing.name,
          description: existing.description,
          tone: existing.metadata?.tone,
          domain: existing.metadata?.domain
        }
      };
      
      // Cache the result
      this.cache.set('personality', result);
      return result;
    }

    // Build default if none exists
    return await this.buildPersonality();
  }

  async buildPersonality(input?: BuildPersonalityInput): Promise<BuildPersonalityOutput> {
    // Invalidate cache since we're building new personality
    this.cache.delete('personality');

    // If custom instructions provided, use them
    if (this.defaultPersonality?.customInstructions) {
      const name = this.defaultPersonality.name || 'AI Assistant';
      const systemPrompt = this.defaultPersonality.customInstructions;
      const profile: PersonalityProfile = {
        name,
        tone: this.defaultPersonality.tone || 'helpful',
        description: 'Custom configured assistant'
      };

      await this.repository.save(name, systemPrompt, profile);
      
      // Cache the new personality
      const result = { systemPrompt, profile };
      this.cache.set('personality', result);
      return result;
    }

    // Build from knowledge base
    const topItems = await this.knowledgeService.getTopItems(10);
    
    if (topItems.length === 0) {
      // No knowledge base, use generic personality
      const name = this.defaultPersonality?.name || 'AI Assistant';
      const systemPrompt = this.buildGenericSystemPrompt(name);
      const profile: PersonalityProfile = {
        name,
        tone: this.defaultPersonality?.tone || 'helpful and professional',
        description: 'General purpose AI assistant'
      };

      await this.repository.save(name, systemPrompt, profile);
      
      // Cache the new personality
      const result = { systemPrompt, profile };
      this.cache.set('personality', result);
      return result;
    }

    // Summarize knowledge base to create personality
    const kbSummary = await this.aiService.summarizeKnowledgeBase(
      topItems.map(item => ({
        title: item.title,
        content: item.content,
        description: item.description
      }))
    );

    const name = this.defaultPersonality?.name || 'AI Assistant';
    const systemPrompt = this.buildKnowledgeBasedSystemPrompt(name, kbSummary);
    const profile: PersonalityProfile = {
      name,
      tone: this.defaultPersonality?.tone || 'helpful and knowledgeable',
      description: kbSummary,
      domain: this.extractDomain(topItems)
    };

    await this.repository.save(name, systemPrompt, profile);
    
    // Cache the new personality
    const result = { systemPrompt, profile };
    this.cache.set('personality', result);
    return result;
  }

  async setPersonality(systemPrompt: string, profile?: PersonalityProfile): Promise<void> {
    // Invalidate cache since personality is being updated
    this.cache.delete('personality');
    
    const name = profile?.name || 'AI Assistant';
    await this.repository.save(name, systemPrompt, profile);
  }

  private buildGenericSystemPrompt(name: string): string {
    return `You are ${name}, a helpful AI assistant.

Your role is to:
- Answer user questions clearly and accurately
- Provide helpful guidance and support
- Be professional, friendly, and respectful
- Admit when you don't know something
- Ask clarifying questions when needed

Always strive to be helpful while maintaining a professional demeanor.`;
  }

  private buildKnowledgeBasedSystemPrompt(name: string, kbSummary: string): string {
    return `You are ${name}, an AI assistant with expertise based on the following knowledge:

${kbSummary}

Your role is to:
- Answer questions using the knowledge base when relevant
- Provide accurate information based on the available knowledge
- Be helpful, clear, and professional in your responses
- Admit when information is outside your knowledge base
- Guide users to relevant resources when available

When answering questions:
1. Search your knowledge base for relevant information
2. Provide accurate, well-structured answers
3. Cite specific knowledge when applicable
4. Be honest about limitations in your knowledge`;
  }

  private extractDomain(items: SearchResult[]): string {
    // Simple heuristic: look at most common words in titles
    const words = items
      .flatMap(item => item.title.toLowerCase().split(/\s+/))
      .filter(word => word.length > 4);
    
    if (words.length === 0) return 'general';
    
    // Return first meaningful word as domain hint
    return words[0] || 'general';
  }
}

interface SearchResult {
  title: string;
  content?: string;
  description?: string;
}

