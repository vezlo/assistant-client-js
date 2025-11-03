import { v4 as uuidv4 } from 'uuid';
import { DatabaseClient } from './database/client';
import { ConversationRepository } from './repositories/ConversationRepository';
import { MessageRepository } from './repositories/MessageRepository';
import { KnowledgeRepository } from './repositories/KnowledgeRepository';
import { PersonalityRepository } from './repositories/PersonalityRepository';
import { FeedbackRepository } from './repositories/FeedbackRepository';
import { AIService } from './services/AIService';
import { KnowledgeService } from './services/KnowledgeService';
import { PersonalityService } from './services/PersonalityService';
import {
  AssistantAIConfig,
  CreateConversationInput,
  CreateConversationOutput,
  GetConversationOutput,
  SendMessageInput,
  SendMessageOutput,
  SearchKnowledgeInput,
  SearchResult,
  KnowledgeItemInput,
  BuildPersonalityInput,
  BuildPersonalityOutput,
  StreamEvent,
  Conversation,
  MessageFeedback
} from './types';

export class AssistantAI {
  private config: AssistantAIConfig;
  private db: DatabaseClient;
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private knowledgeRepo: KnowledgeRepository;
  private personalityRepo: PersonalityRepository;
  private feedbackRepo: FeedbackRepository;
  private aiService: AIService;
  private knowledgeService: KnowledgeService;
  private personalityService: PersonalityService;
  private initialized: boolean = false;

  constructor(config: AssistantAIConfig) {
    this.config = config;
    this.db = new DatabaseClient(config);
    
    const client = this.db.getClient();
    const conversationTable = this.db.getTableName('conversations');
    const messageTable = this.db.getTableName('messages');
    const knowledgeTable = this.db.getTableName('knowledge_items');
    const personalityTable = this.db.getTableName('personality');
    const feedbackTable = this.db.getTableName('message_feedback');

    // Initialize repositories
    this.conversationRepo = new ConversationRepository(client, conversationTable);
    this.messageRepo = new MessageRepository(client, messageTable, conversationTable);
    this.knowledgeRepo = new KnowledgeRepository(client, knowledgeTable);
    this.personalityRepo = new PersonalityRepository(client, personalityTable);
    this.feedbackRepo = new FeedbackRepository(client, feedbackTable, messageTable);

    // Initialize services
    this.aiService = new AIService(config);
    this.knowledgeService = new KnowledgeService(this.knowledgeRepo, this.aiService);
    this.personalityService = new PersonalityService(
      this.personalityRepo,
      this.knowledgeService,
      this.aiService,
      config.personality
    );
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure personality exists
    try {
      await this.personalityService.getPersonality();
    } catch (error) {
      console.error('Failed to initialize personality:', error);
      await this.personalityService.buildPersonality();
    }

    this.initialized = true;
  }

  // ============================================================================
  // CONVERSATION METHODS
  // ============================================================================

  async createConversation(input: CreateConversationInput): Promise<CreateConversationOutput> {
    const conversation = await this.conversationRepo.create(
      input.userId,
      input.title || 'New Conversation'
    );
    return { conversationId: conversation.uuid };
  }

  async getConversation(conversationId: string): Promise<GetConversationOutput> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await this.messageRepo.listByConversation(conversationId);
    return { meta: conversation, messages };
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return await this.conversationRepo.listByUser(userId);
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    return await this.conversationRepo.delete(conversationId);
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversation = await this.conversationRepo.getById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    await this.conversationRepo.updateTitle(conversationId, title);
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return await this.listConversations(userId);
  }

  // ============================================================================
  // CHAT METHODS
  // ============================================================================

  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    await this.init();

    // Validate input
    if (!input.conversationId && !input.userId) {
      throw new Error(
        'Either conversationId (to continue existing conversation) or userId (to create new conversation) is required'
      );
    }

    // Get or create conversation
    let conversationId = input.conversationId;
    let conversationTitle = 'New Conversation';
    
    if (!conversationId) {
      // Auto-create conversation with userId
      const result = await this.createConversation({ 
        userId: input.userId!,
        title: conversationTitle
      });
      conversationId = result.conversationId;
    } else {
      // Validate conversation exists
      const conversation = await this.conversationRepo.getById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
    }

    // Prepare metadata for user message
    const userMetadata: Record<string, any> = {};
    if (input.context) {
      userMetadata.context = input.context;
    }

    // Save user message with context
    const userMessage = await this.messageRepo.create(
      conversationId,
      'user',
      input.message,
      undefined,
      Object.keys(userMetadata).length > 0 ? userMetadata : undefined
    );

    // Get conversation history
    const messages = await this.messageRepo.listByConversation(conversationId, 10);
    const conversationHistory = messages.slice(0, -1).map(msg => ({
      role: msg.type,
      content: msg.content
    }));

    // Search knowledge base
    const knowledgeResults = await this.knowledgeService.search(input.message, 3, 0.7, 'hybrid');
    const knowledgeContext = this.knowledgeService.formatKnowledgeContext(knowledgeResults);

    // Get personality
    const personality = await this.personalityService.getPersonality();

    // Generate AI response
    const aiResponse = await this.aiService.generateResponse(
      input.message,
      personality.systemPrompt,
      conversationHistory,
      knowledgeContext
    );

    // Prepare metadata for assistant message
    const assistantMetadata: Record<string, any> = {
      knowledgeUsed: knowledgeResults.length > 0,
      knowledgeItemCount: knowledgeResults.length
    };
    if (input.context) {
      assistantMetadata.userContext = input.context;
    }

    // Save assistant message with metadata
    const assistantMessage = await this.messageRepo.create(
      conversationId,
      'assistant',
      aiResponse,
      userMessage.uuid,
      assistantMetadata
    );

    // Update conversation message count
    const conversation = await this.conversationRepo.getById(conversationId);
    if (conversation) {
      await this.conversationRepo.updateMessageCount(conversationId, conversation.messageCount + 2);
    }

    return {
      content: aiResponse,
      conversationId,
      messageId: assistantMessage.uuid
    };
  }

  async *streamMessage(input: SendMessageInput): AsyncGenerator<StreamEvent, void, unknown> {
    await this.init();

    try {
      // Validate input
      if (!input.conversationId && !input.userId) {
        throw new Error(
          'Either conversationId (to continue existing conversation) or userId (to create new conversation) is required'
        );
      }

      // Get or create conversation
      let conversationId = input.conversationId;
      let conversationTitle = 'New Conversation';
      
      if (!conversationId) {
        // Auto-create conversation with userId
        const result = await this.createConversation({ 
          userId: input.userId!,
          title: conversationTitle
        });
        conversationId = result.conversationId;
      } else {
        // Validate conversation exists
        const conversation = await this.conversationRepo.getById(conversationId);
        if (!conversation) {
          throw new Error(`Conversation not found: ${conversationId}`);
        }
      }

      yield { type: 'start', conversationId };

      // Prepare metadata for user message
      const userMetadata: Record<string, any> = {};
      if (input.context) {
        userMetadata.context = input.context;
      }

      // Save user message with context
      const userMessage = await this.messageRepo.create(
        conversationId,
        'user',
        input.message,
        undefined,
        Object.keys(userMetadata).length > 0 ? userMetadata : undefined
      );

      // Get conversation history
      const messages = await this.messageRepo.listByConversation(conversationId, 10);
      const conversationHistory = messages.slice(0, -1).map(msg => ({
        role: msg.type,
        content: msg.content
      }));

      // Search knowledge base
      const knowledgeResults = await this.knowledgeService.search(input.message, 3, 0.7, 'hybrid');
      const knowledgeContext = this.knowledgeService.formatKnowledgeContext(knowledgeResults);

      // Get personality
      const personality = await this.personalityService.getPersonality();

      // Stream AI response
      let fullContent = '';
      const stream = this.aiService.streamResponse(
        input.message,
        personality.systemPrompt,
        conversationHistory,
        knowledgeContext
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        yield { type: 'delta', content: chunk };
      }

      // Prepare metadata for assistant message
      const assistantMetadata: Record<string, any> = {
        knowledgeUsed: knowledgeResults.length > 0,
        knowledgeItemCount: knowledgeResults.length,
        streamed: true
      };
      if (input.context) {
        assistantMetadata.userContext = input.context;
      }

      // Save assistant message with metadata
      const assistantMessage = await this.messageRepo.create(
        conversationId,
        'assistant',
        fullContent,
        userMessage.uuid,
        assistantMetadata
      );

      // Update conversation message count
      const conversation = await this.conversationRepo.getById(conversationId);
      if (conversation) {
        await this.conversationRepo.updateMessageCount(conversationId, conversation.messageCount + 2);
      }

      yield {
        type: 'final',
        content: fullContent,
        messageId: assistantMessage.uuid,
        conversationId
      };

    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ============================================================================
  // KNOWLEDGE BASE METHODS
  // ============================================================================

  async searchKnowledge(input: SearchKnowledgeInput): Promise<SearchResult[]> {
    return await this.knowledgeService.search(
      input.query,
      input.limit || 5,
      input.threshold || 0.7,
      input.type || 'hybrid'
    );
  }

  async createKnowledgeItem(item: KnowledgeItemInput): Promise<{ id: string }> {
    const id = await this.knowledgeService.createItem(item);
    return { id };
  }

  async updateKnowledgeItem(id: string, updates: Partial<KnowledgeItemInput>): Promise<void> {
    await this.knowledgeService.updateItem(id, updates);
  }

  async deleteKnowledgeItem(id: string): Promise<void> {
    await this.knowledgeService.deleteItem(id);
  }

  // ============================================================================
  // PERSONALITY METHODS
  // ============================================================================

  async buildPersonality(input?: BuildPersonalityInput): Promise<BuildPersonalityOutput> {
    return await this.personalityService.buildPersonality(input);
  }

  async getPersonality(): Promise<BuildPersonalityOutput> {
    return await this.personalityService.getPersonality();
  }

  async setPersonality(input: { systemPrompt: string; profile?: any }): Promise<void> {
    await this.personalityService.setPersonality(input.systemPrompt, input.profile);
  }

  // ============================================================================
  // FEEDBACK METHODS
  // ============================================================================

  async submitFeedback(
    messageId: string,
    userId: string,
    rating: 'positive' | 'negative',
    options?: {
      category?: string;
      comment?: string;
      suggestedImprovement?: string;
    }
  ): Promise<MessageFeedback> {
    return await this.feedbackRepo.create(messageId, userId, rating, options);
  }

  async getMessageFeedback(messageId: string): Promise<MessageFeedback[]> {
    return await this.feedbackRepo.getByMessage(messageId);
  }

  async getUserFeedback(userId: string, limit = 50): Promise<MessageFeedback[]> {
    return await this.feedbackRepo.getByUser(userId, limit);
  }
}

