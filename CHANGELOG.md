# Changelog

## [Unreleased]

### Added
- **Context Support**: Messages now support `context` parameter to pass additional metadata
  - Context is stored in message metadata for both user and assistant messages
  - Assistant messages automatically track knowledge usage in metadata
  - Context can be retrieved from message metadata later
  
- **Feedback System**: Complete feedback functionality for messages
  - `submitFeedback()` - Submit positive/negative feedback with optional category, comment, and suggestions
  - `getMessageFeedback()` - Retrieve all feedback for a specific message
  - `getUserFeedback()` - Get feedback history for a user
  - New `FeedbackRepository` to handle feedback operations
  
- **Conversation Management**:
  - `updateConversationTitle()` - Update conversation title after creation
  - `getConversationsByUser()` - Alias for listing user conversations
  
- **Enhanced Validation**:
  - Better error messages explaining when to use `conversationId` vs `userId`
  - Conversation existence validation before sending messages
  - Clear separation between proper flow (create conversation → send messages) and convenience flow (auto-create)

### Changed
- **Message Flow Improvements**:
  - Messages now properly validate conversation existence
  - Better error handling with descriptive messages
  - Improved metadata tracking (knowledge usage, streaming status, user context)
  
- **Documentation Updates**:
  - README now shows proper data model: `User → Conversations → Messages`
  - All examples updated to use recommended pattern (create conversation first, then send messages)
  - Added comprehensive context usage examples
  - Added feedback system documentation
  - Clarified when to use `conversationId` vs `userId`

### Fixed
- Fixed documentation inconsistencies where `userId` was shown for sending messages instead of `conversationId`
- Corrected flow to properly reflect that messages belong to conversations, conversations belong to users

## Schema
No database changes required. Existing schema already supports:
- Conversation `creator_id` links to users
- Message `conversation_id` links to conversations  
- Message `metadata` JSONB field stores context
- Feedback table ready for use

