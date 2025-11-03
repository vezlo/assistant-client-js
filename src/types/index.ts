// Core configuration
export interface AssistantAIConfig {
  dbUrl: string;
  dbKey: string;
  aiApiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  tablePrefix?: string;
  enableStreaming?: boolean;
  personality?: {
    name?: string;
    tone?: string;
    customInstructions?: string;
  };
}

// Conversation types
export interface Conversation {
  uuid: string;
  creatorId: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Message {
  uuid: string;
  conversationId: string;
  parentMessageId?: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  status: 'generating' | 'completed' | 'stopped' | 'failed';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageFeedback {
  uuid: string;
  messageId: string;
  userId: string;
  rating: 'positive' | 'negative';
  category?: string;
  comment?: string;
  suggestedImprovement?: string;
  createdAt: Date;
}

// Knowledge base types
export interface KnowledgeItem {
  uuid: string;
  parentId?: string;
  title: string;
  description?: string;
  type: 'folder' | 'document' | 'file' | 'url' | 'url_directory';
  content?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  processedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeItemInput {
  parentId?: string;
  title: string;
  description?: string;
  type: 'folder' | 'document' | 'file' | 'url' | 'url_directory';
  content?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface SearchResult {
  uuid: string;
  title: string;
  description?: string;
  content?: string;
  type: string;
  score: number;
  metadata?: Record<string, any>;
}

// Personality types
export interface PersonalityProfile {
  name: string;
  description?: string;
  tone?: string;
  domain?: string;
}

export interface Personality {
  uuid: string;
  name: string;
  description?: string;
  systemPrompt: string;
  metadata?: Record<string, any>;
  lastBuiltAt: Date;
}

// Stream types
export type StreamEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'delta'; content: string }
  | { type: 'final'; content: string; messageId: string; conversationId: string }
  | { type: 'error'; error: string };

// API input/output types
export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface CreateConversationOutput {
  conversationId: string;
}

export interface GetConversationOutput {
  meta: Conversation;
  messages: Message[];
}

export interface SendMessageInput {
  message: string;
  conversationId?: string;
  userId?: string;
  context?: Record<string, any>;
}

export interface SendMessageOutput {
  content: string;
  conversationId: string;
  messageId: string;
}

export interface SearchKnowledgeInput {
  query: string;
  limit?: number;
  threshold?: number;
  type?: 'semantic' | 'keyword' | 'hybrid';
}

export interface BuildPersonalityInput {
  strategy?: 'kb_summary';
  refresh?: boolean;
}

export interface BuildPersonalityOutput {
  systemPrompt: string;
  profile: PersonalityProfile;
}

// Internal types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

