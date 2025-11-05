import OpenAI from 'openai';
import { AssistantAIConfig, ChatMessage, StreamEvent, UserIntent } from '../types';

export class AIService {
  private client: OpenAI;
  private config: AssistantAIConfig;

  constructor(config: AssistantAIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.aiApiKey
    });
  }

  /**
   * Detect user intent and generate direct response in single AI call
   */
  async detectIntent(
    message: string, 
    conversationHistory: ChatMessage[] = [],
    systemPrompt: string = ''
  ): Promise<UserIntent> {
    const trimmedMessage = message.trim();

    // Use single AI call to classify AND respond (including gibberish detection)
    try {
      // Build conversation context
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `${systemPrompt || 'You are a helpful AI assistant.'}

IMPORTANT: You must respond in this exact JSON format:
{
  "intent": "question|greeting|chitchat|gibberish",
  "response": "your response here",
  "enhancedQuery": "enhanced query for semantic search (only for questions)"
}

Intent classification:
- "question" - user needs specific information, facts, or knowledge (requires searching knowledge base). DEFAULT to this when uncertain.
- "greeting" - ONLY simple hello/hi/hey/greetings (respond warmly without knowledge base)
- "chitchat" - ONLY clearly casual conversation like "nice weather", "how are you doing" (respond naturally without knowledge base)
- "gibberish" - ONLY complete nonsense/random characters (respond politely asking for clarification)

IMPORTANT: When in doubt, classify as "question" to search knowledge base. Be very liberal with "question" classification.

Classification Examples:
- "question": "what is X?", "how do I...", "tell me about...", "explain...", "show me...", "where can I find...", "I need help with...", "looking for info on..."
- "greeting": "hello", "hi", "hey there", "good morning" (ONLY simple greetings)
- "chitchat": "nice weather", "how are you", "that's cool" (ONLY clearly social/casual)
- "gibberish": "asdfgh", "jkl;jkl;", random characters (ONLY nonsense)

Rules:
- If intent is "question":
  * Set "response" to empty string ""
  * Set "enhancedQuery" to a rewritten/expanded version of the user's question optimized for semantic search
  * CRITICAL - Enhanced Query Generation:
    1. Resolve all references: Replace pronouns (it, that, this, those, they) with actual entities from conversation history
    2. Incorporate context: If the message is incomplete (e.g., "tell me more", "what about that?", "how does it work?"), merge with the topic from previous messages to create a complete, standalone query
    3. Expand and clarify: Add relevant synonyms, expand acronyms, fix obvious typos, and add domain-specific keywords
    4. Keep it focused: Don't add unrelated terms, maintain the original question's intent
  * Examples:
    - User: "What is RAG?" → enhancedQuery: "What is RAG Retrieval Augmented Generation in AI machine learning?"
    - Previous: "Tell me about Python" | User: "What about its performance?" → enhancedQuery: "What is Python programming language performance speed execution time?"
    - Previous: "API documentation" | User: "How do I use that?" → enhancedQuery: "How do I use the API application programming interface documentation setup guide?"
    - User: "troubleshooting db connection" → enhancedQuery: "troubleshooting database connection issues errors problems MySQL PostgreSQL connection failed"
- If intent is "greeting", "chitchat", or "gibberish":
  * Provide an appropriate "response"
  * Set "enhancedQuery" to empty string ""`
        }
      ];

      // Add conversation history for context
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        });
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: trimmedMessage
      });

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: 0.3, // Lower temperature for more consistent intent classification
        max_tokens: 500 // Sufficient for enhanced queries with context
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      // Parse JSON response
      const parsed = JSON.parse(content);
      const intent = parsed.intent as UserIntent['type'];
      const directResponse = parsed.response || '';
      const enhancedQuery = parsed.enhancedQuery || '';

      // Return based on intent
      if (intent === 'question') {
        return {
          type: 'question',
          needsKnowledgeBase: true,
          confidence: 0.85,
          enhancedQuery: enhancedQuery || trimmedMessage // Fallback to original if no enhancement
        };
      }

      return {
        type: intent,
        needsKnowledgeBase: false,
        confidence: 0.9,
        directResponse: directResponse || this.getFallbackResponse(intent)
      };

    } catch (error) {
      console.error('Intent detection failed:', error);
      
      // On error, default to question to ensure proper handling
      return {
        type: 'question',
        needsKnowledgeBase: true,
        confidence: 0.5,
        enhancedQuery: trimmedMessage // Use original message as fallback
      };
    }
  }

  /**
   * Get fallback response based on intent type
   */
  private getFallbackResponse(intentType: UserIntent['type']): string {
    switch (intentType) {
      case 'greeting':
        return 'Hello! How can I help you today?';
      case 'chitchat':
        return 'I understand. Is there anything specific I can help you with?';
      case 'gibberish':
        return "I didn't quite understand that. Could you please rephrase?";
      default:
        return 'How can I assist you?';
    }
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

