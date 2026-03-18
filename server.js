const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('Key loaded:', process.env.CLAUDE_API_KEY
  ? 'YES - first 10 chars: ' + process.env.CLAUDE_API_KEY.substring(0, 10)
  : 'NO - KEY MISSING');

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'DeutschWeg Exam Whisperer API is running' });
});

// ── POST /api/score ─────────────────────────────────────────────────────────
app.post('/api/score', async (req, res) => {
  const { text, level } = req.body;

  // --- Validate request ---
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a writing sample (at least 10 characters).' });
  }
  const validLevels = ['A1', 'A2', 'B1'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: 'Invalid exam level. Use A1, A2, or B1.' });
  }

  // --- Check API key is configured ---
  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set in .env');
    return res.status(500).json({ error: 'API key not configured. Add CLAUDE_API_KEY to your .env file.' });
  }

  // --- Build the examiner prompt ---
  const prompt = `You are a Goethe exam examiner scoring African learners. Score this ${level} Schreiben submission out of 40 using the official rubric:
- Task fulfilment: 10 pts
- Grammar: 10 pts
- Vocabulary: 10 pts
- Structure: 10 pts

Give an instant score, breakdown per category with specific errors found, exactly 3 fixes with exact point gains, and a corrected version of the full text.

Focus especially on these common African learner errors:
- Word order after "weil" (verb must go to end)
- Missing or wrong articles (der/die/das/den)
- Literal word-for-word English translations
- Forgetting infinitive at end with modal verbs
- Perfekt tense formation errors

Format your entire response as a single raw JSON object — no markdown, no code fences, no extra text before or after the JSON. Use this exact structure:
{
  "total": 26,
  "breakdown": {
    "task":       { "score": 7, "feedback": "Specific feedback on what task content was present and what was missing" },
    "grammar":    { "score": 5, "feedback": "List specific grammar errors found, e.g. weil clause word order, missing article" },
    "vocabulary": { "score": 7, "feedback": "Comment on range and variety, note repeated words or missed opportunities" },
    "structure":  { "score": 7, "feedback": "Comment on greeting, paragraph flow, sign-off, connectors used" }
  },
  "fixes": [
    {
      "points": 2,
      "category": "Grammar",
      "fix": "Clear one-sentence explanation of the fix",
      "wrong":   "Example sentence from their text showing the error",
      "correct": "The corrected version of that sentence"
    },
    {
      "points": 3,
      "category": "Task",
      "fix": "Clear one-sentence explanation",
      "wrong":   "What they wrote or omitted",
      "correct": "What they should have written"
    },
    {
      "points": 3,
      "category": "Vocabulary",
      "fix": "Clear one-sentence explanation",
      "wrong":   "Weak phrase they used",
      "correct": "Stronger B-level replacement"
    }
  ],
  "corrected_version": "The full rewritten text with all errors fixed, preserving the student's ideas but using correct German"
}

Student's ${level} submission:
"""
${text.trim()}
"""`;

  // --- Call Claude API ---
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data       = await response.json();
    const rawContent = data?.content?.[0]?.text ?? '';

    // --- Parse JSON from Claude's response ---
    // Claude should return raw JSON, but strip any accidental code fences just in case
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,           '')
      .trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error. Raw response:\n', rawContent);
      return res.status(502).json({ error: 'Could not parse scoring response. Try again.' });
    }

    // --- Basic shape validation ---
    if (
      typeof result.total !== 'number' ||
      !result.breakdown ||
      !Array.isArray(result.fixes) ||
      typeof result.corrected_version !== 'string'
    ) {
      return res.status(502).json({ error: 'Unexpected response format from AI. Try again.' });
    }

    return res.json(result);

  } catch (err) {
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ✦ DeutschWeg Exam Whisperer API');
  console.log(`  ✦ Running at http://localhost:${PORT}`);
  console.log('  ✦ POST /api/score to score a Schreiben submission');
  console.log('');
});
