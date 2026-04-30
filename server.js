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
        model:      'claude-sonnet-4-20250514',
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

// ── POST /api/aitutor ────────────────────────────────────────────────────────
const AITUTOR_VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];

function buildAitutorPrompt(level) {
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
- If student seems frustrated, be extra warm and reassuring`;
}

app.post('/api/aitutor', async (req, res) => {
  const { messages, level } = req.body;
  const safeLevel = AITUTOR_VALID_LEVELS.includes(level) ? level : 'A1';

  console.log(`[/api/aitutor] Request — level: ${safeLevel}, msgs: ${Array.isArray(messages) ? messages.length : 'invalid'}, origin: ${req.headers.origin || 'none'}`);

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    console.error('CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  // Cap to last 30 turns; truncate each to bound payload size
  const trimmed = messages.slice(-30).map(m => ({
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
        model:      'claude-sonnet-4-20250514',
        max_tokens: 800,
        system:     buildAitutorPrompt(safeLevel),
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

// B1 rubric — 3 writing tasks (informal post / opinion post / formal email).
// Each task scored on 3 criteria using the A–E scale common to Goethe
// rubrics (A=5, B=3.5, C=2, D=0.5, E=0). Per-task max = 15, total = 45.
// (Approximation of the official Goethe-Zertifikat B1 weighting — adjust
// the numeric anchors below if your school uses a different rubric.)
const EXAM_GRADE_B1_SYSTEM_PROMPT = `You are a certified Goethe-Institut B1 exam grader. Grade this student's Schreiben submission using the official Goethe-Zertifikat B1 rubric.

The student wrote THREE texts:
- Aufgabe 1: informal forum post or email (target ~80 words)
- Aufgabe 2: opinion forum post (target ~80 words, must include a clear opinion + reasons)
- Aufgabe 3: formal/semi-formal email (target ~40 words, formal register, all bullet points)

Grade each task on THREE criteria using this 5-level scale:

CRITERION: Aufgabenerfüllung (task completion + register + length)
A = 5 points: all required content present, register fits, length within target
B = 3.5 points: most content present, minor register slips OR slightly off-length
C = 2 points: about half the content, register problems OR clearly off-length
D = 0.5 points: very little content OR register completely wrong
E = 0 points: topic missed, far too short — IF E then entire task scores 0

CRITERION: Kohärenz (coherence — connectors, paragraphing, flow)
A = 5 points: smooth transitions, varied connectors, paragraphing where appropriate
B = 3.5 points: mostly coherent, basic connectors, occasional gaps
C = 2 points: partly coherent, repetitive connectors
D = 0.5 points: mostly disconnected sentences
E = 0 points: incoherent throughout

CRITERION: Sprache (vocabulary + grammar + spelling)
A = 5 points: B1-appropriate vocabulary + structures, isolated errors don't impede comprehension
B = 3.5 points: mostly appropriate, several errors don't impede comprehension
C = 2 points: limited vocabulary + simple structures, several errors slightly impede comprehension
D = 0.5 points: very limited, errors seriously impede comprehension
E = 0 points: language so poor the text is incomprehensible

SCORING:
- Each task raw = Aufgabenerfüllung + Kohärenz + Sprache (max 15)
- Total raw = task2_raw + task3_raw + task4_raw (max 45)
- Final score = total raw (no scaling at B1)
- If Aufgabenerfüllung = E for a task, that entire task = 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau B1.
Klare, einfache Sätze. Sei freundlich und konstruktiv. Benutze 'du'.

Return raw JSON only, no markdown, using this exact shape:
{
  "task2_aufgabe":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_koherenz": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_sprache":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_aufgabe":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_koherenz": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task3_sprache":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task4_aufgabe":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task4_koherenz": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task4_sprache":  { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "..." },
  "task2_raw":   <task2_aufgabe.score + task2_koherenz.score + task2_sprache.score>,
  "task3_raw":   <task3_aufgabe.score + task3_koherenz.score + task3_sprache.score>,
  "task4_raw":   <task4_aufgabe.score + task4_koherenz.score + task4_sprache.score>,
  "total_raw":   <task2_raw + task3_raw + task4_raw>,
  "total_score": <total_raw>,
  "max_score":   45,
  "overall_feedback": "...",
  "top_mistakes": ["...", "..."],
  "next_recommendation": "..."
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
      shapeOk = (
        result.task2_aufgabe  && typeof result.task2_aufgabe.score  === 'number' &&
        result.task2_koherenz && typeof result.task2_koherenz.score === 'number' &&
        result.task2_sprache  && typeof result.task2_sprache.score  === 'number' &&
        result.task3_aufgabe  && typeof result.task3_aufgabe.score  === 'number' &&
        result.task3_koherenz && typeof result.task3_koherenz.score === 'number' &&
        result.task3_sprache  && typeof result.task3_sprache.score  === 'number' &&
        result.task4_aufgabe  && typeof result.task4_aufgabe.score  === 'number' &&
        result.task4_koherenz && typeof result.task4_koherenz.score === 'number' &&
        result.task4_sprache  && typeof result.task4_sprache.score  === 'number' &&
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

    const fallbackMax = { A1: 12, A2: 25, B1: 45, B2: 40 }[safeLevel];
    console.log(`[/api/exam-grade] Success — level=${safeLevel}, total=${result.total_score}/${result.max_score || fallbackMax}`);
    return res.json(result);

  } catch (err) {
    console.error('[/api/exam-grade] Server error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ✦ DeutschWeg Exam Whisperer API');
  console.log(`  ✦ Running at http://localhost:${PORT}`);
  console.log('  ✦ POST /api/score to score a Schreiben submission');
  console.log('  ✦ POST /api/exam-grade to grade a Schreiben exam');
  console.log('');
});
