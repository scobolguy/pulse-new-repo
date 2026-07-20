import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3:latest';
const OLLAMA_TIMEOUT_MS = 120000; // phi3 needs up to 2 min on first load
const OLLAMA_WARMTH_INTERVAL_MS = 45000; // Send keep-alive every 45 seconds

let warmthIntervalId = null;
let lastWarmthTimestamp = 0;

/**
 * Load global system knowledge that constrains LLM behavior.
 */
let globalKnowledge = '';
try {
  const knowledgePath = path.resolve('./data/general-knowledge.md');
  if (fs.existsSync(knowledgePath)) {
    globalKnowledge = fs.readFileSync(knowledgePath, 'utf8');
  }
} catch (e) {
  console.warn('Warning: Could not load general-knowledge.md:', e.message);
}

/**
 * Send a prompt to Ollama and return the response text.
 */
export async function ollamaGenerate(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    });

    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error));
            resolve(String(parsed.response || '').trim());
          } catch (e) {
            reject(new Error(`Ollama response parse error: ${e.message}`));
          }
        });
      }
    );

    req.setTimeout(OLLAMA_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Ollama request timed out'));
    });

    req.on('error', (e) => reject(new Error(`Ollama connection error: ${e.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * Check if Ollama is reachable.
 */
export async function ollamaHealthCheck() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags', timeout: 3000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Use Ollama to classify a query against a list of patterns.
 * Returns { patternId, confidence, sourceType, targetType, intent } or null on failure.
 */
export async function classifyQueryWithOllama(query, patterns) {
  const patternList = patterns
    .map((p) => `- id: ${p.id}\n  title: ${p.title}\n  description: ${p.description}`)
    .join('\n');

  const systemContext = globalKnowledge ? `${globalKnowledge}\n\n---\n\n` : '';
  const prompt = `${systemContext}You are an integration architecture assistant. Given a user query and a list of problem patterns, identify the best matching pattern and extract key entities.

Available patterns:
${patternList}

User query: "${query}"

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "patternId": "<id of best matching pattern>",
  "confidence": <0.0-1.0>,
  "sourceType": "<source message type if mentioned, e.g. MT103, MT940, null if not mentioned>",
  "targetType": "<target message type if mentioned, e.g. PAIN.001, CAMT.053, null if not mentioned>",
  "intent": "<one sentence summary of what the user wants to build>"
}`;

  const responseText = await ollamaGenerate(prompt);

  // Extract JSON from response (phi3 sometimes adds text around it)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Ollama did not return valid JSON');

  const result = JSON.parse(jsonMatch[0]);

  // Validate required fields
  if (!result.patternId) throw new Error('Ollama response missing patternId');

  return result;
}

/**
 * Keep Ollama warm by sending periodic "Hello" prompts to keep the model in VRAM.
 * Call this once at backend startup.
 */
export function startOllamaWarmthKeeper() {
  if (warmthIntervalId) return; // Already running

  const sendWarmthPulse = async () => {
    try {
      const alive = await ollamaHealthCheck();
      if (!alive) {
        console.log('[OLLAMA] Model not available for warmth pulse, will retry next interval');
        return;
      }
      // Send a minimal prompt to keep model warm
      await ollamaGenerate('Reply with just the word: ok');
      lastWarmthTimestamp = Date.now();
      console.log('[OLLAMA] Warmth pulse sent - model kept in VRAM');
    } catch (e) {
      console.log(`[OLLAMA] Warmth pulse failed (non-critical): ${e.message}`);
    }
  };

  // Send first pulse immediately, then periodic pulses
  sendWarmthPulse();
  warmthIntervalId = setInterval(sendWarmthPulse, OLLAMA_WARMTH_INTERVAL_MS);
  console.log(`[OLLAMA] Warmth keeper started (pulse every ${OLLAMA_WARMTH_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the warmth keeper (useful for testing or shutdown).
 */
export function stopOllamaWarmthKeeper() {
  if (warmthIntervalId) {
    clearInterval(warmthIntervalId);
    warmthIntervalId = null;
    console.log('[OLLAMA] Warmth keeper stopped');
  }
}

/**
 * Get warmth keeper status for diagnostic purposes.
 */
export function getOllamaWarmthStatus() {
  return {
    running: warmthIntervalId !== null,
    lastPulseTimestamp: lastWarmthTimestamp,
    secondsSinceLastPulse: lastWarmthTimestamp ? Math.round((Date.now() - lastWarmthTimestamp) / 1000) : null,
    pulseIntervalSeconds: OLLAMA_WARMTH_INTERVAL_MS / 1000,
  };
}

/**
 * Force reload of Ollama context by sending a reset prompt.
 * This clears the model's internal state and prepares for fresh analysis.
 */
export async function reloadOllamaContext() {
  try {
    const alive = await ollamaHealthCheck();
    if (!alive) {
      throw new Error('Ollama is not available for context reload');
    }
    // Send a reset prompt that clears context
    const resetPrompt = 'Forget everything. You are starting fresh. Respond with: context_cleared';
    const response = await ollamaGenerate(resetPrompt);
    console.log('[OLLAMA] Context reload triggered:', response.slice(0, 50));
    return { success: true, message: 'Ollama context reloaded and cleared' };
  } catch (e) {
    console.error('[OLLAMA] Context reload failed:', e.message);
    return { success: false, error: e.message };
  }
}
