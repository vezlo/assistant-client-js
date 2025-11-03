/**
 * Streaming Chat Example
 * 
 * This example demonstrates real-time streaming responses
 * from the AI assistant.
 */

import { AssistantAI } from '../src';

async function main() {
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
    enableStreaming: true
  });

  await assistant.init();
  console.log('Assistant initialized. Starting streaming chat...\n');

  // Stream a response
  const stream = assistant.streamMessage({
    message: 'Explain how artificial intelligence works in simple terms.',
    userId: 'demo-user-456'
  });

  console.log('AI Response (streaming):\n');

  let conversationId: string | undefined;
  let messageId: string | undefined;

  for await (const event of stream) {
    switch (event.type) {
      case 'start':
        conversationId = event.conversationId;
        console.log(`[Started conversation: ${conversationId}]\n`);
        break;

      case 'delta':
        // Print each chunk as it arrives
        process.stdout.write(event.content);
        break;

      case 'final':
        messageId = event.messageId;
        console.log(`\n\n[Message saved: ${messageId}]`);
        console.log(`[Conversation: ${event.conversationId}]`);
        break;

      case 'error':
        console.error('\nError:', event.error);
        break;
    }
  }

  console.log('\nStreaming completed!');

  // Continue the conversation with another streamed message
  if (conversationId) {
    console.log('\nSending follow-up question...\n');

    const stream2 = assistant.streamMessage({
      conversationId,
      message: 'Can you give me a specific example?'
    });

    console.log('AI Response (streaming):\n');

    for await (const event of stream2) {
      if (event.type === 'delta') {
        process.stdout.write(event.content);
      } else if (event.type === 'final') {
        console.log(`\n\n[Message saved: ${event.messageId}]`);
      }
    }
  }

  console.log('\n\nDemo completed!');
}

main().catch(console.error);

