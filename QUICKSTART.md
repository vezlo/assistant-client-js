# Quick Start Guide

Get started with Assistant AI in 5 minutes.

## 1. Install Dependencies

```bash
cd assistant-client-js
npm install
```

## 2. Setup Database

Run `schema.sql` in your Supabase SQL Editor:

1. Go to your Supabase project
2. Open SQL Editor
3. Copy contents of `schema.sql`
4. Execute

## 3. Configure Environment

Create `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-api-key
```

## 4. Build the Package

```bash
npm run build
```

## 5. Run Your First Chat

Create `test.ts`:

```typescript
import { AssistantAI } from './src';

async function main() {
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  });

  await assistant.init();
  
  // Create conversation for user
  const { conversationId } = await assistant.createConversation({
    userId: 'user-123',
    title: 'My First Chat'
  });
  
  // Send message to conversation
  const response = await assistant.sendMessage({
    conversationId,
    message: 'Hello! How can you help me?'
  });

  console.log('AI:', response.content);
}

main();
```

Run it:

```bash
npx tsx test.ts
```

## 6. Try Streaming

```typescript
// Create conversation
const { conversationId } = await assistant.createConversation({
  userId: 'user-123',
  title: 'Learning About AI'
});

// Stream response
const stream = assistant.streamMessage({
  conversationId,
  message: 'Explain AI in simple terms'
});

for await (const event of stream) {
  if (event.type === 'delta') {
    process.stdout.write(event.content);
  }
}
```

## 7. Add Knowledge Base

```typescript
await assistant.createKnowledgeItem({
  title: 'Product Info',
  type: 'document',
  content: 'Our product helps...',
  createdBy: 'admin'
});

// Rebuild personality
await assistant.buildPersonality({ refresh: true });
```

## What's Next?

- **Examples**: Check `examples/` folder for complete examples
- **Documentation**: Read `README.md` for full API reference
- **Setup Guide**: See `docs/SETUP.md` for detailed setup
- **Architecture**: Review `docs/PROJECT_STRUCTURE.md`

## Need Help?

- Review the examples in `examples/`
- Check troubleshooting in `docs/SETUP.md`
- Read the PRD in `docs/PRD.md`

## Using as NPM Package

Once published:

```bash
npm install @vezlo/assistant-client-js
```

```typescript
import { AssistantAI } from '@vezlo/assistant-client-js';
// Use normally
```

---

**Ready to build!** 🚀

