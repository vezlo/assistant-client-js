# Setup Guide

Complete guide to setting up and using the Assistant AI SDK.

## Prerequisites

- Node.js >= 18
- Supabase project (or PostgreSQL with pgvector)
- OpenAI API key

## Step 1: Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Run the schema in your Supabase SQL Editor:
   - Copy the contents of `schema.sql`
   - Paste into Supabase SQL Editor
   - Execute the query

3. Ensure the `vector` extension is enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## Step 2: Get API Keys

### Supabase Keys
1. Go to Project Settings → API
2. Copy the **Project URL** (`SUPABASE_URL`)
3. Copy the **service_role key** (`SUPABASE_SERVICE_KEY`)

### OpenAI Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Copy the key (`OPENAI_API_KEY`)

## Step 3: Install the Package

### From NPM (when published)
```bash
npm install @vezlo/assistant-client-js
```

### From Source (for development)
```bash
# Clone or download the project
cd assistant-client-js

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 4: Create Configuration

Create a `.env` file in your project:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-api-key
```

## Step 5: Basic Usage

Create a simple script:

```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';

async function main() {
  // Initialize
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  });

  await assistant.init();

  // Create a conversation
  const { conversationId } = await assistant.createConversation({
    userId: 'user-123',
    title: 'Test Conversation'
  });

  // Send a message
  const response = await assistant.sendMessage({
    conversationId,
    message: 'Hello!'
  });

  console.log(response.content);
}

main();
```

## Step 6: Run Examples

The `examples/` folder contains three example scripts:

### Basic Usage
```bash
npx tsx examples/basic-usage.ts
```

### Streaming Chat
```bash
npx tsx examples/streaming-chat.ts
```

### Knowledge Base
```bash
npx tsx examples/knowledge-base.ts
```

## Configuration Options

### Required
- `dbUrl` - Supabase project URL
- `dbKey` - Supabase service role key
- `aiApiKey` - OpenAI API key
- `model` - AI model (e.g., "gpt-4o-mini", "gpt-4")

### Optional
- `temperature` - Controls randomness (0-1, default: 0.7)
- `maxTokens` - Max response length (default: 1000)
- `tablePrefix` - Database table prefix (default: "ai_")
- `enableStreaming` - Enable streaming responses (default: true)
- `personality.name` - Assistant name
- `personality.tone` - Assistant tone/style
- `personality.customInstructions` - Custom system prompt

## Verifying Setup

Run this simple test:

```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';

async function test() {
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  });

  try {
    await assistant.init();
    console.log('✓ Connection successful!');
    
    const { conversationId } = await assistant.createConversation({
      userId: 'test-user',
      title: 'Test'
    });
    
    const response = await assistant.sendMessage({
      conversationId,
      message: 'Test message'
    });
    
    console.log('✓ AI response received!');
    console.log('Setup complete!');
  } catch (error) {
    console.error('✗ Setup failed:', error);
  }
}

test();
```

## Troubleshooting

### "Connection failed"
- Verify your `SUPABASE_URL` is correct
- Ensure `SUPABASE_SERVICE_KEY` (not anon key) is used
- Check your internet connection

### "Table does not exist"
- Run the `schema.sql` in Supabase SQL Editor
- Verify table names match your `tablePrefix`
- Check the Supabase table editor to confirm tables exist

### "OpenAI API error"
- Verify your `OPENAI_API_KEY` is valid
- Check you have API credits available
- Ensure you're using a supported model

### "Vector extension not found"
- Enable in Supabase: Database → Extensions → Enable "vector"
- Or run: `CREATE EXTENSION IF NOT EXISTS vector;`

## Next Steps

1. **Add Knowledge Base Content** - Populate knowledge items for context-aware responses
2. **Customize Personality** - Set custom system prompts and tone
3. **Integrate into Your App** - Use the SDK in your application
4. **Monitor Usage** - Track conversations and feedback

## Support

For issues and questions:
- Check the [README.md](../README.md)
- Review the [PRD.md](./PRD.md)
- Open an issue on GitHub

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

