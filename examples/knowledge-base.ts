/**
 * Knowledge Base Example
 * 
 * This example demonstrates how to build and use a knowledge base
 * for context-aware AI responses.
 */

import { AssistantAI } from '../src';

async function main() {
  const assistant = new AssistantAI({
    dbUrl: process.env.SUPABASE_URL!,
    dbKey: process.env.SUPABASE_SERVICE_KEY!,
    aiApiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini'
  });

  await assistant.init();
  console.log('Assistant initialized\n');

  // Add knowledge items
  console.log('Adding knowledge base items...');

  const item1 = await assistant.createKnowledgeItem({
    title: 'Product Authentication',
    type: 'document',
    content: `Our product uses JWT-based authentication. Users can log in using 
    their email and password. After successful authentication, they receive a JWT 
    token that expires after 24 hours. The token must be included in the 
    Authorization header for all API requests.`,
    description: 'Authentication system documentation',
    createdBy: 'admin'
  });
  console.log(`✓ Created item: ${item1.id}`);

  const item2 = await assistant.createKnowledgeItem({
    title: 'API Rate Limits',
    type: 'document',
    content: `Our API enforces rate limits to ensure fair usage. Free tier users 
    are limited to 100 requests per hour. Premium users can make up to 1000 
    requests per hour. Enterprise customers have custom rate limits based on 
    their contract.`,
    description: 'API rate limiting policy',
    createdBy: 'admin'
  });
  console.log(`✓ Created item: ${item2.id}`);

  const item3 = await assistant.createKnowledgeItem({
    title: 'Data Privacy Policy',
    type: 'document',
    content: `We take data privacy seriously. All user data is encrypted at rest 
    and in transit. We comply with GDPR and CCPA regulations. Users can request 
    their data to be exported or deleted at any time through their account 
    settings.`,
    description: 'Privacy and data protection policy',
    createdBy: 'admin'
  });
  console.log(`✓ Created item: ${item3.id}\n`);

  // Rebuild personality based on knowledge base
  console.log('Building personality from knowledge base...');
  const personality = await assistant.buildPersonality({ refresh: true });
  console.log('✓ Personality built:');
  console.log(`  Name: ${personality.profile.name}`);
  console.log(`  Description: ${personality.profile.description}\n`);

  // Search the knowledge base
  console.log('Searching knowledge base for "authentication"...');
  const searchResults = await assistant.searchKnowledge({
    query: 'authentication',
    limit: 3,
    type: 'hybrid'
  });
  console.log(`✓ Found ${searchResults.length} results:`);
  searchResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.title} (score: ${result.score.toFixed(2)})`);
  });
  console.log();

  // Ask a question that requires knowledge base context
  console.log('Asking: "How does authentication work in your system?"\n');
  const response = await assistant.sendMessage({
    message: 'How does authentication work in your system?',
    userId: 'demo-user-789'
  });
  console.log('AI Response:');
  console.log(response.content);
  console.log();

  // Ask about rate limits
  console.log('Asking: "What are the API rate limits?"\n');
  const response2 = await assistant.sendMessage({
    conversationId: response.conversationId,
    message: 'What are the API rate limits?'
  });
  console.log('AI Response:');
  console.log(response2.content);
  console.log();

  // Update a knowledge item
  console.log('Updating authentication documentation...');
  await assistant.updateKnowledgeItem(item1.id, {
    content: `Our product uses JWT-based authentication with OAuth 2.0 support. 
    Users can log in using their email and password, or through social providers 
    like Google and GitHub. After successful authentication, they receive a JWT 
    token that expires after 24 hours. Refresh tokens are also provided for 
    seamless re-authentication.`
  });
  console.log('✓ Knowledge item updated\n');

  console.log('Demo completed!');
}

main().catch(console.error);

