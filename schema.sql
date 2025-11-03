-- Assistant AI - Single-App Database Schema
-- This schema is designed for single-application use (no multi-tenancy)
-- Run this in your Supabase SQL Editor or PostgreSQL database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_uuid ON ai_conversations(uuid);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_creator_id ON ai_conversations(creator_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_deleted ON ai_conversations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  parent_message_id BIGINT REFERENCES ai_messages(id),
  type TEXT NOT NULL CHECK (type IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'stopped', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_ai_messages_uuid ON ai_messages(uuid);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_parent_id ON ai_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_type ON ai_messages(type);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at DESC);

-- ============================================================================
-- MESSAGE FEEDBACK TABLE (Optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_message_feedback (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  message_id BIGINT NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  category TEXT,
  comment TEXT,
  suggested_improvement TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for feedback
CREATE INDEX IF NOT EXISTS idx_ai_feedback_uuid ON ai_message_feedback(uuid);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_message_id ON ai_message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_message_feedback(user_id);

-- ============================================================================
-- KNOWLEDGE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_knowledge_items (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  parent_id BIGINT REFERENCES ai_knowledge_items(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('folder', 'document', 'file', 'url', 'url_directory')),
  content TEXT,
  file_url TEXT,
  file_size BIGINT,
  file_type TEXT,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  processed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge items
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_uuid ON ai_knowledge_items(uuid);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_parent_id ON ai_knowledge_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_type ON ai_knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_created_at ON ai_knowledge_items(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_search
ON ai_knowledge_items USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(content, '')));

-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_embedding
ON ai_knowledge_items USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Sparse indexes
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_content ON ai_knowledge_items(content) WHERE content IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_file_url ON ai_knowledge_items(file_url) WHERE file_url IS NOT NULL;

-- ============================================================================
-- PERSONALITY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_personality (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  last_built_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for personality
CREATE INDEX IF NOT EXISTS idx_ai_personality_uuid ON ai_personality(uuid);
CREATE INDEX IF NOT EXISTS idx_ai_personality_last_built ON ai_personality(last_built_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - Uncomment if needed)
-- ============================================================================

-- Enable RLS
-- ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_message_feedback ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_knowledge_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_personality ENABLE ROW LEVEL SECURITY;

-- Service role access (full access)
-- CREATE POLICY "Service role can access all conversations" ON ai_conversations
--   FOR ALL USING (auth.role() = 'service_role');

-- CREATE POLICY "Service role can access all messages" ON ai_messages
--   FOR ALL USING (auth.role() = 'service_role');

-- CREATE POLICY "Service role can access all feedback" ON ai_message_feedback
--   FOR ALL USING (auth.role() = 'service_role');

-- CREATE POLICY "Service role can access all knowledge items" ON ai_knowledge_items
--   FOR ALL USING (auth.role() = 'service_role');

-- CREATE POLICY "Service role can access all personality" ON ai_personality
--   FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. This schema uses TEXT for user IDs (creator_id, user_id, created_by) instead of BIGINT
--    for flexibility in single-app scenarios where you might use UUIDs or other ID formats.
--
-- 2. The vector extension is required for semantic search with embeddings.
--    Ensure it's installed: CREATE EXTENSION IF NOT EXISTS vector;
--
-- 3. The IVFFlat index for embeddings improves search performance but requires
--    some data to be present before it's effective. For small datasets, it will
--    fall back to sequential scan.
--
-- 4. Table prefix 'ai_' is used by default. If you change the tablePrefix in
--    config, update all table names accordingly.
--
-- 5. Row Level Security policies are commented out. Uncomment if you need
--    database-level access control.

