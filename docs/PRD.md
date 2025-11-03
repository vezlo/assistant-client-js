## Assistant AI (Single-App) – Product Requirements Document (PRD)

### Purpose
- **Goal**: Provide an embeddable npm package that enables AI chat grounded in a single app’s knowledge base, supporting both streaming and non-stream responses, and maintaining a self-generating “personality” (system prompt) derived from the app’s knowledge.
- **Scope**: Single-application deployment (no multi-tenancy). Runs inside the host app; no public server endpoints required.

### Non-Goals
- Multi-company tenancy, marketplace flows, or hosted/serverless API surface.
- Automatic database migrations. The host will provision schema manually as needed.

## Target Users
- Developers who want to embed an AI assistant in their app using Supabase/Postgres and OpenAI-compatible models.

## Configuration
Initialize the SDK with minimal credentials. All fields are TypeScript-typed.

```ts
interface AssistantAIConfig {
  dbUrl: string;              // Supabase URL
  dbKey: string;              // Supabase service role key
  aiApiKey: string;           // OpenAI-compatible API key
  model: string;              // e.g., "gpt-4o-mini"
  temperature?: number;       // default 0.7
  maxTokens?: number;         // default 1000
  tablePrefix?: string;       // default "ai_"
  enableStreaming?: boolean;  // default true
  personality?: {
    name?: string;
    tone?: string;
    customInstructions?: string; // if provided, overrides auto-built persona
  };
}
```

## Public API (TypeScript)
```ts
// Init
function init(config: AssistantAIConfig): Promise<void>;

// Conversations
function createConversation(input: { userId: string; title?: string }): Promise<{ conversationId: string }>;
function getConversation(conversationId: string): Promise<{ meta: Conversation; messages: Message[] }>;
function listConversations(userId: string): Promise<Conversation[]>;
function deleteConversation(conversationId: string): Promise<boolean>;

// Chat
function sendMessage(input: {
  message: string;
  conversationId?: string; // required (or userId to auto-create)
  userId?: string;         // required only when auto-creating conversation
  context?: Record<string, any>;
}): Promise<{ content: string; conversationId: string; messageId: string }>;

// Streaming
type StreamEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'delta'; content: string }
  | { type: 'final'; content: string; messageId: string; conversationId: string }
  | { type: 'error'; error: string };

function streamMessage(input: {
  message: string;
  conversationId?: string; // required (or userId to auto-create)
  userId?: string;         // required only when auto-creating conversation
  context?: Record<string, any>;
}): AsyncIterable<StreamEvent>;

// Knowledge Base
function searchKnowledge(input: { query: string; limit?: number; threshold?: number; type?: 'semantic' | 'keyword' | 'hybrid' }): Promise<SearchResult[]>;
function createKnowledgeItem(item: KnowledgeItemInput): Promise<{ id: string }>;
function updateKnowledgeItem(id: string, updates: Partial<KnowledgeItemInput>): Promise<void>;
function deleteKnowledgeItem(id: string): Promise<void>;

// Personality (System Prompt)
function buildPersonality(input?: { strategy?: 'kb_summary'; refresh?: boolean }): Promise<{ systemPrompt: string; profile: PersonalityProfile }>;
function getPersonality(): Promise<{ systemPrompt: string; profile: PersonalityProfile }>;
function setPersonality(input: { systemPrompt: string; profile?: PersonalityProfile }): Promise<void>;
```

### Behavior
- **Proper flow**: Create conversation with `userId`, then send messages with `conversationId`
- **Convenience flow**: If `conversationId` is not provided but `userId` is, the SDK auto-creates a conversation
- Messages are always linked to conversations; conversations are linked to users via `creator_id`
- The message flow follows a 2-step pattern internally: persist user message, generate AI response (streaming or non-stream), then persist assistant message
- Streaming yields `start` → `delta*` → `final` events; when streaming is disabled, `sendMessage` returns the final content only
- The system prompt (personality) is constructed from:
  - Base persona (name, tone, optional custom instructions)
  - Lightweight RAG snippets from the knowledge base (top-k matches)
  - Cached personality record in DB for consistency across sessions

## Data Model (Single-App)
Single-tenant schema. Either drop `company_id` entirely or set to a fixed default and ignore in code. Recommended: simplify tables without `company_id`.

### Tables
- Conversations
  - `uuid`, `creator_id`, `title`, `message_count`, `created_at`, `updated_at`, `deleted_at` (nullable)
- Messages
  - `uuid`, `conversation_id` (FK), `parent_message_id` (nullable), `type` ('user' | 'assistant' | 'system'), `content`, `status`, `metadata`, `created_at`, `updated_at`
- Message Feedback
  - `uuid`, `message_id` (FK), `user_id`, `rating` ('positive' | 'negative'), `category?`, `comment?`, `suggested_improvement?`, `created_at`
- Knowledge Items
  - `uuid`, `parent_id?`, `title`, `description?`, `type` ('folder' | 'document' | 'file' | 'url' | 'url_directory'), `content?`, `file_url?`, `file_size?`, `file_type?`, `metadata`, `embedding vector(1536)`, `processed_at?`, `created_by`, `created_at`, `updated_at`
- Personality (new)
  - `uuid`, `name`, `description?`, `system_prompt`, `metadata JSONB`, `last_built_at TIMESTAMPTZ`

> Important: Do not create migration files in this project. Provision or update these tables manually in your database. The SDK only assumes they exist.

## Personality Strategy
- Strategy: `kb_summary`
  - Gather top N knowledge items (by recency/importance), summarize into a canonical `system_prompt` with tone and domain focus.
  - Persist in `ai_personality` table; rebuild on demand (`refresh: true`) or when KB materially changes.
  - Allow overrides via `setPersonality` to support curated personas.

## Knowledge Search
- Modes: `semantic`, `keyword`, `hybrid` (default: `hybrid`).
- Embeddings default model suggestion: `text-embedding-3-small` (updatable via implementation), RAG top-k=3 by default.
- Fallbacks: if embeddings are missing, run keyword search only.

## Streaming Design
- Uses provider streaming API when available; otherwise simulates by chunking final result.
- Persistence: on `final`, the assistant message is stored and linked to the parent user message.

## Initialization
- Connect Supabase using `dbUrl` and `dbKey` (service role key recommended for RLS access).
- Resolve table names via `tablePrefix` (default `ai_`).
- On first run, if no personality exists and no custom persona specified, build and store personality.

## Security
- SDK runs server-side with service role key. No public endpoints.
- Input validation on all DB interactions.
- Rate limiting is left to the host app.

## Extensibility
- Provider adapters for AI chat/embeddings (OpenAI-compatible initially).
- Customizable RAG assembly (k, thresholds, reranking).
- Pluggable telemetry hook for token usage and quality signals.

## Telemetry (Optional)
- Counters: conversations, messages, feedback ratings, token usage (if exposed by provider).
- No PII by default.

## Success Criteria
- Init < 300ms after cold start.
- First token in stream < 500ms after provider begins streaming; end-to-end small-KB response < 2s.
- Personality build < 10s for small KB; cached thereafter.

## Open Questions
- Accept raw Postgres connection string vs Supabase URL+Key? (Current plan: Supabase client.)
- Default embedding model: maintain `text-embedding-3-small` or configurable per install?
- Remove `company_id` columns vs retain with constant default? (Recommendation: remove for clarity.)

## Manual Schema Guidance (Summary)
- Create tables for `conversations`, `messages`, `message_feedback`, `knowledge_items`, and `ai_personality` (single-app; omit `company_id`).
- Ensure indexes: UUID lookup, FK relationships, FTS GIN on KB (`title + description + content`), IVFFlat vector index on `embedding` where not null.
- RLS policies: allow service role full access; public access not required.

---

This PRD describes the single-app, embeddable Assistant AI package: configuration, API surface, behavior, data model, personality generation, streaming, and operational constraints (manual DB setup, no migrations in this repo).


