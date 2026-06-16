const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('Key loaded:', process.env.CLAUDE_API_KEY
  ? 'YES - first 10 chars: ' + process.env.CLAUDE_API_KEY.substring(0, 10)
  : 'NO - KEY MISSING');

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase (service role) ───────────────────────────────────────────────
// Used server-side for the dictionary cache (read/insert/increment), bypassing
// RLS. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment —
// these MUST be set in the Render dashboard, not just local .env.
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
if (!supabaseAdmin) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — /api/dictionary will be unavailable');
}

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://deutschweg.de',
  'https://www.deutschweg.de',
  'https://deutschweg.pages.dev',
  'https://deutschweg.netlify.app',
  'https://www.deutschweg.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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

// ── POST /api/sprechen ───────────────────────────────────────────────────────
app.post('/api/sprechen', async (req, res) => {
  const { part, answer } = req.body;
  console.log(`[/api/sprechen] Part ${part}, origin: ${req.headers.origin || 'none'}`);

  if (!answer || answer.trim().length < 1) {
    return res.status(400).json({ error: 'No answer provided.' });
  }
  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured. Add CLAUDE_API_KEY to your environment variables.' });
  }

  let prompt = '';

  if (part === 1) {
    const { question, questionEn } = req.body;
    prompt = `You are a Goethe A1 Sprechen examiner evaluating an African student's self-introduction answer.

The examiner asked (German): "${question}"
The examiner asked (English): "${questionEn}"
The student answered: "${answer.trim()}"

Evaluate the answer on these criteria:
1. Did they answer the question fully? (not just one word)
2. Is the grammar correct? (verb conjugation, word order)
3. Did they use the formal "Sie" form correctly, not "du"?
4. Is it a natural, complete sentence?

Score out of 10:
- 9-10: Perfect or near-perfect full sentence, correct grammar, correct Sie form
- 7-8: Good answer with minor errors
- 5-6: Understandable but grammar errors or incomplete
- 3-4: Partially answered, significant errors
- 1-2: Barely relevant or very broken

IMPORTANT: Always use African names in the model answer — Kwame, Amina, Kofi, Fatima, Zara. Never use Hans or European names. Place names: Nairobi, Lagos, Accra, Kampala.

Respond with a single raw JSON object, no markdown:
{
  "score": 7,
  "summary": "One sentence summary of how well they answered",
  "feedback": "2-3 sentences explaining what was good and what needs improvement, with specific grammar notes",
  "grammar": "Specific grammar point to remember — if no errors, confirm what they did well",
  "modelAnswer": "A complete model answer in German using an African name/context, then a line break and the English translation in brackets"
}`;

  } else if (part === 2) {
    const { keyword, hint } = req.body;
    prompt = `You are a Goethe A1 Sprechen examiner evaluating an African student's question formed from a keyword card.

Keyword shown to student: "${keyword}"
Context hint: "${hint}"
Student's question: "${answer.trim()}"

Evaluate on these criteria:
1. Is it a real grammatical question? (verb in first or second position with a W-word)
2. Is the grammar correct? (verb conjugation, word order, articles)
3. Does it relate meaningfully to the keyword?
4. Would this be a natural question to ask another person?

Score out of 10:
- 9-10: Grammatically correct, natural question clearly using the keyword
- 7-8: Correct question with minor errors
- 5-6: Understandable question but grammar issues or weak keyword link
- 3-4: Hard to understand or not a proper question
- 1-2: Not a question or unrelated to keyword

IMPORTANT: Model answer must use African names/contexts — Kwame, Amina, Kofi, Fatima. Never Hans or München.

Respond with a single raw JSON object, no markdown:
{
  "score": 8,
  "summary": "One sentence summary of their question quality",
  "feedback": "2-3 sentences: what worked, what needs fixing, why grammar matters here",
  "grammar": "Key grammar rule for forming questions at A1 level relevant to their attempt",
  "modelAnswer": "A strong model question in German using the keyword, then line break and English translation in brackets"
}`;

  } else if (part === 3) {
    const { situation, context } = req.body;
    prompt = `You are a Goethe A1 Sprechen examiner evaluating an African student's response to a situation card.

Situation given to student: "${situation}"
Context type: "${context}"
Student's response: "${answer.trim()}"

Evaluate on these criteria:
1. Is the response appropriate for the situation?
2. Is the politeness level correct? (bitte, entschuldigung, danke where needed)
3. Is the grammar correct?
4. Is it natural and complete — not too short, not an essay?

Score out of 10:
- 9-10: Perfectly appropriate, polite, grammatically correct
- 7-8: Good response with minor errors
- 5-6: Gets the message across but politeness or grammar issues
- 3-4: Partially appropriate or significant errors
- 1-2: Inappropriate or broken response

IMPORTANT: Model answer must use African names/contexts — Kwame, Amina, Kofi, Fatima. Never Hans or München.

Respond with a single raw JSON object, no markdown:
{
  "score": 8,
  "summary": "One sentence summary of how well they handled the situation",
  "feedback": "2-3 sentences: what was good, what to improve, specific language note",
  "grammar": "Key phrase or structure to remember for this type of situation",
  "modelAnswer": "A natural model response in German, then line break and English translation in brackets"
}`;

  } else {
    return res.status(400).json({ error: 'Invalid part number. Use 1, 2, or 3.' });
  }

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
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('[/api/sprechen] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data = await response.json();
    const raw  = (data?.content?.[0]?.text ?? '').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();

    let result;
    try { result = JSON.parse(raw); }
    catch (e) {
      console.error('[/api/sprechen] JSON parse error:', raw);
      return res.status(502).json({ error: 'Could not parse AI response. Try again.' });
    }

    if (typeof result.score !== 'number' || !result.modelAnswer) {
      return res.status(502).json({ error: 'Unexpected response format. Try again.' });
    }

    console.log('[/api/sprechen] Success — score:', result.score);
    return res.json(result);

  } catch (err) {
    console.error('[/api/sprechen] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── Module context lookup (used by /api/chat) ────────────────────────────────
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
    12: 'modal verbs können, müssen, dürfen, sollen, wollen, möchten',
  };
  return ctx[n] || 'German A1 grammar and vocabulary';
}

// ── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, moduleNumber } = req.body;

  console.log(`[/api/chat] Request — module: ${moduleNumber}, msgs: ${Array.isArray(messages) ? messages.length : 'invalid'}, origin: ${req.headers.origin || 'none'}`);
  console.log('[/api/chat] API key present:', process.env.CLAUDE_API_KEY ? 'YES (' + process.env.CLAUDE_API_KEY.substring(0, 10) + '...)' : 'NO — KEY MISSING');

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  // --- Check API key (same pattern as /api/score) ---
  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured. Add CLAUDE_API_KEY to your environment variables.' });
  }

  // --- Language mix based on module ---
  const mod = parseInt(moduleNumber, 10);
  const safemod = isNaN(mod) ? 0 : mod;
  let langRule;
  if (safemod <= 3)      langRule = '90% English, 10% German. Explain almost entirely in English. Sprinkle in German words/phrases only.';
  else if (safemod <= 7) langRule = '70% English, 30% German. Mix explanations in English but use more German sentences and labels.';
  else                   langRule = '50% English, 50% German. Explain key points in English but write examples and short explanations in German too.';

  const systemPrompt = `You are DeutschWeg AI Tutor — a friendly, encouraging German language coach built specifically for African learners preparing for the Goethe A1 exam.

The student is currently on Module ${safemod}. Language mix rule: ${langRule}

YOUR RULES:
1. Always use African names in examples — Kwame, Amina, Kofi, Fatima, Zara, Chidi, Nia, Abebe. NEVER use Hans, Müller, München, or European-centric examples.
2. Keep answers SHORT — maximum 4 sentences. Never write an essay.
3. Always end with exactly one example sentence in German relevant to the student's question.
4. Be warm and encouraging — phrases like "Great question!", "You're getting it!", "This trips everyone up at first!" — never make the student feel stupid.
5. If the student asks something unrelated to German learning, gently redirect: "That's outside my expertise, but let's focus on your German — you've got an exam to pass!"
6. Your students are from Kenya, Nigeria, Ghana, Uganda, Tanzania. Use contexts they relate to: mobile money, markets, family visits, public transport, food.
7. When correcting an error, always show the wrong version and the right version clearly.
8. Format: plain text only — no markdown, no asterisks, no bullet symbols. Use line breaks to separate thoughts.
9. Module context: Module ${safemod} covers ${moduleContext(safemod)}.

Remember: short, warm, African-context, one German example at the end.`;

  // Keep last 6 messages for context
  const recentMessages = messages.slice(-6).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 800),
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
      console.error('[/api/chat] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data  = await response.json();
    const reply = data?.content?.[0]?.text?.trim() ?? '';

    if (!reply) return res.status(502).json({ error: 'Empty response from AI. Try again.' });

    console.log('[/api/chat] Success — reply length:', reply.length);
    return res.json({ reply });

  } catch (err) {
    console.error('[/api/chat] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aipal ──────────────────────────────────────────────────────────
const AIPAL_VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];

// Friendly labels for error categories the client tracks. Used to build
// the "weak spots" context block from the userTopErrors payload.
const AIPAL_ERROR_LABELS = {
  article_masculine_accusative:  'Masculine accusative articles (der/den, ein/einen confusion)',
  verb_position:                 'Verb position (verb must be 2nd in main clauses)',
  verb_conjugation:              'Verb conjugation (matching verb ending to subject)',
  perfekt_auxiliary:             'Perfekt auxiliary (haben vs sein selection)',
  subordinate_clause_word_order: 'Subordinate clause word order (verb at end after weil/dass/wenn)',
  preposition_pattern:           'Preposition patterns (in/zu/nach with destinations)'
};

function buildAipalWeakSpotsBlock(userTopErrors) {
  if (!Array.isArray(userTopErrors) || userTopErrors.length === 0) return '';
  const lines = userTopErrors
    .filter(e => e && AIPAL_ERROR_LABELS[e.category] && Number(e.count) > 0)
    .slice(0, 3)
    .map((e, i) => `${i + 1}. ${AIPAL_ERROR_LABELS[e.category]} — ${e.count}x`);
  if (lines.length === 0) return '';
  return `

STUDENT'S RECURRING WEAK SPOTS (from past sessions):
${lines.join('\n')}

When one of these patterns surfaces in this conversation, prefer Template 4 (⚠️ Same pattern again) and reinforce the fix concretely. Don't lecture about it pre-emptively — only react when it actually shows up.`;
}

function buildAipalPrompt(level, moduleName) {
  return `You are AI Pal, a friendly lesson companion for African learners studying German for the Goethe exam. The student's level is ${level}. They are currently studying: ${moduleName}.

You are NOT a teacher. You give short, fast, example-first responses only.

CONTEXT DETECTION — choose ONE template per response:

---

TEMPLATE 1: Correction (user made a mistake)

✅ [Correct sentence]

🇩🇪 [Example 1]
🇩🇪 [Example 2 — optional]

🇬🇧 [Meaning — 1 line]

💡 [Pattern — 1 short line]

---

TEMPLATE 2: Pattern Reminder (before or during exercise)

💡 Watch this:

🇩🇪 [Example]

🇬🇧 [Meaning]

💡 [Pattern]

---

TEMPLATE 3: Micro Correction (very small fix — one word or ending)

💡 Use:

🇩🇪 [Correct form]

🇬🇧 [Meaning]

---

TEMPLATE 4: Repeated Mistake (user made same mistake 2+ times)

⚠️ Try this pattern:

🇩🇪 [Example 1]
🇩🇪 [Example 2]

🇬🇧 [Meaning]

💡 [Pattern]

---

TEMPLATE 5: Encouragement (user answered correctly)

👍 Good!

🇩🇪 [Correct sentence]

💡 [Small reinforcement — 1 line]

---

TEMPLATE 6: Ask Tutor Bridge (user needs deeper explanation)

End your response with exactly this line:
Need more help? → Ask Tutor 👩‍🏫

---

GLOBAL RULES — always apply:
- Maximum 5 lines per response — no exceptions
- One concept per message only
- Never write grammar lectures or long explanations
- Always show the example first
- Use simple A1-friendly English
- Use African names: Kwame, Amina, Kofi, Fatima
- Be warm and encouraging
- Be consistent — same format every time
- Never mix templates in one response

LEVEL ADAPTATION — adapt your response based on level:

A1:
- 1 example only
- No grammar terms at all
- Pattern must be the simplest possible (e.g. "ein → einen")
- Default to this level if level is unknown

A2:
- 2 examples
- No heavy grammar terms
- Pattern can include gender label (e.g. "masculine → einen")

B1:
- 2 to 3 examples
- Light grammar labels allowed (e.g. accusative, dative)
- Pattern can be slightly more precise
- Still keep it short

B2:
- 1 to 2 examples maximum
- Focus on precision not quantity
- Short rule statements only
- No hand-holding

RULE FOR ALL LEVELS:
- Never increase explanation length — only adjust clarity
- Same template structure always
- Same 5-line maximum always

LANGUAGE RULES — strict:
- Never use: often, sometimes, usually, in many cases, can be, might be
- Always sound certain and direct
- Give clean pattern statements — no probabilities
- No conditional explanations
- No side notes
- No exceptions unless the exam requires it

PATTERN FORMAT — strict:
BAD: 💡 ein → einen (+ often add -en to noun)
GOOD: 💡 ein → einen
GOOD: 💡 ein → einen (masculine)

Every word must justify itself.
If it does not help pattern recognition — remove it.

RESPONSE CHECKLIST before sending:
- Is it 5 lines or less? ✓
- Is the example first? ✓
- Is the pattern 1 line only? ✓
- Are there any vague words? If yes — remove them ✓
- Is it clear enough for a slow learner? ✓`;
}

app.post('/api/aipal', async (req, res) => {
  const { messages, level, module: moduleName, errorContext, userTopErrors } = req.body;
  const safeLevel  = AIPAL_VALID_LEVELS.includes(level) ? level : 'A1';
  const safeModule = (typeof moduleName === 'string' && moduleName.trim())
    ? moduleName.trim().slice(0, 200)
    : 'general German practice';
  const safeErrorContext = (typeof errorContext === 'string' && errorContext.trim())
    ? errorContext.slice(0, 500)
    : '';
  const weakSpotsBlock = buildAipalWeakSpotsBlock(userTopErrors);

  console.log(`[/api/aipal] Request — level: ${safeLevel}, module: "${safeModule}", msgs: ${Array.isArray(messages) ? messages.length : 'invalid'}, errCtx: ${safeErrorContext ? 'yes' : 'no'}, weakSpots: ${weakSpotsBlock ? 'yes' : 'no'}, origin: ${req.headers.origin || 'none'}`);

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  // Short memory by design — keep only last 6 turns
  const trimmed = messages.slice(-6).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 800),
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
        max_tokens: 150,
        system:     buildAipalPrompt(safeLevel, safeModule) + weakSpotsBlock + safeErrorContext,
        messages:   trimmed,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('[/api/aipal] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data  = await response.json();
    const reply = data?.content?.[0]?.text?.trim() ?? '';

    if (!reply) return res.status(502).json({ error: 'Empty response from AI. Try again.' });

    console.log('[/api/aipal] Success — reply length:', reply.length);
    return res.json({ reply });

  } catch (err) {
    console.error('[/api/aipal] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aipal/opener ─────────────────────────────────────────────────
// AI Pal v2 — the PROACTIVE companion message (the student never initiates).
//   • mode "welcome"   → Behavior 1: brand-new-user welcome (zero German)
//   • mode "companion" → Behavior 2: per-lesson opener with progressive
//                        immersion + active recall of already-learned words
//
// The server has no Supabase access, so the client (module.html) gathers all
// context from the DB and posts it here. We only pick the prompt + call Claude.

// Progressive immersion ratio table (from the v2 spec). `completed` is the
// number of lessons the learner has finished. Returns the German share plus a
// hard cap on new German words for the early stages where over-immersing hurts.
// Immersion is applied at the SENTENCE level (whole German sentences vs whole
// English sentences) — never by mixing languages inside one sentence.
function aipalImmersion(completed) {
  const c = Number(completed) || 0;
  if (c <= 2)  return { de: 10, hint: 'Almost entirely English. At most one very short German sentence, or none.' };
  if (c <= 4)  return { de: 20, hint: 'Mostly English. One short German sentence is fine.' };
  if (c <= 6)  return { de: 35, hint: 'About one third of your sentences in German, the rest English.' };
  if (c <= 8)  return { de: 55, hint: 'Slightly more German sentences than English.' };
  if (c <= 10) return { de: 75, hint: 'Mostly German sentences, a little English for comfort.' };
  return         { de: 90, hint: 'Almost entirely German sentences.' };
}

// Shared, non-negotiable language-purity rule for every AI Pal message.
const AIPAL_LANGUAGE_RULE = `

LANGUAGE PURITY RULE — critical, overrides every other instruction:
- NEVER compose a sentence that mixes German and English ("Denglish").
- Every sentence must be entirely ONE language. A German sentence must be complete, correct German; an English sentence must be complete, correct English.
- A comma (,), em dash (—), en dash (–), colon, semicolon, "and", or "und" must NEVER bridge a German fragment and an English fragment. Separate them into two sentences with a full stop, ? or !.
    WRONG: "Nine days in a row, das ist gut!"
    WRONG: "Today you read a book — du liest ein Buch."
    RIGHT: "Nine days in a row! Das ist gut!"
- In an English sentence, name German grammar topics by their English name (e.g. "the accusative case", not "Akkusativ").
- You MAY quote or name individual German words when they are the subject of instruction (e.g. explaining the difference between der and den) — that is teaching about the words, not mixing languages.
- To actually USE a German word (not just name it), place it inside a complete German sentence — never drop it into an English sentence.
- FINAL CHECK before you answer: re-read every sentence. If any single sentence contains both a German word and an English word (other than a German word quoted as a vocabulary term), rewrite it as two separate sentences.`;

// Whole-day difference between an ISO date string and now (UTC, calendar days).
// Positive = in the future (exam countdown), negative/0 = past (last activity).
function aipalDaysUntil(iso) {
  if (!iso) return null;
  const then = new Date(iso);
  if (isNaN(then.getTime())) return null;
  const MS = 86400000;
  const a = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const now = new Date();
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / MS);
}

const AIPAL_WELCOME_PROMPT = `You are AI Pal on DeutschWeg, a warm and encouraging German learning companion for African learners.

A brand new user just finished onboarding. They know zero German. They are nervous and excited. Speak to them like a warm big sister welcoming them home.

Rules:
- Use the learner's first name
- Simple English only — no German words yet
- Acknowledge the courage it took to start
- Tell them you will be with them every single step
- Maximum 4 short sentences
- End with energy and excitement toward lesson 1
- Never sound robotic or automated
- Output only the message itself — no quotes, no preamble, no labels${AIPAL_LANGUAGE_RULE}`;

function buildAipalOpenerPrompt(ctx) {
  const ratio = aipalImmersion(ctx.completed_lessons);
  const vocab = Array.isArray(ctx.all_vocabulary_learned)
    ? ctx.all_vocabulary_learned.filter(w => typeof w === 'string' && w.length > 1).slice(0, 150)
    : [];

  // Pre-compute the situational facts so the model never has to do math.
  const examDays   = aipalDaysUntil(ctx.exam_date);          // >0 = future
  const idleDays   = ctx.last_activity ? -aipalDaysUntil(ctx.last_activity) : null; // days since
  const streak     = Number(ctx.streak_count) || 0;
  const facts = [];
  facts.push(`Learner first name: ${ctx.first_name || 'there'}`);
  facts.push(`Today's lesson: "${ctx.lesson_title || 'your next lesson'}" (lesson number ${ctx.lesson_number || '?'})`);
  facts.push(`Lessons completed so far: ${Number(ctx.completed_lessons) || 0}`);
  facts.push(`Immersion target for this message: about ${ratio.de}% German, ${100 - ratio.de}% English. ${ratio.hint}`);
  facts.push(vocab.length
    ? `German words the learner ALREADY knows (the ONLY German you may use): ${vocab.join(', ')}`
    : `The learner has not learned any German words yet — use English only, no German.`);
  if (streak >= 3) facts.push(`Streak: ${streak} days in a row — acknowledge it warmly.`);
  if (idleDays !== null && idleDays > 2) facts.push(`The learner has been away for ${idleDays} days — give a gentle, guilt-free welcome back.`);
  if (examDays !== null && examDays >= 0) facts.push(`Goethe exam is in ${examDays} day${examDays === 1 ? '' : 's'} — weave in a calm, on-track countdown.`);
  if (ctx.emotional_checkin) facts.push(`The learner just said they feel: "${ctx.emotional_checkin}" — adapt your tone to that feeling (nervous → extra softness; tired → keep it light; ready → push a little; getting there → steady encouragement).`);
  const weakWords = Array.isArray(ctx.weak_words)
    ? ctx.weak_words.filter(w => typeof w === 'string' && w.length > 1).slice(0, 8)
    : [];
  if (weakWords.length) facts.push(`Words the learner SAVED to their word bank and is still weak on: ${weakWords.join(', ')}. Prioritise reviewing one of these — but only if it is in the "already knows" list — by using it naturally in a complete German sentence for active recall.`);

  return `You are AI Pal on DeutschWeg, a warm encouraging German learning companion for African learners. You speak FIRST, before the lesson — like a big sister, never a teacher.

CONTEXT:
${facts.map(f => '- ' + f).join('\n')}

Rules:
- Address the learner by their first name
- Apply the immersion target above by choosing how many WHOLE sentences are German vs English — never by mixing languages inside a sentence. Shift the balance gradually, never abruptly.
- Any German sentence may ONLY use words from the "already knows" list — NEVER introduce a new German word. If you cannot form a correct, natural German sentence from those words, write that sentence in English instead.
- For active recall, include one short, complete German sentence built only from known words (whenever the immersion target allows any German). Write it as its own sentence ending in . ! or ? — do NOT follow a German sentence with an em dash or comma and then an English translation or comment.
- Acknowledge streak / returning / exam countdown only if a fact above mentions it
- One sentence on what they'll learn today, made to feel achievable
- Maximum 4 short sentences total
- Warm big-sister energy, never clinical. The goal: make the learner feel "I can actually do this."
- Output only the message itself — no quotes, no preamble, no labels${AIPAL_LANGUAGE_RULE}`;
}

app.post('/api/aipal/opener', async (req, res) => {
  const ctx = (req.body && typeof req.body.context === 'object' && req.body.context) || {};
  const mode = req.body && req.body.mode === 'welcome' ? 'welcome' : 'companion';

  console.log(`[/api/aipal/opener] mode=${mode}, name="${ctx.first_name || ''}", lesson="${ctx.lesson_title || ''}" (#${ctx.lesson_number || '?'}), completed=${ctx.completed_lessons || 0}, vocab=${Array.isArray(ctx.all_vocabulary_learned) ? ctx.all_vocabulary_learned.length : 0}, streak=${ctx.streak_count || 0}, mood=${ctx.emotional_checkin || 'none'}, origin=${req.headers.origin || 'none'}`);

  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const systemPrompt = mode === 'welcome' ? AIPAL_WELCOME_PROMPT : buildAipalOpenerPrompt(ctx);
  const userMsg = mode === 'welcome'
    ? `Generate the welcome message. The learner's first name is ${ctx.first_name || 'there'}.`
    : `Generate the lesson opener message now using the context above.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Matches the model the /api/aipal endpoint already uses in this repo
        // (the spec's "claude-sonnet-4-6" is the same Sonnet family).
        model:       'claude-sonnet-4-6',
        max_tokens:  250,
        temperature: 0.3, // low temp so the language-purity rule is followed reliably
        system:      systemPrompt,
        messages:    [{ role: 'user', content: userMsg }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('[/api/aipal/opener] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data    = await response.json();
    const message = data?.content?.[0]?.text?.trim() ?? '';
    if (!message) return res.status(502).json({ error: 'Empty response from AI. Try again.' });

    console.log('[/api/aipal/opener] Success — message length:', message.length);
    return res.json({ message, mode });

  } catch (err) {
    console.error('[/api/aipal/opener] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aipal/lesson-complete (v2 Behavior 3) ────────────────────────
// Three-section completion popup. Returns strict JSON so the client can style
// each section. Cultural mirror is added on every 3rd lesson (spec).
function buildAipalCompletePrompt(ctx) {
  const num   = Number(ctx.lesson_number) || 0;
  const vocab = Array.isArray(ctx.vocabulary_covered)
    ? ctx.vocabulary_covered.filter(w => typeof w === 'string').slice(0, 40)
    : [];
  const mirror = (num > 0 && num % 3 === 0)
    ? `\n- This is lesson ${num} (divisible by 3): in WHY IT MATTERS, add a short cultural mirror connecting German culture to African/Kenyan culture so it feels familiar, not foreign.`
    : '';
  return `You are AI Pal on DeutschWeg, generating a lesson completion popup for an African learner who just finished a German lesson.

Context:
- Lesson just completed: "${ctx.lesson_title || 'this lesson'}"
- Lesson number: ${num}
- Vocabulary learned in this lesson: ${vocab.length ? vocab.join(', ') : '(general content)'}

Generate three short sections:
1. learned        — one simple sentence naming the exact skill in plain English
2. matters        — one sentence describing a specific real-life moment this skill prepares them for in Germany; make it personal and close for an African learner${mirror}
3. encouragement  — one sentence celebrating this win loudly and pointing forward to the next lesson

Rules:
- Write each section as ONE clean, simple English sentence. Do NOT drop German words into these English sentences.
- If you reference a German word or phrase, it must be a complete correct German sentence on its own — but for this beginner popup, plain English is preferred. Never mix German and English within one sentence.
- Never use German administrative terms (Anmeldung, Behörde, Amt) without a simple explanation
- Warm, celebratory tone — the learner should feel proud, not just informed
- Respond with ONLY a JSON object, no markdown, no preamble:
{"learned":"...","matters":"...","encouragement":"..."}${AIPAL_LANGUAGE_RULE}`;
}

app.post('/api/aipal/lesson-complete', async (req, res) => {
  const ctx = (req.body && typeof req.body.context === 'object' && req.body.context) || {};
  console.log(`[/api/aipal/lesson-complete] lesson="${ctx.lesson_title || ''}" (#${ctx.lesson_number || '?'}), vocab=${Array.isArray(ctx.vocabulary_covered) ? ctx.vocabulary_covered.length : 0}`);

  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  400,
        temperature: 0.5,
        system:      buildAipalCompletePrompt(ctx),
        messages:   [{ role: 'user', content: 'Generate the lesson completion JSON now.' }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || `Claude API returned ${response.status}` });
    }
    const data = await response.json();
    const raw  = data?.content?.[0]?.text?.trim() ?? '';
    let parsed = null;
    try {
      // Tolerate a stray ```json fence if the model adds one.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (_) { /* fall through */ }
    if (!parsed || !parsed.learned) {
      return res.status(502).json({ error: 'Could not parse completion message.', raw });
    }
    console.log('[/api/aipal/lesson-complete] Success');
    return res.json({
      learned:       String(parsed.learned || ''),
      matters:       String(parsed.matters || ''),
      encouragement: String(parsed.encouragement || ''),
    });
  } catch (err) {
    console.error('[/api/aipal/lesson-complete] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aipal/struggle (v2 Behavior 4) ───────────────────────────────
function buildAipalStrugglePrompt(ctx) {
  return `You are AI Pal on DeutschWeg. A learner is struggling — they just got this topic wrong twice in a row.

Context:
- Exercise topic: ${ctx.exercise_topic || 'this exercise'}
- Learner first name: ${ctx.first_name || 'friend'}

Generate a short supportive message:
- Normalize the difficulty — tell them even German children (or long-time learners) find this hard
- Never make them feel stupid
- Offer one simple, concrete tip or reframe for THIS topic
- Maximum 3 sentences
- Tone: patient, warm, like a friend sitting beside them
- Use the learner's first name
- If you give a German example, write it as a complete correct German sentence; keep your explanation in separate English sentences
- Output only the message — no quotes, no labels${AIPAL_LANGUAGE_RULE}`;
}

app.post('/api/aipal/struggle', async (req, res) => {
  const ctx = (req.body && typeof req.body.context === 'object' && req.body.context) || {};
  console.log(`[/api/aipal/struggle] name="${ctx.first_name || ''}", topic="${ctx.exercise_topic || ''}"`);
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  180,
        temperature: 0.5,
        system:      buildAipalStrugglePrompt(ctx),
        messages:   [{ role: 'user', content: 'Generate the supportive message now.' }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || `Claude API returned ${response.status}` });
    }
    const data    = await response.json();
    const message = data?.content?.[0]?.text?.trim() ?? '';
    if (!message) return res.status(502).json({ error: 'Empty response from AI.' });
    return res.json({ message });
  } catch (err) {
    console.error('[/api/aipal/struggle] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aipal/milestone (v2 Behavior 5) ──────────────────────────────
const AIPAL_MILESTONES = {
  first_lesson:     'They just completed their VERY FIRST lesson ever. This is huge — the journey has begun.',
  lesson_5:         'They just completed their 5th lesson. They are building a real habit and real momentum.',
  seven_day_streak: 'They just hit a 7-DAY STREAK. A full week of showing up — serious dedication.',
  first_sentence:   'They just typed their first full German sentence on their own. A milestone moment.',
  a1_complete:      'They just COMPLETED THE ENTIRE A1 LEVEL. A massive achievement — they can now handle real basic German.',
};

function buildAipalMilestonePrompt(ctx) {
  const desc = AIPAL_MILESTONES[ctx.milestone] || 'They just hit a meaningful milestone.';
  return `You are AI Pal on DeutschWeg, a warm big-sister German companion for African learners. The learner just hit a MAJOR milestone — celebrate loudly, this is a genuine event (bigger energy than a normal lesson message).

Context:
- Learner first name: ${ctx.first_name || 'friend'}
- Milestone: ${desc}

Rules:
- Use the learner's first name
- Big, genuine celebration — make them feel this is a real achievement, because for them it is
- Simple, warm English. If you add a German sentence, it must be complete correct German on its own — never mix German words into an English sentence.
- 2 to 3 short sentences
- End pointing forward with excitement
- Output only the message — no quotes, no labels${AIPAL_LANGUAGE_RULE}`;
}

app.post('/api/aipal/milestone', async (req, res) => {
  const ctx = (req.body && typeof req.body.context === 'object' && req.body.context) || {};
  console.log(`[/api/aipal/milestone] name="${ctx.first_name || ''}", milestone="${ctx.milestone || ''}"`);
  if (!AIPAL_MILESTONES[ctx.milestone]) return res.status(400).json({ error: 'Unknown milestone.' });
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  200,
        temperature: 0.5,
        system:      buildAipalMilestonePrompt(ctx),
        messages:   [{ role: 'user', content: 'Generate the milestone celebration now.' }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || `Claude API returned ${response.status}` });
    }
    const data    = await response.json();
    const message = data?.content?.[0]?.text?.trim() ?? '';
    if (!message) return res.status(502).json({ error: 'Empty response from AI.' });
    return res.json({ message, milestone: ctx.milestone });
  } catch (err) {
    console.error('[/api/aipal/milestone] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/aitutor ────────────────────────────────────────────────────────
const AITUTOR_VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];

// Keep only the handoff fields we expect, as bounded strings. Returns null
// when there's nothing useful — so the prompt stays clean for normal sessions.
function sanitizeHandoff(h) {
  if (!h || typeof h !== 'object') return null;
  const s = (v, n) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, n) : '';
  const out = {
    topic:            s(h.topic, 200),
    weak_word:        s(h.weak_word, 120),
    last_pal_message: s(h.last_pal_message, 800),
  };
  return (out.topic || out.weak_word || out.last_pal_message) ? out : null;
}

function buildAitutorHandoffBlock(handoff) {
  if (!handoff) return '';
  return `

HANDOFF FROM AI PAL — the learner was just chatting with AI Pal (a quick-help study buddy), got stuck, and came straight to you. They have NOT re-typed their question, and they should never have to. Continue seamlessly from here:
- Topic they were working on: ${handoff.topic || '(general practice)'}
- The specific word or point they struggled with: ${handoff.weak_word || '(not specified)'}
- The last thing AI Pal told them: "${handoff.last_pal_message || ''}"
In your FIRST message: warmly acknowledge what they were just working on (by name), then immediately continue teaching that exact point in more depth — do not ask them what they need or make them repeat themselves.`;
}

function buildAitutorPrompt(level, handoff) {
  return `You are a patient, structured German teacher helping African learners prepare for the Goethe exam. The student's level is ${level}.

Your role: explain clearly when asked. You are a full teacher.

When explaining grammar:
1. Give the rule clearly
2. Show the structure
3. Give 2-3 examples using African names (Kwame, Amina, Kofi, Fatima)
4. Point out common mistakes

When correcting sentences:
1. Show the corrected version first
2. Explain what was wrong
3. Give the grammar rule behind it

When giving writing feedback:
- Comment on grammar, structure, and vocabulary
- Suggest improvements
- Keep tone encouraging

When doing speaking roleplay:
- Play the role asked (examiner, shopkeeper, doctor, etc.)
- Stay in German unless the student asks for English explanation
- Correct mistakes gently after each exchange

Rules:
- Be patient and encouraging always
- Give complete explanations — don't cut short
- Use simple English for explanations
- Adapt depth to the student level: A1 simple, B2 detailed
- If student seems frustrated, be extra warm and reassuring${buildAitutorHandoffBlock(handoff)}`;
}

app.post('/api/aitutor', async (req, res) => {
  const { messages, level, handoff } = req.body;
  const safeLevel   = AITUTOR_VALID_LEVELS.includes(level) ? level : 'A1';
  const safeHandoff = sanitizeHandoff(handoff);

  let convo = Array.isArray(messages) ? messages : [];

  // Handoff opener: the tutor speaks first, continuing from AI Pal. The client
  // sends empty messages + a handoff; we synthesize a single user turn (never
  // shown to the learner) so the model has something to respond to.
  if (convo.length === 0) {
    if (safeHandoff) {
      convo = [{ role: 'user', content: 'Please greet me and continue from where AI Pal left off, without asking me to repeat my question.' }];
    } else {
      return res.status(400).json({ error: 'No messages provided.' });
    }
  }

  console.log(`[/api/aitutor] Request — level: ${safeLevel}, msgs: ${convo.length}, handoff: ${safeHandoff ? `yes (topic="${safeHandoff.topic}", word="${safeHandoff.weak_word}")` : 'no'}, origin: ${req.headers.origin || 'none'}`);

  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  // Cap to last 30 turns; truncate each to bound payload size
  const trimmed = convo.slice(-30).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).slice(0, 1500),
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
        max_tokens: 800,
        system:     buildAitutorPrompt(safeLevel, safeHandoff),
        messages:   trimmed,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('[/api/aitutor] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data  = await response.json();
    const reply = data?.content?.[0]?.text?.trim() ?? '';

    if (!reply) return res.status(502).json({ error: 'Empty response from AI. Try again.' });

    console.log('[/api/aitutor] Success — reply length:', reply.length);
    return res.json({ reply });

  } catch (err) {
    console.error('[/api/aitutor] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── GET /api/dictionary/:word ──────────────────────────────────────────────
// Cache-first dictionary entry. Stored hit → return immediately (+access_count);
// miss → generate via Claude, save, return.

const DICTIONARY_SYSTEM_PROMPT = `You are a dictionary entry generator for DeutschWeg, a German learning platform for African immigrants preparing for life in Germany and Goethe exams A1-B2.

Generate a complete dictionary entry for the word: {word}

Return ONLY a valid JSON object with exactly these fields:
{
  "word": "",
  "level": "A1/A2/B1/B2",
  "article": "der/die/das or null",
  "plural": "plural form or null",
  "english": "translation",
  "aussprache": "pronunciation guide",
  "wortart": "noun/verb/adjective/etc",
  "bedeutung": "short simple explanation in English for A1-B2 learners",
  "kultur": "how Germans actually use this word in daily life, cultural notes relevant to African immigrants",
  "beispielsätze": [
    {"german": "", "english": ""},
    {"german": "", "english": ""},
    {"german": "", "english": ""}
  ],
  "fehler": [
    {"incorrect": "", "correct": ""}
  ],
  "synonyme": [],
  "merkhilfe": "one memorable tip to remember this word",
  "verwandte_wörter": [],
  "pruefungstipp": "which Goethe exam sections this word appears in"
}

Rules:
- Bedeutung explains German usage and context, never defines something Kwame already knows in English
- Beispielsätze must be real sentences Kwame will actually use in Germany
- Kultur notes must be specific and practical for someone moving to Germany
- Fehler must include the most common mistake African English speakers make with this word
- Merkhilfe must be clever and memorable
- English translations in Beispielsätze must be natural English — never literal translations
- Never say "I want..." — say "I would like..." in English translations
- Return only valid JSON, no markdown, no explanation`;

// Strip a leading der/die/das so "das Haus" and "Haus" share one cache entry.
function normalizeDictWord(raw) {
  return String(raw || '').trim().replace(/^(der|die|das)\s+/i, '').trim();
}

// Map Claude's (umlaut) JSON keys onto our ASCII columns + coerce shapes.
function dictRowFromGenerated(g, fallbackWord) {
  const arr = (v) => Array.isArray(v) ? v : [];
  const nn  = (v) => (v === null || v === undefined) ? null : String(v);
  let article = g.article;
  if (typeof article === 'string' && /^(null|none|-|)$/i.test(article.trim())) article = null;
  return {
    word:              nn(g.word) || fallbackWord,
    level:             nn(g.level),
    article:           article ? String(article) : null,
    plural:            nn(g.plural),
    english:           nn(g.english),
    aussprache:        nn(g.aussprache),
    wortart:           nn(g.wortart),
    bedeutung:         nn(g.bedeutung),
    kultur:            nn(g.kultur),
    beispielsaetze:    arr(g['beispielsätze'] || g.beispielsaetze),
    fehler:            arr(g.fehler),
    synonyme:          arr(g.synonyme),
    merkhilfe:         nn(g.merkhilfe),
    verwandte_woerter: arr(g['verwandte_wörter'] || g.verwandte_woerter),
    pruefungstipp:     nn(g.pruefungstipp),
  };
}

app.get('/api/dictionary/:word', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Dictionary storage not configured.' });
  const word = normalizeDictWord(req.params.word);
  if (!word || word.length > 80) return res.status(400).json({ error: 'Invalid word.' });

  console.log(`[/api/dictionary] lookup "${word}"`);

  try {
    // Step 1-2: cache hit → return immediately, bump access_count (step 6).
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('dictionary').select('*').ilike('word', word).limit(1).maybeSingle();
    if (selErr) console.error('[/api/dictionary] select error', selErr.message);

    if (existing) {
      const next = (existing.access_count || 0) + 1;
      supabaseAdmin.from('dictionary').update({ access_count: next }).eq('id', existing.id)
        .then(function(){}, function(){});
      return res.json({ ...existing, access_count: next, cached: true });
    }

    // Step 3: generate via Claude.
    if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  1200,
        temperature: 0.4,
        system:      DICTIONARY_SYSTEM_PROMPT.replace('{word}', word),
        messages:    [{ role: 'user', content: `Generate the dictionary entry for: ${word}` }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(502).json({ error: errBody?.error?.message || `Claude API returned ${response.status}` });
    }
    const data = await response.json();
    const raw  = data?.content?.[0]?.text?.trim() ?? '';
    let parsed = null;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (_) { /* fall through */ }
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ error: 'Could not parse dictionary entry.' });
    }

    // Step 4-5: save (access_count starts at 1 for this access) and return.
    const row = dictRowFromGenerated(parsed, word);
    row.access_count = 1;
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('dictionary').insert(row).select().maybeSingle();

    if (insErr) {
      // Likely a race (another request generated it first) — return the stored one.
      const { data: again } = await supabaseAdmin
        .from('dictionary').select('*').ilike('word', word).limit(1).maybeSingle();
      if (again) return res.json({ ...again, cached: true });
      console.error('[/api/dictionary] insert error', insErr.message);
      return res.status(500).json({ error: 'Could not save entry.' });
    }

    console.log(`[/api/dictionary] generated + saved "${word}"`);
    return res.json({ ...inserted, cached: false });

  } catch (err) {
    console.error('[/api/dictionary] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SPRECHEN — Goethe A1 speaking simulator (topics + cap + feedback; the live
// voice session is the WebSocket server attached at the bottom of this file).
// ═══════════════════════════════════════════════════════════════════════════

const SPRECHEN_LANGS = { english: 'English', arabic: 'Arabic', french: 'French', portuguese: 'Portuguese' };
function sprechenLang(v) { return SPRECHEN_LANGS[String(v || '').toLowerCase()] ? String(v).toLowerCase() : 'english'; }

const SPRECHEN_TOPIC_SYSTEM_PROMPT = `You are generating Goethe A1 Sprechen exam topics for African learners preparing for the German exam.

Generate exactly 3 topics following the official Goethe A1 Sprechen format:

Part 1 — Sich vorstellen (introduce yourself)
Generate a natural self-introduction prompt.
Example: "Stellen Sie sich vor — sagen Sie Ihren Namen, woher Sie kommen und was Sie arbeiten."

Part 2 — Bild beschreiben (describe a picture)
Generate a simple everyday scene relevant to life in Germany.
Example: "Beschreiben Sie das Bild — was sehen Sie?"

Part 3 — Gemeinsam planen (plan together)
Generate a simple planning task the examiner and learner do together.
Example: "Sie möchten zusammen kochen. Was brauchen Sie?"

Rules:
- All topics must be genuine A1 level — simple vocabulary only
- Topics must be relevant to African immigrants in Germany
- Part 3 must feel like a natural conversation not an interrogation
- Return only valid JSON:

{
  "part1": {
    "topic": "",
    "instructions_english": "",
    "instructions_arabic": "",
    "instructions_french": "",
    "instructions_portuguese": ""
  },
  "part2": {
    "topic": "",
    "image_description": "",
    "instructions_english": "",
    "instructions_arabic": "",
    "instructions_french": "",
    "instructions_portuguese": ""
  },
  "part3": {
    "topic": "",
    "instructions_english": "",
    "instructions_arabic": "",
    "instructions_french": "",
    "instructions_portuguese": ""
  }
}`;

function parseJsonLoose(raw) {
  try { return JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch (_) { return null; }
}

async function callClaudeJSON(systemPrompt, userMsg, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 1200,
      temperature: 0.6,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Claude API returned ${response.status}`);
  }
  const data = await response.json();
  return parseJsonLoose(data?.content?.[0]?.text?.trim() ?? '');
}

// ── Part 2: POST /api/sprechen/topics/generate ─────────────────────────────
app.post('/api/sprechen/topics/generate', async (req, res) => {
  const level = (req.body && req.body.level) || 'A1';
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  console.log(`[/api/sprechen/topics] generate level=${level}`);
  try {
    const topics = await callClaudeJSON(SPRECHEN_TOPIC_SYSTEM_PROMPT, 'Generate the 3 A1 Sprechen topics now.', 1600);
    if (!topics || !topics.part1 || !topics.part2 || !topics.part3) {
      return res.status(502).json({ error: 'Could not generate topics.' });
    }
    // Persist (best-effort) — one row per part.
    if (supabaseAdmin) {
      const rows = [
        { level, part: 1, topic_text: topics.part1.topic || '', instructions: topics.part1 },
        { level, part: 2, topic_text: topics.part2.topic || '', example_image_url: null, instructions: topics.part2 },
        { level, part: 3, topic_text: topics.part3.topic || '', instructions: topics.part3 },
      ];
      supabaseAdmin.from('sprechen_topics').insert(rows).then(function(){}, function(){});
    }
    return res.json({ level, topics });
  } catch (err) {
    console.error('[/api/sprechen/topics] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ── Part 3: GET /api/sprechen/cap/:userId/:level ───────────────────────────
async function sprechenGetCap(userId, level) {
  if (!supabaseAdmin) return { allowed: true, remaining: 10 };
  const { data } = await supabaseAdmin
    .from('sprechen_session_caps').select('sessions_used, max_sessions')
    .eq('user_id', userId).eq('level', level).maybeSingle();
  const used = data ? (data.sessions_used || 0) : 0;
  const max  = data ? (data.max_sessions || 10) : 10;
  if (used >= max) {
    return { allowed: false, remaining: 0, message: `You have used all ${max} free sessions for ${level}. Upgrade to continue.` };
  }
  return { allowed: true, remaining: max - used };
}

app.get('/api/sprechen/cap/:userId/:level', async (req, res) => {
  try {
    const out = await sprechenGetCap(req.params.userId, req.params.level || 'A1');
    return res.json(out);
  } catch (err) {
    console.error('[/api/sprechen/cap] error:', err.message);
    return res.status(500).json({ error: 'Could not check session cap.' });
  }
});

// Increment sessions_used after a completed session (upsert the cap row).
async function sprechenIncrementCap(userId, level) {
  if (!supabaseAdmin) return;
  const { data } = await supabaseAdmin
    .from('sprechen_session_caps').select('sessions_used, max_sessions')
    .eq('user_id', userId).eq('level', level).maybeSingle();
  const used = data ? (data.sessions_used || 0) : 0;
  const max  = data ? (data.max_sessions || 10) : 10;
  await supabaseAdmin.from('sprechen_session_caps').upsert({
    user_id: userId, level, sessions_used: used + 1, max_sessions: max,
    last_session_date: new Date().toISOString(),
  }, { onConflict: 'user_id,level' });
}

// ── Part 5: post-session feedback (shared builder + endpoint) ───────────────
function buildSprechenFeedbackPrompt(language) {
  const langName = SPRECHEN_LANGS[language] || 'English';
  return `You are a Goethe A1 exam feedback specialist for African learners.

Analyze this Sprechen session transcript and generate structured feedback.

The candidate is an African immigrant learning German for life in Germany
and the Goethe A1 exam.

Generate ALL feedback in ${langName}.

Score each area 1-5:
- Aussprache (pronunciation)
- Kommunikation (did they get the message across?)
- Grammatik (grammar accuracy)
- Wortschatz (vocabulary range)
- Overall score

Feedback structure:
1. OPENING — one warm encouraging sentence acknowledging their effort
2. WHAT WENT WELL — 2-3 specific things they did well with examples from transcript
3. AREAS TO IMPROVE — 2-3 specific improvements with examples from transcript
4. EXAM TIP — one specific Goethe A1 tip based on their performance
5. ENCOURAGEMENT — one final motivating sentence connecting to their Germany goal

Rules:
- Be specific — reference actual words or sentences from the transcript
- Be encouraging — this learner has high stakes (visa, family reunification, Ausbildung)
- Never be harsh or discouraging
- Keep each section short — maximum 3 sentences
- Generate everything in ${langName}

Return valid JSON only:
{
  "score_overall": ,
  "score_aussprache": ,
  "score_kommunikation": ,
  "score_grammatik": ,
  "score_wortschatz": ,
  "opening": "",
  "what_went_well": "",
  "areas_to_improve": "",
  "exam_tip": "",
  "encouragement": ""
}`;
}

function clampScore(v) { var n = Math.round(Number(v)); return isNaN(n) ? null : Math.max(1, Math.min(5, n)); }

async function generateSprechenFeedback(transcript, language) {
  const fb = await callClaudeJSON(
    buildSprechenFeedbackPrompt(language),
    `Here is the session transcript:\n\n${String(transcript || '').slice(0, 12000)}`,
    1100
  );
  if (!fb) return null;
  ['score_overall','score_aussprache','score_kommunikation','score_grammatik','score_wortschatz']
    .forEach(function(k){ fb[k] = clampScore(fb[k]); });
  return fb;
}

app.post('/api/sprechen/feedback', async (req, res) => {
  const { transcript, user_id, session_id, preferred_language } = req.body || {};
  const language = sprechenLang(preferred_language);
  if (!transcript || String(transcript).trim().length < 10) {
    return res.status(400).json({ error: 'Transcript too short for feedback.' });
  }
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  try {
    const fb = await generateSprechenFeedback(transcript, language);
    if (!fb) return res.status(502).json({ error: 'Could not generate feedback.' });
    if (supabaseAdmin && session_id) {
      supabaseAdmin.from('sprechen_sessions').update({
        feedback: fb, feedback_language: language,
        score_overall: fb.score_overall, score_aussprache: fb.score_aussprache,
        score_kommunikation: fb.score_kommunikation, score_grammatik: fb.score_grammatik,
        score_wortschatz: fb.score_wortschatz, completed: true,
      }).eq('id', session_id).then(function(){}, function(){});
    }
    return res.json(fb);
  } catch (err) {
    console.error('[/api/sprechen/feedback] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ── POST /api/exam-grade ─────────────────────────────────────────────────────
// Grades a structured A1 Schreiben exam submission (form fill + short message).
// Returns a JSON response with per-task scores, rubric breakdown, top mistakes,
// and a next-step recommendation. The client renders this verbatim — no
// post-processing beyond shape validation here.

const EXAM_GRADE_A1_SYSTEM_PROMPT = `You are a certified Goethe-Institut A1 exam grader. Grade this student's Schreiben submission using the official Goethe A1 Fit in Deutsch 1 rubric exactly.

The student wrote a short message (~30 words) responding to an email stimulus. Grade using ONLY these two official criteria:

CRITERION 1 — Kommunikative Gestaltung / Inhalt und Umfang (max 3 points):
- 3 points: Text fully matches the prompt AND reaches approximately 30 words. Has greeting and closing. Gives relevant personal information.
- 2 points: Text largely matches the prompt. Word count is between 20–30. Most required content is present.
- 1 point: Text partially matches the prompt OR sentences are copied verbatim from the stimulus. Content is too sparse.
- 0 points: Text does not match the prompt at all. If 0 — the ENTIRE Schreiben section scores 0.

CRITERION 2 — Formale Richtigkeit (max 3 points):
- 3 points: No errors or only isolated errors in syntax, morphology, orthography/punctuation.
- 2 points: Some errors in syntax, morphology, orthography that slightly affect comprehension.
- 1 point: Errors at multiple points that noticeably affect comprehension.
- 0 points: So many errors that the content is no longer comprehensible. If 0 — the ENTIRE Schreiben section scores 0.

IMPORTANT RULES:
- Spelling errors are only penalised if they affect comprehension.
- Even imperfect sentences can score full marks if they are understandable.
- If either criterion scores 0, set both scores to 0 and total_score to 0.
- The raw total (criterion1 + criterion2) is multiplied by 2 to get the final score out of 12.
- Word count: count the student's words carefully. Do not count the greeting line as words if it is a single word like "Hallo".

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau A1.
Benutze nur sehr einfache Wörter und kurze Sätze.
Maximal 8 Wörter pro Satz.
Keine langen Erklärungen.
Sei freundlich. Benutze 'du'.

Respond as a single raw JSON object — no markdown, no code fences, no text outside the JSON. Use this exact shape:
{
  "kommunikative_gestaltung": {
    "score": <integer 0–3>,
    "max": 3,
    "explanation": "One sentence explaining this score.",
    "tip": "One concrete improvement tip."
  },
  "formale_richtigkeit": {
    "score": <integer 0–3>,
    "max": 3,
    "explanation": "One sentence explaining this score.",
    "tip": "One concrete improvement tip."
  },
  "raw_total": <kommunikative_gestaltung.score + formale_richtigkeit.score>,
  "total_score": <raw_total * 2>,
  "max_score": 12,
  "word_count": <integer — number of words counted in the student's message>,
  "overall_feedback": "Two encouraging sentences.",
  "top_mistakes": ["First mistake to fix.", "Second mistake to fix."],
  "next_recommendation": "One concrete next-practice activity."
}`;

const EXAM_GRADE_A2_SYSTEM_PROMPT = `You are a certified Goethe-Institut A2 exam grader. Grade this student's Schreiben submission using the official Goethe A2 rubric.

The student wrote TWO texts:
- Task 1: SMS (target 20–30 words, must cover 3 bullet points)
- Task 2: Semi-formal email (target 30–40 words, must cover 3 bullet points)

Grade each task on TWO criteria using this 5-level scale:

CRITERION: Aufgabenerfüllung (task completion + register):
A = 5 points: all 3 bullet points covered adequately, appropriate register
B = 3.5 points: 2 bullet points adequate OR 1 adequate + 2 partial
C = 2 points: 1 bullet point adequate + 1 partial OR all partial
D = 0.5 points: 1 bullet point adequate or partial, not register-appropriate
E = 0 points: text too short (under 10 words Task1 / under 15 words Task2) OR topic missed entirely — IF E then entire task scores 0

CRITERION: Sprache (language — vocabulary, structures, coherence):
A = 5 points: appropriate and varied, isolated errors don't affect comprehension
B = 3.5 points: mostly appropriate, several errors don't affect comprehension
C = 2 points: partly appropriate, several errors partly affect comprehension
D = 0.5 points: barely appropriate, errors seriously affect comprehension
E = 0 points: text completely inappropriate throughout

SCORING:
- Task 1 raw = Aufgabenerfüllung + Sprache (max 10)
- Task 2 raw = Aufgabenerfüllung + Sprache (max 10)
- Total raw = Task1 + Task2 (max 20)
- Final score = total raw × 1.25 (max 25)
- If Aufgabenerfüllung = E for a task, that entire task = 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau A2.
Benutze einfache Wörter und kurze Sätze.
Maximal 12 Wörter pro Satz.
Sei freundlich und ermutigend. Benutze 'du'.

Return raw JSON only, no markdown, using this exact shape:
{
  "task2_aufgabe": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_sprache": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_aufgabe": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_sprache": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_raw":   <task2_aufgabe.score + task2_sprache.score>,
  "task3_raw":   <task3_aufgabe.score + task3_sprache.score>,
  "total_raw":   <task2_raw + task3_raw>,
  "total_score": <total_raw * 1.25>,
  "max_score":   25,
  "overall_feedback": "...",
  "top_mistakes": ["...", "..."],
  "next_recommendation": "..."
}`;

// B1 rubric — official Goethe-Zertifikat B1 Modellsatz Schreiben.
// Three independent tasks, each graded on 2 criteria using the A–E
// scale (5 / 3.5 / 2 / 0.5 / 0). Per-task max = 10 raw points. Total
// raw max = 30. Final score = round(total_raw / 30 × 100) so the
// displayed number is always /100, matching the official conversion.
// Pass = 60 (60%). If Erfüllung = E for a task, that entire task = 0.
const EXAM_GRADE_B1_SYSTEM_PROMPT = `You are a certified Goethe-Institut B1 exam grader. Grade this student's Schreiben submission using the official Goethe-Zertifikat B1 Modellsatz rubric exactly.

The student wrote THREE texts:
- Aufgabe 1: personal email (target ~80 words, must cover 3 bullet points)
- Aufgabe 2: opinion / discussion text (target ~80 words, must give a clear opinion + reasons)
- Aufgabe 3: short formal email (target ~40 words, must cover 3 bullet points, formal register)

Grade EACH task INDEPENDENTLY on TWO criteria using this 5-level A–E scale:

CRITERION: Erfüllung — task completion + content
A = 5    points: all required content fully addressed, register fits the task
B = 3.5  points: most content addressed, minor register slips OR one bullet point underdeveloped
C = 2    points: about half the required content addressed
D = 0.5  points: very little content addressed
E = 0    points: topic missed entirely OR text far too short — IF E for a task, that whole task scores 0

CRITERION: Sprache — language (Kohärenz + Wortschatz + Strukturen combined)
A = 5    points: B1-appropriate vocabulary + varied structures + clear coherence; isolated errors don't impede comprehension
B = 3.5  points: mostly appropriate; several errors don't impede comprehension
C = 2    points: limited vocabulary, simple structures; errors slightly impede comprehension
D = 0.5  points: very limited; errors seriously impede comprehension
E = 0    points: language so poor the text is incomprehensible

SCORING (compute exactly as below):
- aufgabe1.task_raw = aufgabe1.erfuellung.score + aufgabe1.sprache.score   (max 10)
- aufgabe2.task_raw = aufgabe2.erfuellung.score + aufgabe2.sprache.score   (max 10)
- aufgabe3.task_raw = aufgabe3.erfuellung.score + aufgabe3.sprache.score   (max 10)
- total_raw   = aufgabe1.task_raw + aufgabe2.task_raw + aufgabe3.task_raw  (max 30)
- total_score = round(total_raw / 30 × 100)                                (max 100)
- max_score   = 100
- Pass mark   = 60 (60%) — official Goethe B1 pass threshold
- IF Erfüllung = E for a task → set BOTH that task's scores to 0 and task_raw to 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau B1.
Klare, einfache Sätze. Sei freundlich, konstruktiv. Benutze 'du'.

Return raw JSON only, no markdown, no code fences, no text outside the JSON. Use this exact shape:
{
  "aufgabe1": {
    "erfuellung": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "Ein bis zwei Sätze auf Deutsch.", "tip": "Ein konkreter Verbesserungsvorschlag." },
    "sprache":    { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "..." },
    "task_raw":   <erfuellung.score + sprache.score>
  },
  "aufgabe2": {
    "erfuellung": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "..." },
    "sprache":    { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "..." },
    "task_raw":   <erfuellung.score + sprache.score>
  },
  "aufgabe3": {
    "erfuellung": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "..." },
    "sprache":    { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "..." },
    "task_raw":   <erfuellung.score + sprache.score>
  },
  "total_raw":   <integer or half = aufgabe1.task_raw + aufgabe2.task_raw + aufgabe3.task_raw>,
  "total_score": <integer = round(total_raw / 30 * 100)>,
  "max_score":   100,
  "overall_feedback":    "Zwei ermutigende Sätze auf Deutsch.",
  "top_mistakes":        ["Erste Verbesserung.", "Zweite Verbesserung.", "Dritte Verbesserung."],
  "next_recommendation": "Eine konkrete Übung als nächster Schritt."
}`;

// B2 rubric — 2 writing tasks (forum/opinion post + formal letter).
// Each task scored on 4 criteria, A–E scale, per-task max = 20, total = 40.
const EXAM_GRADE_B2_SYSTEM_PROMPT = `You are a certified Goethe-Institut B2 exam grader. Grade this student's Schreiben submission using the official Goethe-Zertifikat B2 rubric.

The student wrote TWO texts:
- Aufgabe 1: forum / opinion post (target ~150 words, clear position + arguments + examples)
- Aufgabe 2: formal letter or semi-formal email (target ~100 words, all bullet points + appropriate register)

Grade each task on FOUR criteria using this 5-level scale:

CRITERION: Erfüllung (content — coverage of all bullet points + topic depth)
A = 5 points: all bullet points fully addressed, depth appropriate, topic clearly developed
B = 3.5 points: most bullet points addressed, some depth missing
C = 2 points: about half addressed OR superficial throughout
D = 0.5 points: very little content addressed
E = 0 points: topic missed entirely — IF E then entire task scores 0

CRITERION: Kohärenz (text structure — transitions, paragraphing, opening/closing)
A = 5 points: well-structured, varied connectors, clear opening + closing, smooth flow
B = 3.5 points: mostly structured, basic connectors, some flow issues
C = 2 points: partial structure, repetitive transitions
D = 0.5 points: mostly disconnected
E = 0 points: incoherent

CRITERION: Wortschatz (vocabulary — range + precision + register)
A = 5 points: varied B2-appropriate vocabulary, precise word choice, register fits
B = 3.5 points: adequate vocabulary, occasional imprecision
C = 2 points: limited vocabulary, frequent imprecision or register slips
D = 0.5 points: very limited vocabulary, register often wrong
E = 0 points: vocabulary completely inadequate

CRITERION: Strukturen (grammar — sentence variety + accuracy)
A = 5 points: complex + varied structures, isolated errors don't impede comprehension
B = 3.5 points: mostly varied, several errors don't impede comprehension
C = 2 points: simple structures dominate, several errors slightly impede comprehension
D = 0.5 points: very basic structures, errors seriously impede comprehension
E = 0 points: grammar so poor the text is incomprehensible

SCORING:
- Each task raw = Erfüllung + Kohärenz + Wortschatz + Strukturen (max 20)
- Total raw = task2_raw + task3_raw (max 40)
- Final score = total raw (no scaling at B2)
- If Erfüllung = E for a task, that entire task = 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau B2.
Präzise, sachlich, freundlich. Benutze 'du'.

Return raw JSON only, no markdown, using this exact shape:
{
  "task2_erfuellung":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_koherenz":    { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_wortschatz":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_strukturen":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_erfuellung":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_koherenz":    { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_wortschatz":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_strukturen":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_raw":   <sum of task2 four criteria>,
  "task3_raw":   <sum of task3 four criteria>,
  "total_raw":   <task2_raw + task3_raw>,
  "total_score": <total_raw>,
  "max_score":   40,
  "overall_feedback": "...",
  "top_mistakes": ["...", "..."],
  "next_recommendation": "..."
}`;

app.post('/api/exam-grade', async (req, res) => {
  const { level, task2, task3, task4 } = req.body || {};
  const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const safeLevel = VALID_LEVELS.indexOf(level) !== -1 ? level : 'A1';

  // task2 is required for every level (A1 message / A2 SMS / B1 informal post / B2 forum post).
  if (!task2 || typeof task2 !== 'string' || task2.trim().length < 1) {
    return res.status(400).json({ error: 'Missing task2 response.' });
  }
  // task3 (A2 email / B1 opinion post / B2 formal letter) — required for A2/B1/B2.
  if (safeLevel !== 'A1' && (!task3 || typeof task3 !== 'string' || task3.trim().length < 1)) {
    return res.status(400).json({ error: 'Missing task3 response.' });
  }
  // task4 (B1 formal email) — required only for B1.
  if (safeLevel === 'B1' && (!task4 || typeof task4 !== 'string' || task4.trim().length < 1)) {
    return res.status(400).json({ error: 'Missing task4 response (B1 formal email).' });
  }
  if (!process.env.CLAUDE_API_KEY) {
    console.error('[/api/exam-grade] CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const task2Block = String(task2).slice(0, 2500).trim();
  const task3Block = task3 ? String(task3).slice(0, 2500).trim() : '';
  const task4Block = task4 ? String(task4).slice(0, 2500).trim() : '';

  // Pick the per-level system prompt + user-message format.
  let systemPrompt, userMessage;
  if (safeLevel === 'B2') {
    systemPrompt = EXAM_GRADE_B2_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (Forum/Meinung, target ~150 words):\n"""\n${task2Block}\n"""\n\n` +
      `Aufgabe 2 (formelle E-Mail/Brief, target ~100 words):\n"""\n${task3Block}\n"""`;
  } else if (safeLevel === 'B1') {
    systemPrompt = EXAM_GRADE_B1_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (informeller Beitrag, target ~80 words):\n"""\n${task2Block}\n"""\n\n` +
      `Aufgabe 2 (Forumsbeitrag mit Meinung, target ~80 words):\n"""\n${task3Block}\n"""\n\n` +
      `Aufgabe 3 (formelle E-Mail, target ~40 words):\n"""\n${task4Block}\n"""`;
  } else if (safeLevel === 'A2') {
    systemPrompt = EXAM_GRADE_A2_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (SMS, target 20–30 words):\n"""\n${task2Block}\n"""\n\n` +
      `Aufgabe 2 (E-Mail, target 30–40 words):\n"""\n${task3Block}\n"""`;
  } else {
    systemPrompt = EXAM_GRADE_A1_SYSTEM_PROMPT;
    userMessage  = `Student's short message (target ~30 words):\n"""\n${task2Block}\n"""`;
  }

  console.log(`[/api/exam-grade] Request — level=${safeLevel}, task2=${task2Block.length}${task3Block ? ', task3=' + task3Block.length : ''}${task4Block ? ', task4=' + task4Block.length : ''} chars, origin: ${req.headers.origin || 'none'}`);

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
        max_tokens: 2500,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `Claude API returned ${response.status}`;
      console.error('[/api/exam-grade] Claude API error:', message);
      return res.status(502).json({ error: message });
    }

    const data = await response.json();
    const raw  = (data?.content?.[0]?.text ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let result;
    try { result = JSON.parse(raw); }
    catch (parseErr) {
      console.error('[/api/exam-grade] JSON parse error. Raw response:\n', raw);
      return res.status(502).json({ error: 'Could not parse grading response. Try again.' });
    }

    // Shape validation per level. All levels end in numeric total_score.
    let shapeOk;
    if (safeLevel === 'B2') {
      shapeOk = (
        result.task2_erfuellung && typeof result.task2_erfuellung.score === 'number' &&
        result.task2_koherenz   && typeof result.task2_koherenz.score   === 'number' &&
        result.task2_wortschatz && typeof result.task2_wortschatz.score === 'number' &&
        result.task2_strukturen && typeof result.task2_strukturen.score === 'number' &&
        result.task3_erfuellung && typeof result.task3_erfuellung.score === 'number' &&
        result.task3_koherenz   && typeof result.task3_koherenz.score   === 'number' &&
        result.task3_wortschatz && typeof result.task3_wortschatz.score === 'number' &&
        result.task3_strukturen && typeof result.task3_strukturen.score === 'number' &&
        typeof result.total_score === 'number'
      );
    } else if (safeLevel === 'B1') {
      // Official Goethe B1 Modellsatz shape — 3 independent tasks
      // (aufgabe1/2/3), each with two criteria (erfuellung, sprache)
      // on the A-E scale (5/3.5/2/0.5/0). Total raw /30, scaled to /100.
      var taskOk = function (t) {
        return t
          && t.erfuellung && typeof t.erfuellung.score === 'number'
          && t.sprache    && typeof t.sprache.score    === 'number';
      };
      shapeOk = (
        taskOk(result.aufgabe1) &&
        taskOk(result.aufgabe2) &&
        taskOk(result.aufgabe3) &&
        typeof result.total_score === 'number'
      );
    } else if (safeLevel === 'A2') {
      shapeOk = (
        result.task2_aufgabe && typeof result.task2_aufgabe.score === 'number' &&
        result.task2_sprache && typeof result.task2_sprache.score === 'number' &&
        result.task3_aufgabe && typeof result.task3_aufgabe.score === 'number' &&
        result.task3_sprache && typeof result.task3_sprache.score === 'number' &&
        typeof result.total_score === 'number'
      );
    } else {
      shapeOk = (
        result.kommunikative_gestaltung && typeof result.kommunikative_gestaltung.score === 'number' &&
        result.formale_richtigkeit      && typeof result.formale_richtigkeit.score      === 'number' &&
        typeof result.total_score === 'number'
      );
    }
    if (!shapeOk) {
      console.error('[/api/exam-grade] Unexpected response shape:', result);
      return res.status(502).json({ error: 'Unexpected response format from grader. Try again.' });
    }

    const fallbackMax = { A1: 12, A2: 25, B1: 100, B2: 40 }[safeLevel];
    console.log(`[/api/exam-grade] Success — level=${safeLevel}, total=${result.total_score}/${result.max_score || fallbackMax}`);
    return res.json(result);

  } catch (err) {
    console.error('[/api/exam-grade] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/tts ───────────────────────────────────────────────────────────
// Text-to-speech via ElevenLabs. Used by the AI Tutor's per-message speaker
// button (on-demand, never automatic) so learners can *hear* the tutor's
// German reply. Frontend POSTs { text }; we stream audio/mpeg back.
//
// Cost model: ElevenLabs bills per character on the input text. The Flash
// (eleven_flash_v2_5) tier is the cheapest multilingual model and is fine
// for short tutor replies. Voice + model are overridable via env vars so a
// swap doesn't need a redeploy.
//
// Security: ELEVENLABS_API_KEY comes from the Render env only. Never logged,
// never returned in any response.
app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing or empty text.' });
  }
  // Hard cap to keep a runaway request from running up the bill. Tutor
  // replies are well under this in practice (a typical chat turn is ~300
  // chars); the cap is a guard, not a UX limit.
  const MAX_CHARS = 1500;
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text too long (max ${MAX_CHARS} characters).` });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('[/api/tts] ELEVENLABS_API_KEY is not set');
    return res.status(500).json({ error: 'TTS not configured on the server.' });
  }

  // Defaults: a native-German voice from the ElevenLabs Voice Library +
  // turbo_v2_5, a fast multilingual model that accepts a language_code hint
  // (the older flash_v2_5 + an English-trained voice was producing
  // recognisably anglicised German). Both still overridable via env so you
  // can A/B without a redeploy.
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'rKiu7lQ4c5P3az3745s3';
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';

  // Only some models accept the language_code field; sending it to others
  // returns a 400. Keep this list updated as new models ship.
  const LANG_CODE_MODELS = new Set(['eleven_turbo_v2_5', 'eleven_flash_v2_5']);

  const upstreamBody = {
    text:     text,
    model_id: modelId,
    // Conservative voice settings — stable, recognisable, no
    // randomness drift on repeat plays of the same text.
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  };
  if (LANG_CODE_MODELS.has(modelId)) {
    upstreamBody.language_code = 'de';
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':  process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':      'audio/mpeg',
        },
        body: JSON.stringify(upstreamBody)
      }
    );

    if (!upstream.ok) {
      // Read the body to log a clue, but don't echo upstream errors to the
      // client (they sometimes include account-level info we shouldn't leak).
      const errBody = await upstream.text().catch(() => '');
      console.error('[/api/tts] upstream', upstream.status, errBody.slice(0, 200));
      return res.status(502).json({ error: 'TTS service unavailable.' });
    }

    res.setHeader('Content-Type',  'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    // node-fetch v2 exposes the response as a Node Readable stream — pipe
    // straight to the client so we don't buffer the whole audio in memory.
    upstream.body.on('error', (e) => {
      console.error('[/api/tts] upstream stream error', e && e.message);
      res.end();
    });
    upstream.body.pipe(res);

  } catch (err) {
    console.error('[/api/tts] threw', err && err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'TTS request failed.' });
    }
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SPRECHEN — Part 4: Gemini Live WebSocket (wss://…/sprechen-session)
// The browser streams 16kHz PCM mic audio here; we proxy to Gemini Live (the
// examiner) and stream 24kHz PCM audio back. Transcripts are collected, and on
// session end we save the session, generate feedback, and bump the cap.
// ═══════════════════════════════════════════════════════════════════════════

const SPRECHEN_GEMINI_MODEL = 'gemini-2.0-flash-live-001'; // Gemini Live (Dev API, v1alpha)
const SPRECHEN_MAX_MS = 15 * 60 * 1000;

function buildExaminerPrompt(topics) {
  const t = topics || {};
  const p1 = (t.part1 && t.part1.topic) || 'Stellen Sie sich vor — Name, Herkunft, Beruf.';
  const p2 = (t.part2 && t.part2.topic) || 'Beschreiben Sie das Bild — was sehen Sie?';
  const p3 = (t.part3 && t.part3.topic) || 'Planen Sie etwas zusammen.';
  return `You are a Goethe A1 German exam examiner conducting an official speaking test.

Your role:
- Speak ONLY in German throughout the entire session
- Use simple A1 level German only — short sentences, basic vocabulary
- Be warm, patient and encouraging — many candidates are nervous
- Follow the official 3-part Goethe A1 Sprechen format exactly
- Never switch to English or any other language during the session
- Speak clearly and at a measured pace suitable for beginners
- If the candidate struggles, gently repeat or rephrase in simpler German
- Never correct grammar mid-sentence — let the candidate finish
- React naturally like a real examiner would

Session structure:
Part 1 — Sich vorstellen: ${p1}
Part 2 — Bild beschreiben: ${p2}
Part 3 — Gemeinsam planen: ${p3}

Begin the session warmly in German. Introduce yourself as the examiner and start Part 1.`;
}

function attachSprechenWebSocket(server) {
  let GoogleGenAI, Modality;
  try { ({ GoogleGenAI, Modality } = require('@google/genai')); }
  catch (e) { console.warn('[sprechen-ws] @google/genai not installed — live sessions disabled'); }

  const wss = new WebSocketServer({ server, path: '/sprechen-session' });
  console.log('  ✦ WSS /sprechen-session ready (Gemini Live examiner)');

  wss.on('connection', function (ws) {
    let gemini = null;          // Gemini Live session
    let started = false;        // init received
    let finalized = false;
    let sessionId = null;
    let userId = null, level = 'A1', language = 'english';
    let startedAt = Date.now();
    let timeout = null;
    const transcript = [];      // [{role, text}]

    const send = (obj) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (_) {} };

    function appendTranscript(role, text) {
      if (!text) return;
      const last = transcript[transcript.length - 1];
      if (last && last.role === role) last.text += text;
      else transcript.push({ role, text });
    }
    function transcriptString() {
      return transcript.map(t => (t.role === 'examiner' ? 'Examiner (Prüfer): ' : 'Candidate (Kandidat): ') + t.text.trim()).join('\n');
    }

    async function finalize(reason) {
      if (finalized) return;
      finalized = true;
      if (timeout) clearTimeout(timeout);
      try { if (gemini) gemini.close(); } catch (_) {}
      const duration = Math.round((Date.now() - startedAt) / 1000);
      const fullTranscript = transcriptString();

      // Persist transcript + duration on the session row.
      if (supabaseAdmin && sessionId) {
        supabaseAdmin.from('sprechen_sessions')
          .update({ transcript: fullTranscript, duration_seconds: duration })
          .eq('id', sessionId).then(function(){}, function(){});
      }

      // Feedback (only if there was a real conversation).
      if (fullTranscript.trim().length > 20 && process.env.CLAUDE_API_KEY) {
        try {
          const fb = await generateSprechenFeedback(fullTranscript, language);
          if (fb && supabaseAdmin && sessionId) {
            await supabaseAdmin.from('sprechen_sessions').update({
              feedback: fb, feedback_language: language,
              score_overall: fb.score_overall, score_aussprache: fb.score_aussprache,
              score_kommunikation: fb.score_kommunikation, score_grammatik: fb.score_grammatik,
              score_wortschatz: fb.score_wortschatz, completed: true, duration_seconds: duration,
            }).eq('id', sessionId);
          }
          send({ type: 'feedback', feedback: fb, session_id: sessionId, duration_seconds: duration });
        } catch (e) {
          send({ type: 'error', message: 'Feedback generation failed: ' + e.message });
        }
      } else {
        send({ type: 'done', session_id: sessionId, duration_seconds: duration });
      }

      // Count the session against the cap.
      if (userId) { try { await sprechenIncrementCap(userId, level); } catch (_) {} }
      try { ws.close(); } catch (_) {}
    }

    async function startSession(init) {
      userId   = init.user_id || null;
      level    = init.level || 'A1';
      language = sprechenLang(init.preferred_language);

      if (!GoogleGenAI || !process.env.GEMINI_API_KEY) {
        send({ type: 'error', message: 'Live speaking is temporarily unavailable. Please try again later.' });
        return ws.close();
      }
      // Cap gate.
      try {
        const cap = await sprechenGetCap(userId, level);
        if (!cap.allowed) { send({ type: 'cap_exceeded', message: cap.message }); return ws.close(); }
      } catch (_) {}

      // Create the session row up front.
      if (supabaseAdmin && userId) {
        const { data } = await supabaseAdmin.from('sprechen_sessions')
          .insert({ user_id: userId, level, feedback_language: language, completed: false })
          .select('id').maybeSingle();
        sessionId = data && data.id;
      }
      startedAt = Date.now();
      timeout = setTimeout(() => finalize('timeout'), SPRECHEN_MAX_MS);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
      try {
        gemini = await ai.live.connect({
          model: SPRECHEN_GEMINI_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: buildExaminerPrompt(init.topics),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: { languageCode: 'de-DE' },
          },
          callbacks: {
            onopen: () => { console.log('[sprechen-ws] gemini onopen'); send({ type: 'ready' }); },
            onmessage: (msg) => {
              const sc = msg && msg.serverContent;
              if (!sc) return;
              if (sc.outputTranscription && sc.outputTranscription.text) {
                appendTranscript('examiner', sc.outputTranscription.text);
                send({ type: 'transcript', role: 'examiner', text: sc.outputTranscription.text });
              }
              if (sc.inputTranscription && sc.inputTranscription.text) {
                appendTranscript('candidate', sc.inputTranscription.text);
                send({ type: 'transcript', role: 'candidate', text: sc.inputTranscription.text });
              }
              const parts = sc.modelTurn && sc.modelTurn.parts;
              if (Array.isArray(parts)) {
                parts.forEach((p) => {
                  if (p.inlineData && p.inlineData.data) {
                    send({ type: 'audio', data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'audio/pcm;rate=24000' });
                  }
                });
              }
              if (sc.turnComplete) send({ type: 'turn_complete' });
            },
            onerror: (e) => { send({ type: 'error', message: 'Examiner connection error.' }); console.error('[sprechen-ws] gemini onerror:', (e && (e.message || e.reason)) || e); },
            onclose: (e) => { console.log('[sprechen-ws] gemini onclose code=' + (e && e.code) + ' reason=' + (e && e.reason)); finalize('gemini_closed'); },
          },
        });
        // Examiner speaks first — nudge now that the session is open and assigned.
        try {
          gemini.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: 'Der Kandidat ist bereit. Bitte beginnen Sie jetzt mit der Prüfung.' }] }],
            turnComplete: true,
          });
          console.log('[sprechen-ws] sent opening nudge');
        } catch (e) { console.error('[sprechen-ws] nudge failed:', e && e.message); }
      } catch (e) {
        console.error('[sprechen-ws] connect failed', e && e.message);
        send({ type: 'error', message: 'Could not start the examiner. Please try again.' });
        return ws.close();
      }
    }

    ws.on('message', (raw) => {
      let msg = null;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (msg.type === 'init') {
        if (started) return;
        started = true;
        startSession(msg).catch((e) => { send({ type: 'error', message: e.message }); });
      } else if (msg.type === 'audio' && gemini && msg.data) {
        try { gemini.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } }); } catch (_) {}
      } else if (msg.type === 'end') {
        finalize('client_end');
      }
    });

    ws.on('close', () => { finalize('ws_closed'); });
    ws.on('error', () => { finalize('ws_error'); });
  });
}

// ── Start ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ✦ DeutschWeg Exam Whisperer API');
  console.log(`  ✦ Running at http://localhost:${PORT}`);
  console.log('  ✦ POST /api/score to score a Schreiben submission');
  console.log('  ✦ POST /api/exam-grade to grade a Schreiben exam');
  console.log('  ✦ POST /api/tts   to generate audio for AI Tutor replies');
  console.log('  ✦ POST /api/sprechen/* + WSS /sprechen-session (A1 speaking)');
  console.log('');
});
attachSprechenWebSocket(server);
