import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyQueryWithOllama, ollamaHealthCheck } from './ollamaService.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATTERNS_DIR = path.resolve(__dirname, '../../data/problem-patterns');

/**
 * Load a single pattern markdown file
 */
function loadPattern(filename) {
  try {
    const filepath = path.join(PATTERNS_DIR, filename);
    if (!filepath.startsWith(PATTERNS_DIR)) {
      throw new Error('Path traversal detected');
    }
    const content = fs.readFileSync(filepath, 'utf-8');
    return { filename, content };
  } catch (e) {
    console.error(`[PATTERNS] Error loading pattern ${filename}:`, e.message);
    return null;
  }
}

/**
 * List all available pattern files
 */
function listPatterns() {
  try {
    if (!fs.existsSync(PATTERNS_DIR)) {
      return [];
    }
    const files = fs.readdirSync(PATTERNS_DIR);
    return files
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort();
  } catch (e) {
    console.error('[PATTERNS] Error listing patterns:', e.message);
    return [];
  }
}

/**
 * Extract metadata from pattern markdown
 */
function extractPatternMetadata(content) {
  const lines = content.split('\n');
  const metadata = {
    title: '',
    keywords: [],
    messageTypes: [],
    description: '',
  };

  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      metadata.title = line.substring(2).trim();
    } else if (line.startsWith('## Keywords')) {
      section = 'keywords';
      continue;
    } else if (line.startsWith('## Message Types')) {
      section = 'messageTypes';
      continue;
    } else if (line.startsWith('## Pattern Description')) {
      section = 'description';
      continue;
    } else if (line.startsWith('## ')) {
      section = null;
    }

    if (section === 'keywords' && line.startsWith('- ')) {
      metadata.keywords.push(line.substring(2).trim().toLowerCase());
    } else if (section === 'messageTypes' && line.startsWith('- ')) {
      const msgType = line.substring(2).trim();
      if (!msgType.startsWith('Any:')) {
        metadata.messageTypes.push(msgType);
      }
    } else if (section === 'description' && line.trim()) {
      if (!metadata.description) {
        metadata.description = line.trim();
      }
    }
  }

  return metadata;
}

/**
 * Score how well a pattern matches a query
 */
function scorePatternMatch(query, metadata) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Keyword matches
  for (const kw of metadata.keywords) {
    if (queryLower.includes(kw)) {
      score += 10;
    }
  }

  // Message type matches
  for (const msgType of metadata.messageTypes) {
    if (queryLower.includes(msgType.toLowerCase())) {
      score += 5;
    }
  }

  return score;
}

/**
 * Register pattern loading routes
 */
export function registerPatternRoutes(app) {
  // List all available patterns with metadata
  app.get('/api/patterns', (req, res) => {
    try {
      const patternFiles = listPatterns();
      const patterns = [];

      for (const filename of patternFiles) {
        const pattern = loadPattern(filename);
        if (pattern) {
          const metadata = extractPatternMetadata(pattern.content);
          patterns.push({
            id: filename.replace('.md', ''),
            filename,
            ...metadata,
          });
        }
      }

      res.json({ patterns });
    } catch (e) {
      console.error('[PATTERNS] Error in /api/patterns:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Get a specific pattern by filename
  app.get('/api/patterns/:id', (req, res) => {
    try {
      const { id } = req.params;
      const filename = id.endsWith('.md') ? id : `${id}.md`;

      const pattern = loadPattern(filename);
      if (!pattern) {
        return res.status(404).json({ error: 'Pattern not found' });
      }

      const metadata = extractPatternMetadata(pattern.content);
      res.json({
        id: id.replace('.md', ''),
        filename,
        content: pattern.content,
        ...metadata,
      });
    } catch (e) {
      console.error('[PATTERNS] Error in /api/patterns/:id:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Match patterns against a query (Ollama-powered with keyword fallback)
  app.post('/api/patterns/match', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'query parameter required' });
      }

      const patternFiles = listPatterns();
      const allPatterns = [];
      for (const filename of patternFiles) {
        const pattern = loadPattern(filename);
        if (pattern) {
          const metadata = extractPatternMetadata(pattern.content);
          allPatterns.push({ id: filename.replace('.md', ''), filename, ...metadata });
        }
      }

      // Try Ollama first
      const ollamaAvailable = await ollamaHealthCheck();
      if (ollamaAvailable) {
        try {
          const classification = await classifyQueryWithOllama(query, allPatterns);
          const matched = allPatterns.find((p) => p.id === classification.patternId);
          if (matched) {
            console.log(`[PATTERNS] Ollama matched: ${matched.id} (confidence=${classification.confidence})`);
            // Put the Ollama top match first, append remaining sorted by keyword score
            const rest = allPatterns
              .filter((p) => p.id !== matched.id)
              .map((p) => ({ ...p, score: scorePatternMatch(query, p) }))
              .filter((p) => p.score > 0)
              .sort((a, b) => b.score - a.score);
            return res.json({
              query,
              engine: 'ollama',
              model: process.env.OLLAMA_MODEL || 'phi3:latest',
              classification,
              matches: [{ ...matched, score: Math.round(classification.confidence * 100) }, ...rest].slice(0, 3),
            });
          }
        } catch (e) {
          console.warn('[PATTERNS] Ollama classification failed, falling back to keyword scoring:', e.message);
        }
      }

      // Keyword fallback
      console.log('[PATTERNS] Using keyword scoring (Ollama unavailable or failed)');
      const matches = allPatterns
        .map((p) => ({ ...p, score: scorePatternMatch(query, p) }))
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score);

      res.json({
        query,
        engine: 'keyword',
        matches: matches.slice(0, 3), // Top 3 matches
      });
    } catch (e) {
      console.error('[PATTERNS] Error in /api/patterns/match:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  console.log('[PATTERNS] Routes registered at /api/patterns*');
}
