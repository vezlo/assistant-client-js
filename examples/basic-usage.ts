/**
 * Basic Usage Example
 * 
 * This example demonstrates how to use the Assistant AI SDK
 * for basic chat functionality.
 */

import { AssistantAI } from '../src';

async function main() {
  // Initialize the SDK
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
    temperature: 0.7,
    tablePrefix: 'ai_'
  });

  // Initialize (builds personality if not exists)
  console.log('Initializing assistant...');
  await assistant.init();
  console.log('✓ Assistant initialized\n');

  // Create a conversation
  console.log('Creating conversation...');
  const { conversationId } = await assistant.createConversation({
    userId: 'demo-user-123',
    title: 'Demo Conversation'
  });
  console.log(`✓ Created conversation: ${conversationId}\n`);

  // Send first message
  console.log('Sending message: "Hello, how can you help me?"\n');
  const response1 = await assistant.sendMessage({
    conversationId,
    message: 'Hello, how can you help me?'
  });
  console.log('AI Response:', response1.content);
  console.log(`Message ID: ${response1.messageId}\n`);

  // Send follow-up message
  console.log('Sending follow-up: "What are your capabilities?"\n');
  const response2 = await assistant.sendMessage({
    conversationId,
    message: 'What are your capabilities?'
  });
  console.log('AI Response:', response2.content);
  console.log(`Message ID: ${response2.messageId}\n`);

  // Get full conversation history
  console.log('Retrieving conversation history...');
  const conversation = await assistant.getConversation(conversationId);
  console.log(`✓ Conversation has ${conversation.messages.length} messages\n`);

  // List all conversations for user
  console.log('Listing all conversations for user...');
  const conversations = await assistant.listConversations('demo-user-123');
  console.log(`✓ Found ${conversations.length} conversation(s)\n`);

  console.log('Demo completed!');
}

// Run the example
main().catch(console.error);

