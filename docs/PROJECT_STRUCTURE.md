# Project Structure

Complete overview of the Assistant AI SDK project structure.

## Directory Layout

```
assistant-client-js/
├── docs/                   # Documentation
│   ├── PRD.md             # Product Requirements Document
│   ├── SETUP.md           # Setup and installation guide
│   └── PROJECT_STRUCTURE.md # This file
│
├── src/                    # Source code
│   ├── database/          # Database client
│   │   └── client.ts      # Supabase client wrapper
│   │
│   ├── repositories/      # Data access layer
│   │   ├── ConversationRepository.ts
│   │   ├── MessageRepository.ts
│   │   ├── KnowledgeRepository.ts
│   │   └── PersonalityRepository.ts
│   │
│   ├── services/          # Business logic
│   │   ├── AIService.ts           # OpenAI integration
│   │   ├── KnowledgeService.ts    # Knowledge base operations
│   │   └── PersonalityService.ts  # Personality management
│   │
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # All type exports
│   │
│   ├── AssistantAI.ts     # Main SDK class
│   └── index.ts           # Package entry point
│
├── examples/               # Usage examples
│   ├── basic-usage.ts     # Simple chat example
│   ├── streaming-chat.ts  # Streaming response example
│   └── knowledge-base.ts  # Knowledge base management example
│
├── schema.sql             # Database schema (Postgres/Supabase)
├── package.json           # NPM package configuration
├── tsconfig.json          # TypeScript configuration
├── README.md              # Main documentation
├── LICENSE                # MIT License
└── .gitignore            # Git ignore rules
```

## Core Components

### 1. Database Layer (`src/database/`)

**DatabaseClient**
- Initializes Supabase client
- Manages table name prefixes
- Provides database connection

### 2. Repository Layer (`src/repositories/`)

**ConversationRepository**
- CRUD operations for conversations
- User conversation queries
- Soft delete support

**MessageRepository**
- Message creation and retrieval
- Conversation history queries
- Parent-child message relationships

**KnowledgeRepository**
- Knowledge item management
- Semantic search (vector similarity)
- Keyword search (full-text)
- Hybrid search (combines both)

**PersonalityRepository**
- Personality storage and retrieval
- Single active personality management

### 3. Service Layer (`src/services/`)

**AIService**
- OpenAI chat completions
- Streaming response support
- Embedding generation
- Knowledge base summarization

**KnowledgeService**
- High-level knowledge operations
- Auto-embedding on create/update
- Search orchestration
- Context formatting for AI

**PersonalityService**
- Personality building from KB
- Custom personality management
- System prompt generation

### 4. Main SDK (`src/AssistantAI.ts`)

The primary interface exposing all functionality:
- Conversation management
- Message sending (stream/non-stream)
- Knowledge base operations
- Personality configuration

### 5. Type System (`src/types/`)

Complete TypeScript definitions for:
- Configuration interfaces
- Data models
- API inputs/outputs
- Stream events

## Data Flow

### Message Flow
```
User Input
    ↓
AssistantAI.sendMessage()
    ↓
1. Get/Create Conversation
2. Save User Message
3. Search Knowledge Base
4. Get Personality
5. Generate AI Response
6. Save Assistant Message
7. Update Message Count
    ↓
Return Response
```

### Streaming Flow
```
User Input
    ↓
AssistantAI.streamMessage()
    ↓
yield { type: 'start' }
    ↓
For each token from OpenAI:
    yield { type: 'delta', content }
    ↓
Save complete message
    ↓
yield { type: 'final', messageId }
```

### Knowledge Search Flow
```
Query
    ↓
KnowledgeService.search()
    ↓
Generate query embedding
    ↓
Semantic Search (vector similarity)
    +
Keyword Search (full-text)
    ↓
Merge & deduplicate results
    ↓
Return top-k matches
```

## Database Schema

### Tables
- `ai_conversations` - Conversation metadata
- `ai_messages` - All messages (user/assistant/system)
- `ai_message_feedback` - Optional feedback
- `ai_knowledge_items` - Knowledge base with embeddings
- `ai_personality` - System prompt configuration

### Key Features
- UUID-based external IDs
- BigInt internal IDs for performance
- Vector embeddings (1536 dimensions)
- Full-text search indexes
- IVFFlat vector indexes
- Soft delete support

## Build & Distribution

### Development
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run build:watch  # Watch mode
```

### Publishing
```bash
npm run prepublishOnly  # Clean + build
npm publish            # Publish to NPM
```

### Files Included in Package
- `dist/` - Compiled JavaScript + type definitions
- `README.md` - Documentation
- `LICENSE` - MIT License

## Key Design Decisions

### 1. Single-App Architecture
- No multi-tenancy fields (removed `company_id`)
- Simplified for single application use
- TEXT user IDs for flexibility

### 2. Repository Pattern
- Clear separation of concerns
- Easy to test and mock
- Database-agnostic interface

### 3. Streaming First
- Native async generator support
- Event-based stream API
- Graceful fallback to non-streaming

### 4. Type Safety
- Full TypeScript coverage
- Exported types for consumers
- Strict type checking

### 5. Knowledge-Driven Personality
- Auto-built from KB content
- Cached for performance
- Customizable override

## Extension Points

### Custom AI Provider
Replace `AIService` to support different providers:
```typescript
class CustomAIService extends AIService {
  async generateResponse(...) {
    // Custom implementation
  }
}
```

### Custom Search Strategy
Extend `KnowledgeRepository` for advanced search:
```typescript
class AdvancedKnowledgeRepo extends KnowledgeRepository {
  async customSearch(...) {
    // Custom logic
  }
}
```

### Custom Storage Backend
Implement repository interfaces for different databases.

## Performance Considerations

### Embeddings
- Generated asynchronously
- Cached in database
- 1536-dimensional vectors (OpenAI ada-002/3-small)

### Search
- IVFFlat indexes for vectors
- GIN indexes for full-text
- Limit results to top-k

### Caching
- Personality cached in DB
- Active conversations in memory
- Connection pooling via Supabase

## Security

### API Keys
- Service role key required
- Never expose in client code
- Use environment variables

### Database Access
- Row Level Security supported
- Service role has full access
- Optional RLS policies in schema

### Input Validation
- Type checking via TypeScript
- Runtime validation in repositories
- Parameterized queries (SQL injection protection)

## Testing Strategy

Recommended testing approach:
1. **Unit Tests** - Services and repositories
2. **Integration Tests** - Full SDK flows
3. **E2E Tests** - Real database + AI provider

## Deployment

### As NPM Package
```bash
npm install @vezlo/assistant-client-js
```

### As Part of Application
```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';
// Use in your app
```

### Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`

## Maintenance

### Adding New Features
1. Add types in `src/types/`
2. Implement in appropriate service/repository
3. Expose via `AssistantAI` class
4. Update README and examples

### Database Changes
1. Update `schema.sql`
2. Provide migration notes in docs
3. Update repository methods

### Dependencies
Keep these up to date:
- `@supabase/supabase-js`
- `openai`
- `typescript`

---

This structure provides a clean, maintainable, and extensible foundation for the Assistant AI SDK.

