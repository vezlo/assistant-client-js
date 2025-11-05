#!/usr/bin/env node

/**
 * Embedding Generation Script for assistant-client-js
 *
 * This script scans a specified folder, processes source code files,
 * generates embeddings using OpenAI, and stores them in Supabase.
 *
 * Usage: node generate-embeddings.js [config-file]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
let config = null;
const stats = {
  filesProcessed: 0,
  filesSkipped: 0,
  chunksCreated: 0,
  totalSize: 0,
  errors: [],
  languageDistribution: {}
};

// File size threshold for chunking (in characters)
const CHUNK_THRESHOLD = 2000;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx',
  '.py', '.java', '.cpp', '.c', '.h', '.hpp',
  '.cs', '.php', '.rb', '.go', '.rs',
  '.swift', '.kt', '.scala', '.sh', '.bash',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.xml',
  '.sql', '.md', '.txt'
];

// Paths to exclude
const EXCLUDE_PATHS = [
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.nuxt', 'out', 'target', 'bin', 'obj',
  '__pycache__', '.pytest_cache', '.venv', 'venv',
  'vendor', 'bower_components', '.idea', '.vscode'
];

// Language detection map
const LANGUAGE_MAP = {
  '.js': 'JavaScript', '.jsx': 'JavaScript React',
  '.ts': 'TypeScript', '.tsx': 'TypeScript React',
  '.py': 'Python', '.java': 'Java',
  '.cpp': 'C++', '.c': 'C', '.h': 'C/C++ Header',
  '.cs': 'C#', '.php': 'PHP', '.rb': 'Ruby',
  '.go': 'Go', '.rs': 'Rust', '.swift': 'Swift',
  '.kt': 'Kotlin', '.scala': 'Scala',
  '.sh': 'Shell', '.bash': 'Bash',
  '.html': 'HTML', '.css': 'CSS',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
  '.sql': 'SQL', '.md': 'Markdown'
};

/**
 * Load configuration from file
 */
function loadConfig(configPath) {
  try {
    const configFile = configPath || path.join(__dirname, 'config.json');
    console.log(`Loading configuration from: ${configFile}`);

    if (!fs.existsSync(configFile)) {
      console.error(`Config file not found: ${configFile}`);
      console.error('Please create a config.json file. See config.example.json for reference.');
      process.exit(1);
    }

    const configContent = fs.readFileSync(configFile, 'utf8');
    config = JSON.parse(configContent);

    // Validate required fields
    if (!config.supabaseUrl || !config.supabaseKey || !config.openaiApiKey || !config.folderPath) {
      console.error('Missing required configuration fields.');
      console.error('Required: supabaseUrl, supabaseKey, openaiApiKey, folderPath');
      process.exit(1);
    }

    // Apply defaults
    config.chunkSize = config.chunkSize || CHUNK_SIZE;
    config.chunkOverlap = config.chunkOverlap || CHUNK_OVERLAP;
    config.chunkThreshold = config.chunkThreshold || CHUNK_THRESHOLD;
    config.excludePaths = config.excludePaths || EXCLUDE_PATHS;
    config.extensions = config.extensions || SUPPORTED_EXTENSIONS;
    config.removeComments = config.removeComments !== false; // Default true
    config.tablePrefix = config.tablePrefix || 'ai_';
    config.createdBy = config.createdBy || 'embedding-script';

    // Parse folder filters
    // includeFolders: comma-separated list of folders to include (e.g., "src,lib,utils")
    // excludeFolders: comma-separated list of folders to exclude (e.g., "tests,docs")
    config.includeFolders = config.includeFolders
      ? config.includeFolders.split(',').map(f => f.trim()).filter(f => f)
      : null;
    config.excludeFolders = config.excludeFolders
      ? config.excludeFolders.split(',').map(f => f.trim()).filter(f => f)
      : [];

    console.log(`Target folder: ${config.folderPath}`);
    console.log(`Chunking threshold: ${config.chunkThreshold} characters`);
    console.log(`Remove comments: ${config.removeComments}`);
    if (config.includeFolders) {
      console.log(`Include only folders: ${config.includeFolders.join(', ')}`);
    }
    if (config.excludeFolders.length > 0) {
      console.log(`Exclude folders: ${config.excludeFolders.join(', ')}`);
    }
    console.log('');

    return config;
  } catch (error) {
    console.error('Error loading configuration:', error.message);
    process.exit(1);
  }
}

/**
 * Initialize Supabase client
 */
function createSupabaseClient(url, key) {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;

  return {
    from: (table) => ({
      insert: async (data) => {
        const response = await fetch(`${baseUrl}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Supabase insert error: ${response.status} - ${error}`);
        }

        return { data: await response.json(), error: null };
      },
      select: async (columns = '*') => {
        const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${columns}`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          }
        });

        if (!response.ok) {
          throw new Error(`Supabase select error: ${response.status}`);
        }

        return { data: await response.json(), error: null };
      }
    }),
    rpc: async (functionName, params = {}) => {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase RPC error: ${response.status} - ${error}`);
      }

      return { data: await response.json(), error: null };
    },
    // Direct SQL execution
    sql: async (query) => {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      // If exec_sql doesn't exist, try direct query via PostgREST
      if (response.status === 404) {
        // Use a workaround with PostgREST's query parameter
        const postgrestResponse = await fetch(`${baseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/vnd.pgrst.object+json',
            'Accept': 'application/json'
          }
        });
      }

      return { ok: response.ok, status: response.status };
    }
  };
}

/**
 * Check if table exists and create if needed
 */
async function ensureTableExists(supabaseUrl, supabaseKey, tableName) {
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

  console.log(`Checking if table '${tableName}' exists...`);

  // Try to query the table - if it exists, this will succeed
  try {
    const response = await fetch(`${baseUrl}/rest/v1/${tableName}?select=uuid&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.ok) {
      console.log(`✓ Table '${tableName}' exists`);
      return true;
    }

    // If we get a 406 or other error, table might not exist
    if (response.status === 406 || response.status === 404) {
      console.log(`✗ Table '${tableName}' does not exist`);
      console.log('');
      console.log('Creating table...');
      await createTable(supabaseUrl, supabaseKey, tableName);
      return true;
    }

    // For other errors, throw
    throw new Error(`Error checking table: ${response.status} - ${await response.text()}`);
  } catch (error) {
    // If table doesn't exist, create it
    if (error.message.includes('404') || error.message.includes('relation') || error.message.includes('does not exist')) {
      console.log(`✗ Table '${tableName}' does not exist`);
      console.log('');
      console.log('Creating table...');
      await createTable(supabaseUrl, supabaseKey, tableName);
      return true;
    }
    throw error;
  }
}

/**
 * Create the knowledge items table with all indexes
 */
async function createTable(supabaseUrl, supabaseKey, tableName) {
  console.log('');
  console.log('IMPORTANT: Please run the following SQL in your Supabase SQL Editor:');
  console.log('='.repeat(60));
  console.log('');

  const sql = `
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge items table
CREATE TABLE IF NOT EXISTS ${tableName} (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  parent_id BIGINT REFERENCES ${tableName}(id),
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_${tableName}_uuid ON ${tableName}(uuid);
CREATE INDEX IF NOT EXISTS idx_${tableName}_parent_id ON ${tableName}(parent_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_type ON ${tableName}(type);
CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName}(created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_${tableName}_search
ON ${tableName} USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(content, '')));

-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding
ON ${tableName} USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Sparse indexes
CREATE INDEX IF NOT EXISTS idx_${tableName}_content ON ${tableName}(content) WHERE content IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_${tableName}_file_url ON ${tableName}(file_url) WHERE file_url IS NOT NULL;
`;

  console.log(sql);
  console.log('='.repeat(60));
  console.log('');
  console.log('After running the SQL above, press Enter to continue...');
  console.log('Or press Ctrl+C to exit and run the script again later.');
  console.log('');

  // Wait for user input
  await new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Press Enter when ready...', () => {
      rl.close();
      resolve();
    });
  });

  console.log('');
  console.log('Verifying table creation...');

  // Verify table was created
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
  const response = await fetch(`${baseUrl}/rest/v1/${tableName}?select=uuid&limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Table creation verification failed. Please ensure the SQL was executed correctly in Supabase.`);
  }

  console.log(`✓ Table '${tableName}' verified successfully!`);
  console.log('');
}

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // OpenAI limit
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Clean code by removing comments
 */
function cleanContent(content, language) {
  if (!config.removeComments) {
    return content;
  }

  let cleaned = content;

  // Remove single-line comments (//, #)
  if (['JavaScript', 'TypeScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Scala', 'PHP'].some(lang => language.includes(lang))) {
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
  }

  if (language.includes('Python') || language.includes('Shell') || language.includes('Bash') || language.includes('Ruby')) {
    cleaned = cleaned.replace(/#.*$/gm, '');
  }

  // Remove multi-line comments (/* */, """ """, ''' ''')
  if (['JavaScript', 'TypeScript', 'Java', 'C++', 'C', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'Scala', 'PHP', 'CSS'].some(lang => language.includes(lang))) {
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  if (language.includes('Python')) {
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '');
    cleaned = cleaned.replace(/'''[\s\S]*?'''/g, '');
  }

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Create chunks from content
 */
function createChunks(content, fileId, fileName) {
  const chunks = [];
  const lines = content.split('\n');
  const chunkSize = config.chunkSize;
  const overlap = config.chunkOverlap;

  let currentChunk = [];
  let currentSize = 0;
  let chunkIndex = 0;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for newline

    if (currentSize + lineSize > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        id: `${fileId}_chunk_${chunkIndex}`,
        index: chunkIndex,
        content: chunkContent,
        startLine: startLine,
        endLine: i - 1,
        size: currentSize,
        fileName: fileName
      });

      chunkIndex++;

      // Create overlap
      const overlapLines = [];
      let overlapSize = 0;
      for (let j = currentChunk.length - 1; j >= 0; j--) {
        const overlapLine = currentChunk[j];
        if (overlapSize + overlapLine.length + 1 <= overlap) {
          overlapLines.unshift(overlapLine);
          overlapSize += overlapLine.length + 1;
        } else {
          break;
        }
      }

      currentChunk = overlapLines;
      currentSize = overlapSize;
      startLine = i - overlapLines.length;
    }

    currentChunk.push(line);
    currentSize += lineSize;
  }

  // Save last chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n');
    chunks.push({
      id: `${fileId}_chunk_${chunkIndex}`,
      index: chunkIndex,
      content: chunkContent,
      startLine: startLine,
      endLine: lines.length - 1,
      size: currentSize,
      fileName: fileName
    });
  }

  return chunks;
}

/**
 * Check if a path should be included based on folder filters
 */
function shouldIncludePath(relativePath) {
  // Get the path segments (folders in the path)
  const pathSegments = relativePath.split(path.sep).filter(s => s);

  // Check excludeFolders first
  if (config.excludeFolders && config.excludeFolders.length > 0) {
    const isExcluded = config.excludeFolders.some(excludeFolder => {
      return pathSegments.some(segment => segment === excludeFolder);
    });
    if (isExcluded) {
      return false;
    }
  }

  // Check includeFolders (if specified, only include matching paths)
  if (config.includeFolders && config.includeFolders.length > 0) {
    const isIncluded = config.includeFolders.some(includeFolder => {
      return pathSegments.some(segment => segment === includeFolder);
    });
    return isIncluded;
  }

  // If no includeFolders specified, include by default (after exclude check)
  return true;
}

/**
 * Scan directory recursively
 */
function scanDirectory(dirPath, baseDir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Check if path should be excluded (node_modules, .git, etc.)
      const shouldExclude = config.excludePaths.some(excludePath =>
        relativePath.includes(excludePath)
      );

      if (shouldExclude) {
        continue;
      }

      // Check folder filters (includeFolders/excludeFolders)
      if (!shouldIncludePath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, baseDir));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (config.extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }

  return files;
}

/**
 * Process a single file
 */
async function processFile(filePath, supabase) {
  try {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(config.folderPath, filePath);
    const ext = path.extname(fileName).toLowerCase();
    const language = LANGUAGE_MAP[ext] || 'Unknown';

    // Update language distribution
    stats.languageDistribution[language] = (stats.languageDistribution[language] || 0) + 1;

    // Read file
    const content = fs.readFileSync(filePath, 'utf8');
    const fileSize = content.length;
    stats.totalSize += fileSize;

    // Generate file ID
    const fileId = crypto.createHash('md5').update(relativePath).digest('hex');

    // Clean content
    const cleanedContent = cleanContent(content, language);

    if (cleanedContent.length === 0) {
      console.log(`  Skipped (empty after cleaning): ${relativePath}`);
      stats.filesSkipped++;
      return;
    }

    // Decide: chunk or single embedding
    const shouldChunk = cleanedContent.length > config.chunkThreshold;

    if (shouldChunk) {
      // Create parent item
      const parentUuid = crypto.randomUUID();
      const parentResult = await supabase.from(`${config.tablePrefix}knowledge_items`).insert({
        uuid: parentUuid,
        title: fileName,
        description: `Source file: ${relativePath}`,
        type: 'file',
        content: null, // Don't store full content for parent
        metadata: {
          filePath: relativePath,
          language: language,
          fileSize: fileSize,
          isChunked: true,
          originalSize: content.length,
          cleanedSize: cleanedContent.length
        },
        created_by: config.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Get parent ID from the inserted record
      const parentId = parentResult.data && parentResult.data.length > 0 ? parentResult.data[0].id : null;

      // Create chunks
      const chunks = createChunks(cleanedContent, fileId, fileName);
      console.log(`  Processing (chunked): ${relativePath} - ${chunks.length} chunks`);

      // Process each chunk
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.content, config.openaiApiKey);

        const chunkData = {
          uuid: crypto.randomUUID(),
          title: `${fileName} (Chunk ${chunk.index + 1})`,
          description: `Lines ${chunk.startLine + 1}-${chunk.endLine + 1}`,
          type: 'document',
          content: chunk.content,
          metadata: {
            filePath: relativePath,
            language: language,
            chunkIndex: chunk.index,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkSize: chunk.size,
            parentUuid: parentUuid // Store parent UUID in metadata for reference
          },
          embedding: JSON.stringify(embedding),
          processed_at: new Date().toISOString(),
          created_by: config.createdBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Only add parent_id if we have it
        if (parentId) {
          chunkData.parent_id = parentId;
        }

        await supabase.from(`${config.tablePrefix}knowledge_items`).insert(chunkData);

        stats.chunksCreated++;
      }
    } else {
      // Single embedding for entire file
      console.log(`  Processing: ${relativePath}`);

      const embedding = await generateEmbedding(cleanedContent, config.openaiApiKey);

      await supabase.from(`${config.tablePrefix}knowledge_items`).insert({
        uuid: crypto.randomUUID(),
        title: fileName,
        description: `Source file: ${relativePath}`,
        type: 'file',
        content: cleanedContent,
        metadata: {
          filePath: relativePath,
          language: language,
          fileSize: fileSize,
          isChunked: false,
          originalSize: content.length,
          cleanedSize: cleanedContent.length
        },
        embedding: JSON.stringify(embedding),
        processed_at: new Date().toISOString(),
        created_by: config.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      stats.chunksCreated++;
    }

    stats.filesProcessed++;
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error.message);
    stats.errors.push({ file: filePath, error: error.message });
    stats.filesSkipped++;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  Embedding Generation Script for assistant-client-js');
  console.log('='.repeat(60));
  console.log('');

  // Load configuration
  const configPath = process.argv[2];
  loadConfig(configPath);

  // Validate folder path
  if (!fs.existsSync(config.folderPath)) {
    console.error(`Error: Folder not found: ${config.folderPath}`);
    process.exit(1);
  }

  // Initialize Supabase client
  console.log('Initializing Supabase connection...');
  const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

  // Ensure table exists (create if needed)
  try {
    await ensureTableExists(
      config.supabaseUrl,
      config.supabaseKey,
      `${config.tablePrefix}knowledge_items`
    );
    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up database:', error.message);
    console.error('Please check your Supabase URL and key.');
    process.exit(1);
  }

  console.log('');

  // Scan directory
  console.log('Scanning directory...');
  const files = scanDirectory(config.folderPath, config.folderPath);
  console.log(`Found ${files.length} files to process`);
  console.log('');

  if (files.length === 0) {
    console.log('No files found to process. Exiting.');
    return;
  }

  // Process files
  console.log('Processing files...');
  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = ((i + 1) / files.length * 100).toFixed(1);
    console.log(`[${i + 1}/${files.length}] (${progress}%)`);
    await processFile(file, supabase);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files skipped: ${stats.filesSkipped}`);
  console.log(`Chunks/Items created: ${stats.chunksCreated}`);
  console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Duration: ${duration} seconds`);
  console.log('');
  console.log('Language distribution:');
  Object.entries(stats.languageDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([lang, count]) => {
      console.log(`  ${lang}: ${count}`);
    });

  if (stats.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    stats.errors.forEach(err => {
      console.log(`  ${err.file}: ${err.error}`);
    });
  }

  console.log('');
  console.log('Done!');
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
