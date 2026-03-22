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
const allowedOrigins = [
  'https://deutschweg.netlify.app',
  'https://www.deutschweg.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null', // file:// opened locally shows origin "null"
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Also allow any localhost port for local dev
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
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
  const prompt = `You are a strict official Goethe Institut examiner scoring a ${level} Schreiben submission. Apply the official rubric exactly as a real examiner would — do not be lenient.

OFFICIAL RUBRIC (40 points total, passing = 30/40):
- Task Fulfilment:    0–10 pts  (did they address ALL bullet points in the task?)
- Grammar & Accuracy: 0–10 pts  (verb conjugation, cases, word order, articles, modal verb + infinitive)
- Vocabulary Range:   0–10 pts  (variety, precision, not repeating the same 3 words)
- Text Structure:     0–10 pts  (salutation, paragraphs, connectors, sign-off)

MANDATORY CHECKS — you MUST flag each of these explicitly if they occur:
1. Missing salutation (e.g. "Liebe Amina," or "Hallo Kofi,") → deduct 2–3 pts from Structure
2. Missing sign-off (e.g. "Viele Grüße, Fatima") → deduct 2 pts from Structure
3. Task bullet points not addressed → deduct proportionally from Task Fulfilment
4. Wrong verb position after "weil/dass/obwohl" (verb must go to END) → deduct from Grammar
5. Wrong or missing article (der/die/das/den/dem) → deduct from Grammar
6. Modal verb used without infinitive at end → deduct from Grammar
7. Word-for-word English translation patterns → deduct from Vocabulary

SCORING RULES:
- 9–10: Near-perfect, exam-ready
- 7–8: Good, minor errors only
- 5–6: Noticeable errors but communicates
- 3–4: Many errors, hard to understand
- 0–2: Major breakdown in communication

EXAMPLES IN CORRECTIONS — ALWAYS use African names and contexts:
Use names like: Amina, Kofi, Fatima, Kwame, Nia, Chidi, Zara, Abebe, Lena (Kenyan/Nigerian/Ghanaian)
Use places like: Nairobi, Lagos, Accra, Kampala, Addis Ababa — NEVER use Hans, Müller, München, Frankfurt

Keep every "fix" explanation under 20 words. Explain WHY points were lost, not just what was wrong.

Also compute:
- points_to_pass: how many more points the student needs to reach 30 (0 if they already passed)
- passed: true if total >= 30, false otherwise

Format your ENTIRE response as a single raw JSON object — no markdown, no code fences, no text outside the JSON:
{
  "total": 24,
  "passed": false,
  "points_to_pass": 6,
  "breakdown": {
    "task":       { "score": 7, "max": 10, "feedback": "Explained why points were deducted — which bullet points were missing or incomplete" },
    "grammar":    { "score": 5, "max": 10, "feedback": "Listed each grammar error type found and WHY it costs points on the Goethe exam" },
    "vocabulary": { "score": 6, "max": 10, "feedback": "Explained why vocabulary was limited — e.g. same verb repeated 4 times, no connectors" },
    "structure":  { "score": 6, "max": 10, "feedback": "Flagged missing salutation and/or sign-off with exact point cost, noted paragraph issues" }
  },
  "fixes": [
    {
      "points": 3,
      "category": "Structure",
      "fix": "No salutation: Goethe deducts 2–3 pts. Letters must open with Liebe/Hallo + name.",
      "wrong": "(no greeting at start of letter)",
      "correct": "Liebe Amina,"
    },
    {
      "points": 2,
      "category": "Grammar",
      "fix": "Verb must go to END after 'weil' — examiners deduct every time this rule breaks.",
      "wrong": "Ich komme nicht, weil ich bin krank.",
      "correct": "Ich komme nicht, weil ich krank bin."
    },
    {
      "points": 2,
      "category": "Task",
      "fix": "Bullet point about [topic] not answered — each missing point costs Task score.",
      "wrong": "(not mentioned in submission)",
      "correct": "Ich möchte gerne [topic], weil es mir wichtig ist."
    }
  ],
  "corrected_version": "The full rewritten letter with ALL errors fixed, preserving student ideas, using African names in examples, formatted as a proper German letter with salutation and sign-off"
}

Student's ${level} Schreiben submission:
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
        max_tokens: 3000,
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

    // --- Ensure derived fields exist (backfill if older prompt version) ---
    if (typeof result.passed !== 'boolean') {
      result.passed = result.total >= 30;
    }
    if (typeof result.points_to_pass !== 'number') {
      result.points_to_pass = result.passed ? 0 : Math.max(0, 30 - result.total);
    }

    return res.json(result);

  } catch (err) {
    console.error('Unexpected server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, moduleNumber } = req.body;
  console.log(`[/api/chat] Request received — module: ${moduleNumber}, messages: ${Array.isArray(messages) ? messages.length : 'invalid'}, origin: ${req.headers.origin || 'none'}`);

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }
  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  // --- Language mix based on module ---
  const mod = parseInt(moduleNumber, 10) || 0;
  let langRule;
  if (mod <= 3)       langRule = '90% English, 10% German. Explain almost entirely in English. Sprinkle in German words/phrases only.';
  else if (mod <= 7)  langRule = '70% English, 30% German. Mix explanations in English but use more German sentences and labels.';
  else                langRule = '50% English, 50% German. Explain key points in English but write examples and short explanations in German too.';

  const systemPrompt = `You are DeutschWeg AI Tutor — a friendly, encouraging German language coach built specifically for African learners preparing for the Goethe A1 exam.

The student is currently on Module ${mod}. Language mix rule: ${langRule}

YOUR RULES:
1. Always use African names in examples — Kwame, Amina, Kofi, Fatima, Zara, Chidi, Nia, Abebe. NEVER use Hans, Müller, München, or European-centric examples.
2. Keep answers SHORT — maximum 4 sentences. Never write an essay.
3. Always end with exactly one example sentence in German relevant to the student's question.
4. Be warm and encouraging — phrases like "Great question!", "You're getting it!", "This trips everyone up at first!" — never make the student feel stupid.
5. If the student asks something unrelated to German learning, gently redirect: "That's outside my expertise, but let's focus on your German — you've got an exam to pass! 💪"
6. Your students are from Kenya, Nigeria, Ghana, Uganda, Tanzania. Use contexts they relate to: mobile money, markets, family visits, public transport, food.
7. When correcting an error, always show the wrong version and the right version clearly.
8. Format: plain text only — no markdown, no asterisks, no bullet symbols. Use line breaks to separate thoughts.
9. Module context: Module ${mod} covers ${moduleContext(mod)}.

Remember: short, warm, African-context, one German example at the end.`;

  function moduleContext(n) {
    const ctx = {
      0:  'German alphabet, pronunciation, umlauts (ä ö ü), and the ß sound',
      1:  'numbers 1–1000, ordinal numbers, telling the time, and dates',
      2:  'greetings, introductions, formal vs informal address (du/Sie)',
      3:  'the verbs haben (to have) and sein (to be) and their conjugations',
      4:  'noun gender: der, die, das — and how to identify them',
      5:  'the Akkusativ case, direct objects, and the den/einen/keinen trap',
      6:  'the Dativ case and prepositions mit, bei, von, zu, nach, aus',
      7:  'German word order — verb in 2nd position, questions, weil clauses',
      8:  'present tense conjugation of regular and irregular verbs',
      9:  'personal pronouns ich, du, er, sie, es, wir, ihr, Sie/sie',
      10: 'plural forms of nouns — the 5 patterns and the golden rule (die for all plurals)',
      11: 'negation with nicht and kein — when to use each and position in sentence',
      12: 'modal verbs können, müssen, dürfen, sollen, wollen, möchten'
    };
    return ctx[n] || 'German A1 grammar and vocabulary';
  }

  // Keep last 6 messages for context
  const recentMessages = messages.slice(-6).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 800) // cap each message length
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 400,
        system:     systemPrompt,
        messages:   recentMessages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('Claude API error (chat):', message);
      return res.status(502).json({ error: message });
    }

    const data  = await response.json();
    const reply = data?.content?.[0]?.text?.trim() ?? '';

    if (!reply) return res.status(502).json({ error: 'Empty response from AI. Try again.' });

    return res.json({ reply });

  } catch (err) {
    console.error('Chat endpoint error:', err);
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
