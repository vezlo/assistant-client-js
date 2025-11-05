# Embedding Generation Script

This script generates embeddings for your codebase and stores them in Supabase, making them searchable through the assistant-client-js SDK.

## Features

- **Hybrid Chunking**: Automatically chunks large files while keeping small files as single embeddings
- **Comment Removal**: Optionally removes comments from source code before embedding
- **Multi-language Support**: Supports 20+ programming languages
- **Smart Filtering**: Excludes node_modules, .git, and other unnecessary directories
- **Progress Tracking**: Shows real-time progress and statistics
- **Error Handling**: Continues processing even if individual files fail

## Prerequisites

1. **Supabase Account**: You need a Supabase project with the `ai_knowledge_items` table
2. **OpenAI API Key**: For generating embeddings using `text-embedding-3-small`
3. **Node.js**: Version 14 or higher

## Setup

### 1. Create Configuration File

Copy the example configuration:

```bash
cp config.example.json config.json
```

### 2. Edit Configuration

Edit `config.json` with your credentials:

```json
{
  "supabaseUrl": "https://your-project.supabase.co",
  "supabaseKey": "your-supabase-service-role-key",
  "openaiApiKey": "sk-your-openai-api-key",
  "folderPath": "/path/to/your/project"
}
```

**Important**: Use the **service role key** from Supabase, not the anon key.

### 3. Database Setup (Automatic)

The script will automatically check if the `ai_knowledge_items` table exists in your Supabase database.

**If the table doesn't exist:**
- The script will display the required SQL
- You'll need to copy and run it in your Supabase SQL Editor
- Press Enter when ready, and the script will verify the table was created

**If the table exists:**
- The script will continue automatically

See the main project's `schema.sql` for the complete schema including all tables.

## Usage

### Basic Usage

```bash
node generate-embeddings.js
```

This will read configuration from `config.json` in the same directory.

### Custom Configuration File

```bash
node generate-embeddings.js /path/to/custom-config.json
```

### Make Script Executable

```bash
chmod +x generate-embeddings.js
./generate-embeddings.js
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `supabaseUrl` | string | **Required** | Your Supabase project URL |
| `supabaseKey` | string | **Required** | Your Supabase service role key |
| `openaiApiKey` | string | **Required** | Your OpenAI API key |
| `folderPath` | string | **Required** | Path to the folder to process |
| `chunkSize` | number | 1000 | Characters per chunk |
| `chunkOverlap` | number | 200 | Overlap between chunks |
| `chunkThreshold` | number | 2000 | File size threshold for chunking |
| `removeComments` | boolean | true | Remove code comments before embedding |
| `tablePrefix` | string | "ai_" | Database table prefix |
| `createdBy` | string | "embedding-script" | Creator identifier |
| `extensions` | array | See config | File extensions to process |
| `excludePaths` | array | See config | Paths to exclude |
| `includeFolders` | string | "" (all) | Comma-separated folders to include (e.g., "src,lib") |
| `excludeFolders` | string | "" (none) | Comma-separated folders to exclude (e.g., "tests,docs") |

## How It Works

### 1. File Scanning

The script recursively scans the specified folder, filtering files by:
- Supported extensions (`.js`, `.ts`, `.py`, etc.)
- Excluded paths (`node_modules`, `.git`, etc.)
- Included folders (optional: only scan specific folders)
- Excluded folders (optional: skip specific folders)

### 2. Content Processing

For each file:
- Reads the content
- Detects the programming language
- Removes comments (if enabled)
- Cleans excessive whitespace

### 3. Chunking Strategy

**Hybrid approach**:
- **Small files** (≤ 2000 chars): Single embedding for entire file
- **Large files** (> 2000 chars): Split into overlapping chunks
  - Each chunk: ~1000 characters
  - Overlap: 200 characters between chunks

### 4. Embedding Generation

- Uses OpenAI's `text-embedding-3-small` model
- Generates 1536-dimensional vectors
- Truncates content to 8000 chars (API limit)

### 5. Storage

**For small files**:
- Single row in `ai_knowledge_items`
- Contains full content and embedding

**For large files**:
- One parent row (no content, no embedding)
- Multiple child rows (each chunk with content and embedding)
- Linked via `parent_id`

## Example Output

### When Table Already Exists

```
============================================================
  Embedding Generation Script for assistant-client-js
============================================================

Loading configuration from: /path/to/config.json
Target folder: /path/to/your/project
Chunking threshold: 2000 characters
Remove comments: true

Initializing Supabase connection...
Checking if table 'ai_knowledge_items' exists...
✓ Table 'ai_knowledge_items' exists
Database setup complete!

Scanning directory...
Found 156 files to process

Processing files...
[1/156] (0.6%)
  Processing: src/index.ts
[2/156] (1.3%)
  Processing (chunked): src/AssistantAI.ts - 3 chunks
...

============================================================
  Summary
============================================================
Files processed: 150
Files skipped: 6
Chunks/Items created: 234
Total size: 1234.56 KB
Duration: 45.23 seconds

Language distribution:
  TypeScript: 89
  JavaScript: 42
  JSON: 15
  Markdown: 4

Done!
```

### When Table Doesn't Exist

If the table doesn't exist, the script will pause and display the SQL you need to run:

```
Initializing Supabase connection...
Checking if table 'ai_knowledge_items' exists...
✗ Table 'ai_knowledge_items' does not exist

Creating table...

IMPORTANT: Please run the following SQL in your Supabase SQL Editor:
============================================================

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge items table
CREATE TABLE IF NOT EXISTS ai_knowledge_items (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  parent_id BIGINT REFERENCES ai_knowledge_items(id),
  ...
);

-- Create indexes
...

============================================================

After running the SQL above, press Enter to continue...
Or press Ctrl+C to exit and run the script again later.

Press Enter when ready...
```

Simply:
1. Copy the SQL displayed
2. Go to your Supabase SQL Editor
3. Paste and run the SQL
4. Return to the terminal and press Enter
5. The script will verify the table was created and continue

## Searching the Knowledge Base

After generating embeddings, you can search using the assistant-client-js SDK:

```javascript
const AssistantAI = require('assistant-client-js');

const assistant = new AssistantAI({
  dbUrl: 'https://your-project.supabase.co',
  dbKey: 'your-service-role-key',
  aiApiKey: 'sk-your-openai-key'
});

// Search for relevant code
const results = await assistant.knowledge.search('authentication logic', {
  limit: 5,
  threshold: 0.7
});

console.log(results);
```

## Troubleshooting

### "Config file not found"

Make sure `config.json` exists in the `/scripts` folder. Copy from `config.example.json`.

### "Supabase insert error"

- Verify your Supabase URL and key are correct
- Ensure you're using the **service role key**, not the anon key
- Check that the `ai_knowledge_items` table exists

### "OpenAI API error"

- Verify your OpenAI API key is correct
- Check you have sufficient credits/quota
- Ensure your API key has access to the embeddings endpoint

### "Folder not found"

Check that the `folderPath` in your config points to a valid directory.

### High API Costs

To reduce costs:
- Increase `chunkThreshold` to reduce the number of chunks
- Limit `extensions` to only necessary file types
- Add more paths to `excludePaths`

## Performance Tips

1. **Batch Processing**: The script processes files sequentially. For large codebases, consider splitting into multiple runs.

2. **Cost Estimation**:
   - text-embedding-3-small costs $0.020 per 1M tokens
   - Average: ~750 tokens per file
   - 1000 files ≈ $0.015

3. **Rate Limits**: OpenAI has rate limits. If you hit them, the script will fail. Consider adding delays between requests for very large codebases.

## Advanced Usage

### Process Only Specific Languages

Edit `extensions` in your config:

```json
{
  "extensions": [".js", ".ts", ".jsx", ".tsx"]
}
```

### Exclude Additional Paths

Add more paths to `excludePaths`:

```json
{
  "excludePaths": [
    "node_modules",
    ".git",
    "tests",
    "docs",
    "examples"
  ]
}
```

### Include Only Specific Folders

Process only files in certain folders (e.g., only `src` and `lib`):

```json
{
  "includeFolders": "src,lib,utils"
}
```

This will **only** scan files that are inside `src/`, `lib/`, or `utils/` folders anywhere in your project.

### Exclude Specific Folders

Skip certain folders entirely (e.g., `tests` and `docs`):

```json
{
  "excludeFolders": "tests,docs,examples"
}
```

This will exclude any files in folders named `tests`, `docs`, or `examples`.

**Note:** You can use both `includeFolders` and `excludeFolders` together:
- First, `excludeFolders` is checked (if a folder matches, it's excluded)
- Then, `includeFolders` is checked (if specified, only matching folders are included)

Example - Only process `src` folder but exclude `src/tests`:

```json
{
  "includeFolders": "src",
  "excludeFolders": "tests"
}
```

### Disable Comment Removal

Keep comments in your embeddings:

```json
{
  "removeComments": false
}
```

### Adjust Chunking

For smaller, more precise chunks:

```json
{
  "chunkSize": 500,
  "chunkOverlap": 100,
  "chunkThreshold": 1000
}
```

## License

Same as assistant-client-js
