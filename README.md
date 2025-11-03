# Assistant AI

Embeddable AI assistant SDK with knowledge base, streaming chat, and self-generating personality for single-application use.

## Features

- 🤖 **AI Chat** - OpenAI-powered conversational AI with streaming support
- 📚 **Knowledge Base** - Semantic search with vector embeddings (RAG)
- 🎭 **Self-Generating Personality** - Auto-built system prompts from your knowledge base
- 💬 **Conversation Management** - Full conversation history and threading
- ⚡ **Streaming Support** - Real-time response streaming
- 🔍 **Hybrid Search** - Combines semantic and keyword search
- 📊 **Single-App Architecture** - No multi-tenancy complexity

## Installation

```bash
npm install @vezlo/assistant-client-js
```

## Quick Start

```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';

// Initialize the SDK
const assistant = new AssistantAI({
  dbUrl: 'https://your-project.supabase.co',
  dbKey: 'your-supabase-service-key',
  aiApiKey: 'your-openai-api-key',
  model: 'gpt-4o-mini',
  tablePrefix: 'ai_', // optional, default: 'ai_'
  temperature: 0.7,    // optional
  maxTokens: 1000      // optional
});

// Initialize (builds personality if not exists)
await assistant.init();

// Create a conversation for a user
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'My Conversation'
});

// Send a message to the conversation
const response = await assistant.sendMessage({
  conversationId,
  message: 'Hello, how can you help me?'
});

console.log(response.content);
```

## Configuration

```typescript
interface AssistantAIConfig {
  dbUrl: string;              // Supabase URL
  dbKey: string;              // Supabase service role key
  aiApiKey: string;           // OpenAI API key
  model: string;              // e.g., "gpt-4o-mini"
  temperature?: number;       // default: 0.7
  maxTokens?: number;         // default: 1000
  tablePrefix?: string;       // default: "ai_"
  enableStreaming?: boolean;  // default: true
  personality?: {
    name?: string;
    tone?: string;
    customInstructions?: string;
  };
}
```

## API Reference

### Conversations

#### Create Conversation
```typescript
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'My Conversation' // optional
});
```

#### Get Conversation
```typescript
const { meta, messages } = await assistant.getConversation(conversationId);
```

#### List Conversations
```typescript
const conversations = await assistant.listConversations('user-123');
```

#### Update Conversation Title
```typescript
await assistant.updateConversationTitle(conversationId, 'New Title');
```

#### Delete Conversation
```typescript
await assistant.deleteConversation(conversationId);
```

### Chat

#### Send Message (Non-Streaming)
```typescript
// Option 1: Send to existing conversation (recommended)
const response = await assistant.sendMessage({
  conversationId: 'conv-uuid',
  message: 'Your question here',
  context: {
    // Optional: Add any context data
    userLocation: 'US',
    previousAction: 'viewed-product',
    metadata: { productId: '123' }
  }
});

// Option 2: Auto-create conversation (convenience method)
const response = await assistant.sendMessage({
  message: 'Your question here',
  userId: 'user-123', // creates new conversation if no conversationId
  context: { /* optional */ }
});

console.log(response.content);
console.log(response.messageId);
console.log(response.conversationId);

// Context is stored in message metadata and can be retrieved later
```

#### Stream Message
```typescript
// With existing conversation
const stream = assistant.streamMessage({
  conversationId: 'conv-uuid',
  message: 'Your question here'
});

// Or auto-create conversation
const stream = assistant.streamMessage({
  message: 'Your question here',
  userId: 'user-123'
});

for await (const event of stream) {
  switch (event.type) {
    case 'start':
      console.log('Started conversation:', event.conversationId);
      break;
    case 'delta':
      process.stdout.write(event.content);
      break;
    case 'final':
      console.log('\nCompleted:', event.messageId);
      break;
    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

### Knowledge Base

#### Create Knowledge Item
```typescript
const { id } = await assistant.createKnowledgeItem({
  title: 'Product Documentation',
  type: 'document',
  content: 'Your documentation content here...',
  description: 'Optional description',
  createdBy: 'user-123'
});
```

#### Search Knowledge
```typescript
const results = await assistant.searchKnowledge({
  query: 'How do I configure the API?',
  limit: 5,           // optional, default: 5
  threshold: 0.7,     // optional, default: 0.7
  type: 'hybrid'      // 'semantic' | 'keyword' | 'hybrid'
});

results.forEach(result => {
  console.log(result.title, result.score);
});
```

#### Update Knowledge Item
```typescript
await assistant.updateKnowledgeItem(itemId, {
  title: 'Updated Title',
  content: 'Updated content...'
});
```

#### Delete Knowledge Item
```typescript
await assistant.deleteKnowledgeItem(itemId);
```

### Personality

#### Build Personality
Automatically generates system prompt from knowledge base:

```typescript
const { systemPrompt, profile } = await assistant.buildPersonality({
  strategy: 'kb_summary', // optional
  refresh: true           // optional, force rebuild
});
```

#### Get Current Personality
```typescript
const { systemPrompt, profile } = await assistant.getPersonality();
```

#### Set Custom Personality
```typescript
await assistant.setPersonality({
  systemPrompt: 'You are a helpful assistant specialized in...',
  profile: {
    name: 'My Assistant',
    tone: 'professional',
    description: 'Expert in technical support'
  }
});
```

### Feedback

#### Submit Feedback
```typescript
await assistant.submitFeedback(
  messageId,
  'user-123',
  'positive',
  {
    category: 'helpful',
    comment: 'Great response!',
    suggestedImprovement: 'Could be more concise'
  }
);
```

#### Get Message Feedback
```typescript
const feedback = await assistant.getMessageFeedback(messageId);
```

#### Get User Feedback History
```typescript
const userFeedback = await assistant.getUserFeedback('user-123', 50);
```

## Database Setup

You need to manually create the required tables in your database. See `schema.sql` for the complete schema.

**Required tables:**
- `ai_conversations` - Stores conversation metadata (linked to users via `creator_id`)
- `ai_messages` - Stores all messages (linked to conversations via `conversation_id`)
- `ai_message_feedback` - Optional feedback tracking
- `ai_knowledge_items` - Knowledge base content with embeddings
- `ai_personality` - System prompt and personality configuration

**Data Model:**
```
User (your app's user ID)
  └─> Conversations (creator_id)
       └─> Messages (conversation_id)
```

**Note:** The `tablePrefix` in config determines the actual table names (default: `ai_`).

## Examples

### Complete Chat Flow
```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';

const assistant = new AssistantAI({
  dbUrl: process.env.SUPABASE_URL!,
  dbKey: process.env.SUPABASE_SERVICE_KEY!,
  aiApiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini'
});

await assistant.init();

// Create conversation
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'Product Support'
});

// Send messages
const response1 = await assistant.sendMessage({
  conversationId,
  message: 'How do I reset my password?'
});

console.log('AI:', response1.content);

const response2 = await assistant.sendMessage({
  conversationId,
  message: 'What if I forgot my email?'
});

console.log('AI:', response2.content);

// Get full conversation
const { messages } = await assistant.getConversation(conversationId);
console.log(`Total messages: ${messages.length}`);
```

### Streaming Chat
```typescript
// Create conversation first
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'Technical Questions'
});

// Stream response
const stream = assistant.streamMessage({
  conversationId,
  message: 'Explain how authentication works'
});

let fullResponse = '';

for await (const event of stream) {
  if (event.type === 'delta') {
    process.stdout.write(event.content);
    fullResponse += event.content;
  } else if (event.type === 'final') {
    console.log('\n\nSaved as message:', event.messageId);
  }
}
```

### Building Knowledge Base
```typescript
// Add documentation
await assistant.createKnowledgeItem({
  title: 'Authentication Guide',
  type: 'document',
  content: `Our authentication system uses JWT tokens...`,
  createdBy: 'admin'
});

await assistant.createKnowledgeItem({
  title: 'API Reference',
  type: 'document',
  content: `POST /api/auth/login - Authenticate user...`,
  createdBy: 'admin'
});

// Rebuild personality based on new knowledge
await assistant.buildPersonality({ refresh: true });

// Now chat will be informed by this knowledge
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'API Questions'
});

const response = await assistant.sendMessage({
  conversationId,
  message: 'How do I authenticate with the API?'
});
```

### Using Context
```typescript
// Create conversation
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'Support Chat'
});

// Send message with context
const response = await assistant.sendMessage({
  conversationId,
  message: 'I need help with my order',
  context: {
    orderId: 'ORD-12345',
    userId: 'user-123',
    userTier: 'premium',
    previousIssues: 2,
    sessionData: {
      page: 'order-details',
      referrer: 'email-campaign'
    }
  }
});

// Context is stored in message metadata
const { messages } = await assistant.getConversation(conversationId);
const lastMessage = messages[messages.length - 1];
console.log('Message context:', lastMessage.metadata?.context);

// Submit feedback with context awareness
await assistant.submitFeedback(
  response.messageId,
  'user-123',
  'positive',
  {
    category: 'resolved-issue',
    comment: 'Quick resolution'
  }
);
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions included.

```typescript
import {
  AssistantAI,
  AssistantAIConfig,
  SendMessageInput,
  SendMessageOutput,
  StreamEvent,
  Conversation,
  Message,
  KnowledgeItem,
  MessageFeedback
} from '@vezlo/assistant-client-js';
```

## Requirements

- Node.js >= 18
- Supabase project with Postgres database
- OpenAI API key (or compatible provider)
- PostgreSQL `vector` extension enabled

## License

MIT

## Support

For issues and questions, please visit our [GitHub repository](https://github.com/vezlo/assistant-client-js).

