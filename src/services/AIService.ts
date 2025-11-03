import OpenAI from 'openai';
import { AssistantAIConfig, ChatMessage, StreamEvent } from '../types';

export class AIService {
  private client: OpenAI;
  private config: AssistantAIConfig;

  constructor(config: AssistantAIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.aiApiKey
    });
  }

  async generateResponse(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: ChatMessage[] = [],
    knowledgeContext: string = ''
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt + (knowledgeContext ? `\n\n${knowledgeContext}` : '')
      }
    ];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const completion = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
  }

  async *streamResponse(
    userMessage: string,
    systemPrompt: string,
    conversationHistory: ChatMessage[] = [],
    knowledgeContext: string = ''
  ): AsyncGenerator<string, void, unknown> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt + (knowledgeContext ? `\n\n${knowledgeContext}` : '')
      }
    ];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature || 0.7,
      max_tokens: this.config.maxTokens || 1000,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000) // Limit text length
    });

    return response.data[0].embedding;
  }

  async summarizeKnowledgeBase(items: Array<{ title: string; content?: string; description?: string }>): Promise<string> {
    if (items.length === 0) {
      return 'No knowledge base content available.';
    }

    const combinedContent = items
      .map(item => {
        const content = item.content || item.description || '';
        return `Title: ${item.title}\n${content.substring(0, 500)}`;
      })
      .join('\n\n');

    const summary = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes knowledge base content to create an AI personality profile.'
        },
        {
          role: 'user',
          content: `Based on this knowledge base content, create a brief summary (2-3 sentences) describing what this assistant should know about and what tone/personality it should have:\n\n${combinedContent}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return summary.choices[0]?.message?.content || 'General purpose assistant.';
  }
}

