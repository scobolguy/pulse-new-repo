import http from 'http';
import fs from 'fs';
import path from 'path';
import { getNliConfig, reloadNliConfig } from './nliConfig.mjs';
import { loadNliCorrections } from './nliCorrectionService.mjs';

let warmthIntervalId = null;
let lastWarmthTimestamp = 0;

/**
 * Load global system knowledge that constrains LLM behavior.
 * The full file is kept for classifyQueryWithOllama(); a compact
 * version is derived for use as the system prompt in every generate call.
 */
let globalKnowledge = '';
let systemPrompt = '';

try {
  const knowledgePath = path.resolve('./data/general-knowledge.md');
  if (fs.existsSync(knowledgePath)) {
    globalKnowledge = fs.readFileSync(knowledgePath, 'utf8');
  }
} catch (e) {
  console.warn('Warning: Could not load general-knowledge.md:', e.message);
}

/**
 * Build a compact system prompt from the loaded knowledge.
 * Kept short (<300 tokens) so it doesn't dominate the context window.
 * Derived once at startup; call rebuildSystemPrompt() after a hot-reload.
 */
function buildSystemPrompt(knowledge) {
  const config = getNliConfig();
  const promptConfig = config.systemPrompt || {};
  const resourcesMatch = knowledge.match(/###\s*Resources Supported([\s\S]*?)(?=\n###|\n##|$)/i);
  const resourcesSnippet = resourcesMatch
    ? resourcesMatch[1].trim().split('\n').slice(0, 12).join('\n')
    : '';

  const assistantName = promptConfig.assistantName || 'BOB';
  const role = promptConfig.role || 'an assistant for the Pulse integration platform';
  const capabilities = Array.isArray(promptConfig.capabilities) ? promptConfig.capabilities.join(', ') : '';
  const rules = Array.isArray(promptConfig.rules) ? promptConfig.rules.map(rule => `- ${rule}`).join('\n') : '';
  const corrections = loadNliCorrections()
    .slice(-config.corrections.maxPromptCorrections)
    .map(correction => `- When the user says "${correction.message}", follow this guidance: ${correction.expected}`)
    .join('\n');

  return `You are ${assistantName}, ${role}.
${promptConfig.platformSummary || ''}
${capabilities ? `Capabilities you can speak to: ${capabilities}.` : ''}
${rules ? `Rules:\n${rules}` : ''}
${corrections ? `User-approved corrections:\n${corrections}` : ''}
${resourcesSnippet ? `\nPlatform resources:\n${resourcesSnippet}` : ''}`.trim();
}

systemPrompt = buildSystemPrompt(globalKnowledge);

/**
 * Rebuild the system prompt (called after a context reload so the new
 * knowledge takes effect without restarting the process).
 */
export function rebuildSystemPrompt() {
  systemPrompt = buildSystemPrompt(globalKnowledge);
}

/**
 * Send a prompt to Ollama and return the complete response text.
 * Uses native streaming internally so tokens are received as they are generated —
 * the timeout only fires if *no data at all* arrives within timeoutMs.
 */
export async function ollamaGenerate(prompt) {
  const config = getNliConfig();
  if (config.provider !== 'ollama') {
    throw new Error(`Unsupported local NLI provider: ${config.provider}`);
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      system: systemPrompt,
      prompt,
      stream: true,
      keep_alive: config.keepAlive,
      options: config.options,
    });

    let accumulated = '';
    let firstChunkReceived = false;
    let idleTimer = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        req.destroy();
        reject(new Error('Ollama request timed out (no data received)'));
      }, config.timeoutMs);
    };

    const req = http.request(
      {
        hostname: config.host,
        port: config.port,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            clearTimeout(idleTimer);
            idleTimer = null;
          }
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.error) { req.destroy(); reject(new Error(parsed.error)); return; }
              accumulated += String(parsed.response || '');
            } catch { /* skip malformed lines */ }
          }
        });
        res.on('end', () => {
          clearTimeout(idleTimer);
          resolve(accumulated.trim());
        });
      }
    );

    resetIdleTimer(); // start the first-token deadline
    req.on('error', (e) => { clearTimeout(idleTimer); reject(new Error(`Ollama connection error: ${e.message}`)); });
    req.write(body);
    req.end();
  });
}

/**
 * Stream a prompt to Ollama, calling onToken for each token as it arrives and
 * onStatus for progress notes. Returns the full accumulated text.
 *
 * onToken(token: string) — called for each generated token
 * onStatus(msg: string) — called with human-readable progress notes
 */
export async function ollamaGenerateStream(prompt, { onToken, onStatus } = {}) {
  const config = getNliConfig();
  if (config.provider !== 'ollama') {
    throw new Error(`Unsupported local NLI provider: ${config.provider}`);
  }

  onStatus?.(`Using model ${config.model} — waiting for first token...`);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      system: systemPrompt,
      prompt,
      stream: true,
      keep_alive: config.keepAlive,
      options: config.options,
    });

    let accumulated = '';
    let tokenCount = 0;
    let firstChunkReceived = false;
    let idleTimer = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        req.destroy();
        // Resolve with partial result rather than reject — caller decides what to do
        resolve({ text: accumulated.trim(), partial: true, reason: 'timeout' });
      }, config.timeoutMs);
    };

    const req = http.request(
      {
        hostname: config.host,
        port: config.port,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            clearTimeout(idleTimer);
            idleTimer = null;
            onStatus?.('Generating response...');
          }
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.error) { req.destroy(); reject(new Error(parsed.error)); return; }
              const token = String(parsed.response || '');
              if (token) {
                accumulated += token;
                tokenCount += 1;
                onToken?.(token);
                if (tokenCount % 50 === 0) {
                  onStatus?.(`Generated ${tokenCount} tokens...`);
                }
              }
              if (parsed.done) {
                const stats = parsed.eval_count
                  ? ` (${parsed.eval_count} tokens, ${Math.round((parsed.eval_count / (parsed.eval_duration / 1e9)) * 10) / 10} t/s)`
                  : '';
                onStatus?.(`Done${stats}`);
              }
            } catch { /* skip malformed lines */ }
          }
        });
        res.on('end', () => {
          clearTimeout(idleTimer);
          resolve({ text: accumulated.trim(), partial: false });
        });
      }
    );

    resetIdleTimer();
    req.on('error', (e) => { clearTimeout(idleTimer); reject(new Error(`Ollama connection error: ${e.message}`)); });
    req.write(body);
    req.end();
  });
}

/**
 * Check if Ollama is reachable.
 */
export async function ollamaHealthCheck() {
  const config = getNliConfig();
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: config.host, port: config.port, path: '/api/tags', timeout: 3000 },
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

  // Tolerate models that add prose around the requested JSON object.
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
  const { warmthIntervalMs, model } = getNliConfig();

  const sendWarmthPulse = async (reason = 'interval') => {
    try {
      const alive = await ollamaHealthCheck();
      if (!alive) {
        console.log('[OLLAMA] Model not available for warmth pulse, will retry next interval');
        return;
      }
      // Use a real short prompt so the model is fully loaded into VRAM, not just health-checked
      await ollamaGenerate('Respond with: ready');
      lastWarmthTimestamp = Date.now();
      console.log(`[OLLAMA] Warmth pulse sent (${reason}) — model ${model} loaded and ready`);
    } catch (e) {
      console.log(`[OLLAMA] Warmth pulse failed (non-critical): ${e.message}`);
    }
  };

  // Send first pulse immediately at startup so the model is in VRAM before the first user query
  console.log(`[OLLAMA] Loading model ${model} into VRAM at startup...`);
  sendWarmthPulse('startup');
  warmthIntervalId = setInterval(() => sendWarmthPulse('interval'), warmthIntervalMs);
  console.log(`[OLLAMA] Warmth keeper started (pulse every ${warmthIntervalMs / 1000}s)`);
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
  const config = getNliConfig();
  return {
    running: warmthIntervalId !== null,
    lastPulseTimestamp: lastWarmthTimestamp,
    secondsSinceLastPulse: lastWarmthTimestamp ? Math.round((Date.now() - lastWarmthTimestamp) / 1000) : null,
    pulseIntervalSeconds: config.warmthIntervalMs / 1000,
    profile: config.profile,
    model: config.model,
  };
}

/**
 * Force reload of Ollama context by sending a reset prompt.
 * This clears the model's internal state and prepares for fresh analysis.
 */
export async function reloadOllamaContext() {
  try {
    reloadNliConfig();
    const alive = await ollamaHealthCheck();
    if (!alive) {
      throw new Error('Ollama is not available for context reload');
    }
    // Re-read general-knowledge.md from disk so edits take effect without a restart
    try {
      const knowledgePath = path.resolve('./data/general-knowledge.md');
      if (fs.existsSync(knowledgePath)) {
        globalKnowledge = fs.readFileSync(knowledgePath, 'utf8');
      }
    } catch (e) {
      console.warn('[OLLAMA] Could not reload general-knowledge.md:', e.message);
    }
    rebuildSystemPrompt();

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
