const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('Key loaded:', process.env.CLAUDE_API_KEY
  ? 'YES - first 10 chars: ' + process.env.CLAUDE_API_KEY.substring(0, 10)
  : 'NO - KEY MISSING');

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const crypto  = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const dwScoring = require('./scoring-config.js');
const dwTaxonomy = require('./taxonomy.js');

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
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Capture raw body for webhook signature verification (Lemon Squeezy needs
// the original bytes before JSON parsing, not the parsed object).
app.use(express.json({
  verify: function(req, res, buf) {
    if (req.path && req.path.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'DeutschWeg Exam Whisperer API is running' });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEMON SQUEEZY — Payment integration (TEST MODE)
// Config via env vars — never hardcoded:
//   LEMONSQUEEZY_WEBHOOK_SECRET  signing secret from LS dashboard
//   LEMONSQUEEZY_STORE_SLUG      e.g. "deutschweg"
//   LEMONSQUEEZY_VARIANT_A2      variant ID for A2 product
//   LEMONSQUEEZY_VARIANT_B1      variant ID for B1 product
//   LEMONSQUEEZY_VARIANT_B2      variant ID for B2 product
// ═══════════════════════════════════════════════════════════════════════════

const LS_VARIANT_MAP = {
  a2: process.env.LEMONSQUEEZY_VARIANT_A2,
  b1: process.env.LEMONSQUEEZY_VARIANT_B1,
  b2: process.env.LEMONSQUEEZY_VARIANT_B2,
};
const LS_PRODUCT_KEYS = { a2: 'a2_module', b1: 'b1_module', b2: 'b2_module' };

// ── GET /api/checkout-url ────────────────────────────────────────────────────
// Returns a Lemon Squeezy checkout URL for the requested level.
// Keeps variant IDs server-side (never in frontend source).
// Query params: level (a2|b1|b2), userId (Supabase user UUID), successUrl.
app.get('/api/checkout-url', (req, res) => {
  const { level, userId, successUrl } = req.query;
  const variantId = LS_VARIANT_MAP[level];
  if (!variantId) return res.status(400).json({ error: 'Invalid level.' });
  if (!userId)    return res.status(400).json({ error: 'userId is required.' });

  const storeSlug = process.env.LEMONSQUEEZY_STORE_SLUG;
  if (!storeSlug || !variantId) {
    return res.status(500).json({ error: 'Payment not configured on the server.' });
  }

  const productKey = LS_PRODUCT_KEYS[level];
  const params = new URLSearchParams({
    'checkout[custom][user_id]':    userId,
    'checkout[custom][product_key]': productKey,
    'checkout[success_url]': successUrl || `https://deutschweg.de/freischalten-success?level=${level}`,
  });

  const url = `https://${storeSlug}.lemonsqueezy.com/checkout/buy/${variantId}?${params.toString()}`;
  console.log(`[/api/checkout-url] level=${level} user=${userId}`);
  return res.json({ url, productKey, level });
});

// ── POST /api/webhooks/lemonsqueezy ──────────────────────────────────────────
// Verifies the Lemon Squeezy X-Signature header (HMAC-SHA256 of raw body).
// Handles order_created (paid) → grant entitlement.
// Handles order_refunded → revoke entitlement.
// Idempotent: duplicate events for the same order are no-ops.
app.post('/api/webhooks/lemonsqueezy', async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[LS webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured.' });
  }

  // ── 1. Verify signature ───────────────────────────────────────────────────
  const signature = req.headers['x-signature'];
  if (!signature || !req.rawBody) {
    console.warn('[LS webhook] Missing signature or raw body');
    return res.status(400).json({ error: 'Missing signature.' });
  }
  const computed = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');
  const sigBuf  = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  const valid = sigBuf.length === compBuf.length &&
    crypto.timingSafeEqual(sigBuf, compBuf);
  if (!valid) {
    console.warn('[LS webhook] Invalid signature — rejected');
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  const payload    = req.body;
  const eventName  = payload?.meta?.event_name;
  const customData = payload?.meta?.custom_data || {};
  const attrs      = payload?.data?.attributes || {};
  const orderId    = String(payload?.data?.id || '');
  const userId     = customData.user_id;
  const productKey = customData.product_key;

  console.log(`[LS webhook] event=${eventName} orderId=${orderId} user=${userId} product=${productKey}`);

  if (!userId || !productKey) {
    // Event doesn't carry our custom data (e.g. manual test ping) — log & ack
    console.warn('[LS webhook] No user_id/product_key in custom_data — skipping');
    return res.status(200).json({ received: true, action: 'skipped' });
  }

  if (!supabaseAdmin) {
    console.error('[LS webhook] supabaseAdmin not available');
    return res.status(500).json({ error: 'DB not configured.' });
  }

  // ── 3. Handle events ──────────────────────────────────────────────────────
  try {
    if (eventName === 'order_created' && attrs.status === 'paid') {
      // Idempotency: check if we already processed this order
      const { data: existing } = await supabaseAdmin
        .from('entitlements')
        .select('id')
        .eq('user_id', userId)
        .eq('product_key', productKey)
        .maybeSingle();

      if (existing) {
        console.log(`[LS webhook] order_created — entitlement already exists for user=${userId} product=${productKey}, skipping`);
        return res.status(200).json({ received: true, action: 'already_granted' });
      }

      const { error: insErr } = await supabaseAdmin
        .from('entitlements')
        .insert({
          user_id:     userId,
          product_key: productKey,
          source:      'lemonsqueezy',
          order_id:    orderId,
        });

      if (insErr) {
        // Unique constraint violation = race condition, already inserted
        if (insErr.code === '23505') {
          console.log(`[LS webhook] order_created — concurrent insert detected, entitlement exists`);
          return res.status(200).json({ received: true, action: 'already_granted' });
        }
        console.error('[LS webhook] insert error:', insErr.message);
        return res.status(500).json({ error: 'DB write failed.' });
      }

      console.log(`[LS webhook] ✓ GRANTED ${productKey} to user=${userId} order=${orderId}`);
      return res.status(200).json({ received: true, action: 'granted', productKey, userId });
    }

    if (eventName === 'order_refunded') {
      const { error: delErr } = await supabaseAdmin
        .from('entitlements')
        .delete()
        .eq('user_id', userId)
        .eq('product_key', productKey);

      if (delErr) {
        console.error('[LS webhook] delete error:', delErr.message);
        return res.status(500).json({ error: 'DB delete failed.' });
      }

      console.log(`[LS webhook] ✓ REVOKED ${productKey} from user=${userId} order=${orderId}`);
      return res.status(200).json({ received: true, action: 'revoked', productKey, userId });
    }

    // Unhandled event — ack so Lemon Squeezy doesn't retry
    console.log(`[LS webhook] unhandled event=${eventName} — acked`);
    return res.status(200).json({ received: true, action: 'unhandled_event' });

  } catch (err) {
    console.error('[LS webhook] server error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
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
  // Pass score is derived from scoring-config.js's canonical 60% threshold
  // (previously hardcoded here as 30/40 = 75%, which silently disagreed
  // with this same page's frontend, which displayed pass at 60% — see
  // scoring-reconciliation-plan.md). Never hardcode a second copy of this
  // number — read it from dwScoring so the two can't drift apart again.
  const WHISPERER_MAX = 40;
  const WHISPERER_PASS_SCORE = Math.ceil(WHISPERER_MAX * dwScoring.PASS_THRESHOLD_PCT / 100);
  const prompt = `You are a strict official Goethe Institut examiner scoring a ${level} Schreiben submission. Apply the official rubric exactly as a real examiner would — do not be lenient.

OFFICIAL RUBRIC (${WHISPERER_MAX} points total, passing = ${WHISPERER_PASS_SCORE}/${WHISPERER_MAX}):
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

EXAMPLES IN CORRECTIONS — always use diverse international learner names and contexts:
Use names like: Kwame, Amina, Kofi, Fatima, Priya, Dilan, Rajesh, Zara, Chidi
Use places like: Nairobi, Lagos, Mumbai, Colombo, Accra — NEVER use Hans, Müller, München, Frankfurt

Keep every "fix" explanation under 20 words. Explain WHY points were lost, not just what was wrong.

Also compute:
- points_to_pass: how many more points the student needs to reach ${WHISPERER_PASS_SCORE} (0 if they already passed)
- passed: true if total >= ${WHISPERER_PASS_SCORE}, false otherwise

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
  "corrected_version": "The full rewritten letter with ALL errors fixed, preserving student ideas, using diverse international learner names (Kwame, Priya, Amina, Dilan) in examples, formatted as a proper German letter with salutation and sign-off"
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
    // Backfill reads the same canonical threshold as the prompt above and
    // as exam-whisperer.html's frontend — never a hardcoded second copy.
    if (typeof result.passed !== 'boolean') {
      result.passed = dwScoring.passed(result.total, WHISPERER_MAX);
    }
    if (typeof result.points_to_pass !== 'number') {
      result.points_to_pass = dwScoring.pointsToPass(result.total, WHISPERER_MAX);
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
    prompt = `You are a Goethe A1 Sprechen examiner evaluating a Goethe A1 candidate's self-introduction answer.

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

IMPORTANT: Always use diverse international learner names in the model answer — Kwame, Amina, Priya, Dilan, Kofi, Fatima. Never use Hans or European names. Cities: Nairobi, Lagos, Mumbai, Colombo, Accra.

Respond with a single raw JSON object, no markdown:
{
  "score": 7,
  "summary": "One sentence summary of how well they answered",
  "feedback": "2-3 sentences explaining what was good and what needs improvement, with specific grammar notes",
  "grammar": "Specific grammar point to remember — if no errors, confirm what they did well",
  "modelAnswer": "A complete model answer in German using an international learner name/context, then a line break and the English translation in brackets"
}`;

  } else if (part === 2) {
    const { keyword, hint } = req.body;
    prompt = `You are a Goethe A1 Sprechen examiner evaluating a Goethe A1 candidate's question formed from a keyword card.

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

IMPORTANT: Model answer must use diverse international learner names — Kwame, Amina, Priya, Dilan, Kofi, Fatima. Never Hans or München.

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
    prompt = `You are a Goethe A1 Sprechen examiner evaluating a Goethe A1 candidate's response to a situation card.

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

IMPORTANT: Model answer must use diverse international learner names — Kwame, Amina, Priya, Dilan, Kofi, Fatima. Never Hans or München.

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

  const systemPrompt = `You are DeutschWeg AI Tutor — a friendly, encouraging German language coach helping learners prepare for the Goethe exam and life in Germany.

The student is currently on Module ${safemod}. Language mix rule: ${langRule}

YOUR RULES:
1. Use diverse international learner names in examples — Kwame, Amina, Priya, Dilan, Rajesh, Kofi, Fatima, Zara. NEVER use Hans, Müller, München, or European-centric examples.
2. Keep answers SHORT — maximum 4 sentences. Never write an essay.
3. Always end with exactly one example sentence in German relevant to the student's question.
4. Be warm and encouraging — phrases like "Great question!", "You're getting it!", "This trips everyone up at first!" — never make the student feel stupid.
5. If the student asks something unrelated to German learning, gently redirect: "That's outside my expertise, but let's focus on your German — you've got an exam to pass!"
6. Your students are preparing to move to Germany for work, study, or family. Use contexts that reflect those stakes: job applications, Bürgeramt visits, flat searches, public transport, daily errands.
7. When correcting an error, always show the wrong version and the right version clearly.
8. Format: plain text only — no markdown, no asterisks, no bullet symbols. Use line breaks to separate thoughts.
9. Module context: Module ${safemod} covers ${moduleContext(safemod)}.

Remember: short, warm, practical-Germany-context, one German example at the end.`;

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

function buildAipalWeakSpotsBlock(userTopErrors) {
  if (!Array.isArray(userTopErrors) || userTopErrors.length === 0) return '';
  const lines = userTopErrors
    .filter(e => e && dwTaxonomy.get(e.category) && Number(e.count) > 0)
    .slice(0, 3)
    .map((e, i) => `${i + 1}. ${dwTaxonomy.longLabel(e.category)} — ${e.count}x`);
  if (lines.length === 0) return '';
  return `

STUDENT'S RECURRING WEAK SPOTS (from past sessions):
${lines.join('\n')}

When one of these patterns surfaces in this conversation, prefer Template 4 (⚠️ Same pattern again) and reinforce the fix concretely. Don't lecture about it pre-emptively — only react when it actually shows up.`;
}

function buildAipalPrompt(level, moduleName) {
  return `You are AI Pal, a friendly lesson companion for learners preparing for the Goethe exam and moving to Germany. The student's level is ${level}. They are currently studying: ${moduleName}.

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
- Use diverse international learner names: Kwame, Amina, Priya, Dilan, Kofi, Fatima, Rajesh
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

const AIPAL_WELCOME_PROMPT = `You are AI Pal on DeutschWeg, a warm and encouraging German learning companion for learners preparing to move to Germany.

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

  return `You are AI Pal on DeutschWeg, a warm encouraging German learning companion for learners preparing to move to Germany. You speak FIRST, before the lesson — like a big sister, never a teacher.

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
    ? `\n- This is lesson ${num} (divisible by 3): in WHY IT MATTERS, add a short cultural mirror connecting German daily life to the learner's own country or context so it feels familiar, not foreign.`
    : '';
  return `You are AI Pal on DeutschWeg, generating a lesson completion popup for a learner who is preparing to move to Germany and just finished a German lesson.

Context:
- Lesson just completed: "${ctx.lesson_title || 'this lesson'}"
- Lesson number: ${num}
- Vocabulary learned in this lesson: ${vocab.length ? vocab.join(', ') : '(general content)'}

Generate three short sections:
1. learned        — one simple sentence naming the exact skill in plain English
2. matters        — one sentence describing a specific real-life moment this skill prepares them for in Germany (visa, job, flat, daily life); make it feel real and close${mirror}
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
  return `You are AI Pal on DeutschWeg, a warm big-sister German companion for learners building their future in Germany. The learner just hit a MAJOR milestone — celebrate loudly, this is a genuine event (bigger energy than a normal lesson message).

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
  return `You are a patient, structured German teacher helping learners prepare for the Goethe exam and move to Germany. The student's level is ${level}.

Your role: explain clearly when asked. You are a full teacher.

When explaining grammar:
1. Give the rule clearly
2. Show the structure
3. Give 2-3 examples using diverse international learner names (Kwame, Amina, Priya, Dilan, Kofi, Rajesh)
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

const DICTIONARY_SYSTEM_PROMPT = `You are a dictionary entry generator for DeutschWeg, a German learning platform for international learners preparing for life in Germany and Goethe exams A1-B2.

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
  "kultur": "how Germans actually use this word in daily life, cultural notes relevant to international learners moving to Germany",
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
- Bedeutung explains German usage and context, never defines something the learner already knows in English
- Beispielsätze must be real sentences the learner will actually use in Germany (job, visa, flat, daily life)
- Kultur notes must be specific and practical for someone moving to Germany
- Fehler must include the most common mistake international English speakers make with this word
- Merkhilfe must be clever and memorable
- English translations in Beispielsätze must be natural English — never literal translations
- Never say "I want..." — say "I would like..." in English translations
- Return only valid JSON, no markdown, no explanation`;

// Strip a leading der/die/das and lowercase so "das Haus", "Haus", "haus",
// and "HAUS" all resolve to the same cache entry. Lowercase also lets
// Postgres use the expression index lower(word) to speed up the ilike lookup.
function normalizeDictWord(raw) {
  return String(raw || '').trim().replace(/^(der|die|das)\s+/i, '').trim().toLowerCase();
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
// SPRECHEN — Goethe A1 speaking simulator (topics + caps + feedback; the live
// voice session is the WebSocket server attached at the bottom of this file).
// Two independent caps gate free A1 usage: a lifetime session-COUNT cap
// (sprechen_session_caps) and a daily session-DURATION cap (sprechen_daily_usage,
// 10 min/day, resets at UTC midnight).
// ═══════════════════════════════════════════════════════════════════════════

// ── Identity verification (WS + HTTP, standalone + Complete Mock Exam) ─────
// The server never trusts a client-supplied user_id as proof of identity —
// every entry point below verifies a real Supabase access token and derives
// the caller's id from it instead. Never logs the token itself.
async function verifySupabaseToken(accessToken) {
  if (!supabaseAdmin || !accessToken || typeof accessToken !== 'string') {
    return { userId: null, error: 'missing_token' };
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data || !data.user) return { userId: null, error: 'invalid_token' };
    return { userId: data.user.id, error: null };
  } catch (err) {
    console.error('[auth] token verification failed:', err.message);
    return { userId: null, error: 'invalid_token' };
  }
}

// Express middleware for the HTTP Sprechen endpoints — verifies
// `Authorization: Bearer <token>`, sets req.verifiedUserId, 401s otherwise.
// Request-body user_id is never consulted for identity.
async function requireSprechenAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.indexOf('Bearer ') === 0 ? header.slice(7).trim() : null;
  const result = await verifySupabaseToken(token);
  if (!result.userId) return res.status(401).json({ error: 'Please sign in again.' });
  req.verifiedUserId = result.userId;
  next();
}

// ── Sprechen conversation-validity model ────────────────────────────────────
// A single canonical definition of "did a real, gradable conversation
// happen," used both live (finalize() has the in-memory {role,text} array
// already) and retrospectively against a stored session row (by
// reconstructing role-tagged entries from the flattened transcript string —
// no separate structured-transcript column needed).
const SPRECHEN_END_REASONS = ['client_end', 'timeout', 'upstream_closed', 'ws_error', 'ws_closed'];
const SPRECHEN_TECHNICAL_END_REASONS = ['upstream_closed', 'ws_error'];

function parseStoredSprechenTranscript(stored) {
  if (!stored) return [];
  const exPrefix = 'Examiner (Prüfer): ';
  const caPrefix = 'Candidate (Kandidat): ';
  return String(stored).split('\n').filter(Boolean).map(function (line) {
    if (line.indexOf(exPrefix) === 0) return { role: 'examiner', text: line.slice(exPrefix.length) };
    if (line.indexOf(caPrefix) === 0) return { role: 'candidate', text: line.slice(caPrefix.length) };
    return null;
  }).filter(Boolean);
}

// Five named dimensions (reviewed): (1) learner turn count, (2) learner
// speech amount, (3) progressed beyond startup — a candidate turn occurring
// after the examiner's 2nd turn, not just an answer to the opener before
// the connection died, (4) eligible end reason, (5) duration floor, paired
// with the caller having already confirmed persistence succeeded.
function isValidSprechenConversation(entries, durationSeconds, endReason) {
  if (SPRECHEN_END_REASONS.indexOf(endReason) === -1) return false;
  const candidateEntries = entries.filter(function (e) { return e.role === 'candidate'; });
  const candidateWords = candidateEntries.map(function (e) { return e.text; }).join(' ').trim()
    .split(/\s+/).filter(Boolean).length;
  let examinerSeen = 0, progressedBeyondStartup = false;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.role === 'examiner') examinerSeen++;
    else if (e.role === 'candidate' && examinerSeen >= 2) { progressedBeyondStartup = true; break; }
  }
  return candidateEntries.length >= 4
    && candidateWords >= 20
    && progressedBeyondStartup
    && typeof durationSeconds === 'number' && durationSeconds >= 60;
}

// State derivation for a STORED sprechen_sessions row — used to decide
// restart eligibility before a new live session is allowed to start.
// Never relies on completed=false alone (feedback_attempts distinguishes
// "not yet tried" from "tried and failed").
function deriveSprechenSessionState(session) {
  if (session.completed) return 'completed';
  if (!session.end_reason) return 'live';
  const entries = parseStoredSprechenTranscript(session.transcript);
  const valid = isValidSprechenConversation(entries, session.duration_seconds, session.end_reason);
  if (!valid) {
    return SPRECHEN_TECHNICAL_END_REASONS.indexOf(session.end_reason) !== -1 ? 'technical_failure' : 'abandoned';
  }
  return (session.feedback_attempts || 0) > 0 ? 'feedback_failed' : 'submitted_feedback_pending';
}

// Shared feedback-generation + persistence — used by both the live WS
// finalize() path and the HTTP retry endpoint below, so a failed evaluation
// can be retried without opening another live voice session.
async function attemptSprechenFeedbackGeneration(sessionId, transcript, language) {
  if (supabaseAdmin && sessionId) {
    const { data: cur } = await supabaseAdmin.from('sprechen_sessions')
      .select('feedback_attempts').eq('id', sessionId).maybeSingle();
    const attempts = (cur && cur.feedback_attempts) || 0;
    await supabaseAdmin.from('sprechen_sessions').update({ feedback_attempts: attempts + 1 }).eq('id', sessionId);
  }
  try {
    const fb = await generateSprechenFeedback(transcript, language);
    if (fb && supabaseAdmin && sessionId) {
      await supabaseAdmin.from('sprechen_sessions').update({
        feedback: fb, feedback_language: language,
        score_overall: fb.score_overall, score_aussprache: fb.score_aussprache,
        score_kommunikation: fb.score_kommunikation, score_grammatik: fb.score_grammatik,
        score_wortschatz: fb.score_wortschatz, completed: true,
      }).eq('id', sessionId);
    }
    return { ok: Boolean(fb), feedback: fb };
  } catch (err) {
    console.error('[sprechen] feedback generation failed:', err.message);
    return { ok: false, feedback: null };
  }
}

// Server-side gate for starting (or restarting) a Complete Mock Exam
// Sprechen session — never trusts the client's claim that an attempt id is
// theirs or that a restart is warranted. verifiedUserId always comes from
// verifySupabaseToken(), never from client-supplied input.
async function validateMockExamSprechenAccess(verifiedUserId, mockExamAttemptId) {
  if (!supabaseAdmin) return { allowed: false, reason: 'server_not_configured' };

  const { data: attempt, error: attemptErr } = await supabaseAdmin
    .from('mock_exam_attempts').select('*').eq('id', mockExamAttemptId).maybeSingle();
  if (attemptErr || !attempt) return { allowed: false, reason: 'invalid_attempt' };
  if (attempt.user_id !== verifiedUserId) return { allowed: false, reason: 'not_owner' };
  if (attempt.completed_at) return { allowed: false, reason: 'attempt_already_complete' };
  if (attempt.current_section !== 'sprechen') return { allowed: false, reason: 'wrong_section' };
  if (attempt.sprechen_session_id) return { allowed: false, reason: 'already_accepted' };

  const { data: sessions, error: sessErr } = await supabaseAdmin
    .from('sprechen_sessions').select('*').eq('mock_exam_attempt_id', mockExamAttemptId)
    .order('session_date', { ascending: false });
  if (sessErr) return { allowed: false, reason: 'lookup_failed' };

  const latest = sessions && sessions[0];
  if (!latest) return { allowed: true, isRestart: false };

  const state = deriveSprechenSessionState(latest);
  if (state === 'live') return { allowed: false, reason: 'session_already_active' };
  if (state === 'technical_failure') {
    if (attempt.sprechen_restart_used) return { allowed: false, reason: 'restart_already_used' };
    // Atomic compare-and-set — closes the race between two concurrent
    // restart attempts both reading sprechen_restart_used=false.
    const { data: claimed } = await supabaseAdmin.from('mock_exam_attempts')
      .update({ sprechen_restart_used: true })
      .eq('id', mockExamAttemptId).eq('sprechen_restart_used', false)
      .select('id').maybeSingle();
    if (!claimed) return { allowed: false, reason: 'restart_already_used' };
    return { allowed: true, isRestart: true };
  }
  if (state === 'abandoned') return { allowed: false, reason: 'abandoned_no_restart' };
  // submitted_feedback_pending / feedback_failed / completed: a valid
  // conversation already exists for this attempt — never open a new live
  // session for these; the client should be using the feedback-retry
  // endpoint instead, not starting another voice session.
  return { allowed: false, reason: 'valid_session_exists' };
}

const SPRECHEN_LANGS = { english: 'English', arabic: 'Arabic', french: 'French', portuguese: 'Portuguese' };
function sprechenLang(v) { return SPRECHEN_LANGS[String(v || '').toLowerCase()] ? String(v).toLowerCase() : 'english'; }

const SPRECHEN_TOPIC_SYSTEM_PROMPT = `You are generating Goethe A1 Sprechen exam topics for international learners preparing for the German exam.

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
- Topics must be relevant to international learners preparing to move to Germany (work, study, family, visa)
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

// ── Reviewed A1 Sprechen topic fallback ─────────────────────────────────
// Root cause of the intermittent 502s (confirmed by direct reproduction,
// 2026-07-14): at max_tokens:1600, the 4-language x 3-part JSON output
// regularly hits the token ceiling mid-string (stop_reason: "max_tokens"),
// producing truncated/unparseable JSON — successful generations already
// use 1249-1373 tokens, leaving almost no margin. Not a timeout, not a
// markdown-fence issue, not a network problem — parseJsonLoose() and the
// shape check were correctly rejecting genuinely broken output the whole
// time. Fix: retry once with a larger budget + an explicit brevity
// instruction, then fall back to this hand-reviewed, genuinely A1-level
// topic set so a learner is never blocked by a generation hiccup.
const SPRECHEN_TOPIC_FALLBACK = {
  part1: {
    topic: 'Stellen Sie sich vor — sagen Sie Ihren Namen, wie alt Sie sind, woher Sie kommen, wo Sie wohnen, was Sie arbeiten oder lernen, und was Ihre Hobbys sind.',
    instructions_english: 'Introduce yourself. Talk about your name, age, where you come from, where you live, your job or studies, and your hobbies.',
    instructions_arabic: 'قدّم نفسك. تحدث عن اسمك، عمرك، من أين أنت، أين تسكن، عملك أو دراستك، وهواياتك.',
    instructions_french: "Présentez-vous. Parlez de votre nom, âge, d'où vous venez, où vous habitez, votre travail ou vos études, et vos loisirs.",
    instructions_portuguese: 'Apresente-se. Fale sobre seu nome, idade, de onde você vem, onde mora, seu trabalho ou estudos, e seus hobbies.',
  },
  part2: {
    topic: 'Beschreiben Sie das Bild — Sie sehen eine Szene in einem Supermarkt. Was sehen Sie? Wer ist da? Was passiert?',
    image_description: 'A busy supermarket scene: a woman pushing a shopping cart, a man checking items on a shelf, a cashier at the checkout counter, and price signs on the shelves.',
    instructions_english: 'Look at the picture and describe what you see. Where are the people? What are they doing?',
    instructions_arabic: 'انظر إلى الصورة وصف ما تراه. أين الناس؟ ماذا يفعلون؟',
    instructions_french: "Regardez l'image et décrivez ce que vous voyez. Où sont les personnes ? Que font-elles ?",
    instructions_portuguese: 'Olhe para a imagem e descreva o que você vê. Onde estão as pessoas? O que elas estão fazendo?',
  },
  part3: {
    topic: 'Sie möchten zusammen ein Geburtstagsessen planen. Wo möchten Sie essen — zu Hause oder im Restaurant? Was gibt es zu essen und zu trinken? Um wie viel Uhr treffen Sie sich?',
    instructions_english: 'Plan a birthday dinner together with the examiner. Decide where to eat, what food and drinks to have, and what time to meet.',
    instructions_arabic: 'خطط لعشاء عيد ميلاد مع الممتحن. قرّرا أين ستأكلان، وما هو الطعام والشراب، وفي أي وقت ستلتقيان.',
    instructions_french: "Planifiez ensemble un dîner d'anniversaire avec l'examinateur. Décidez où manger, quels plats et boissons choisir, et à quelle heure vous retrouver.",
    instructions_portuguese: 'Planeje um jantar de aniversário junto com o examinador. Decidam onde comer, quais comidas e bebidas ter, e que horas se encontrar.',
  },
};

function sprechenTopicsValid(topics) {
  if (!topics || typeof topics !== 'object') return false;
  return ['part1', 'part2', 'part3'].every((key) => {
    const p = topics[key];
    return p && typeof p === 'object' && typeof p.topic === 'string' && p.topic.trim().length > 0;
  });
}

// Sanitized classification only — never logs the raw model text or the
// upstream error body, so logs stay useful without leaking provider
// response content.
function classifySprechenTopicFailure(err, topics) {
  if (err) return 'request_error';
  if (!topics) return 'unparseable_or_missing';
  if (!sprechenTopicsValid(topics)) return 'incomplete_shape';
  return 'unknown';
}

async function generateSprechenTopicsWithFallback() {
  let topics = null, failure1 = null;
  try {
    topics = await callClaudeJSON(SPRECHEN_TOPIC_SYSTEM_PROMPT, 'Generate the 3 A1 Sprechen topics now.', 1600);
  } catch (err) { failure1 = classifySprechenTopicFailure(err, null); }
  if (sprechenTopicsValid(topics)) return { topics, source: 'generated' };
  if (!failure1) failure1 = classifySprechenTopicFailure(null, topics);

  console.log(`[/api/sprechen/topics] attempt 1 failed (${failure1}) — retrying once with a larger budget`);
  let failure2 = null;
  try {
    topics = await callClaudeJSON(
      SPRECHEN_TOPIC_SYSTEM_PROMPT,
      'Generate the 3 A1 Sprechen topics now. Return ONLY the JSON object — no markdown fences, no commentary before or after. Keep every field concise so the full response fits comfortably within the token budget.',
      2400
    );
  } catch (err) { failure2 = classifySprechenTopicFailure(err, null); }
  if (sprechenTopicsValid(topics)) return { topics, source: 'generated_retry' };
  if (!failure2) failure2 = classifySprechenTopicFailure(null, topics);

  console.error(`[/api/sprechen/topics] both attempts failed (attempt1=${failure1}, attempt2=${failure2}) — serving reviewed fallback topic`);
  return { topics: SPRECHEN_TOPIC_FALLBACK, source: 'fallback' };
}

// ── Part 2: POST /api/sprechen/topics/generate ─────────────────────────────
app.post('/api/sprechen/topics/generate', async (req, res) => {
  const level = (req.body && req.body.level) || 'A1';
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  console.log(`[/api/sprechen/topics] generate level=${level}`);
  try {
    const { topics, source } = await generateSprechenTopicsWithFallback();
    // Persist (best-effort) — one row per part. Skipped for the fallback,
    // since it's static reviewed content, not a new generation worth
    // logging into the topics pool.
    if (supabaseAdmin && source !== 'fallback') {
      const rows = [
        { level, part: 1, topic_text: topics.part1.topic || '', instructions: topics.part1 },
        { level, part: 2, topic_text: topics.part2.topic || '', example_image_url: null, instructions: topics.part2 },
        { level, part: 3, topic_text: topics.part3.topic || '', instructions: topics.part3 },
      ];
      supabaseAdmin.from('sprechen_topics').insert(rows).then(function(){}, function(){});
    }
    // `source` is diagnostic only (generated / generated_retry / fallback)
    // — the client already ignores unknown fields, never used to gate
    // anything learner-facing.
    return res.json({ level, topics, source });
  } catch (err) {
    // Never leak raw provider/internal error text to the client.
    console.error('[/api/sprechen/topics] unexpected error:', err.message);
    return res.status(502).json({ error: 'Could not generate topics.' });
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

// :userId in the URL is kept only for backward-compatible route shape — it
// carries zero authorization value and is never read. Identity comes
// exclusively from the verified bearer token (requireSprechenAuth).
app.get('/api/sprechen/cap/:userId/:level', requireSprechenAuth, async (req, res) => {
  try {
    const out = await sprechenGetCap(req.verifiedUserId, req.params.level || 'A1');
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

// ── Daily minute cap (free A1 tier only) ────────────────────────────────────
// Separate from the lifetime session-COUNT cap above: this caps cumulative
// session DURATION per calendar day and resets every day. Calendar day is
// the server's UTC date (v1 — no per-user timezone).
const SPRECHEN_DAILY_CAP_SECONDS = 10 * 60;
const SPRECHEN_DAILY_WARNING_LEAD_SECONDS = 60;
const SPRECHEN_DAILY_CAP_MESSAGE = "You've used your free Sprechen practice for today — come back tomorrow!";

function sprechenTodayUTC() { return new Date().toISOString().slice(0, 10); }

async function sprechenGetDailyUsage(userId) {
  if (!supabaseAdmin) return { usedSeconds: 0, remainingSeconds: SPRECHEN_DAILY_CAP_SECONDS };
  const { data } = await supabaseAdmin
    .from('sprechen_daily_usage').select('seconds_used')
    .eq('user_id', userId).eq('usage_date', sprechenTodayUTC()).maybeSingle();
  const used = data ? (data.seconds_used || 0) : 0;
  return { usedSeconds: used, remainingSeconds: Math.max(0, SPRECHEN_DAILY_CAP_SECONDS - used) };
}

// Add elapsed seconds to today's row (best-effort read-then-upsert).
async function sprechenAddDailyUsage(userId, addSeconds) {
  if (!supabaseAdmin || !userId || !addSeconds) return;
  const date = sprechenTodayUTC();
  const { data } = await supabaseAdmin
    .from('sprechen_daily_usage').select('seconds_used')
    .eq('user_id', userId).eq('usage_date', date).maybeSingle();
  const used = data ? (data.seconds_used || 0) : 0;
  await supabaseAdmin.from('sprechen_daily_usage').upsert({
    user_id: userId, usage_date: date, seconds_used: used + Math.round(addSeconds),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,usage_date' });
}

// :userId in the URL is kept only for backward-compatible route shape — it
// carries zero authorization value and is never read. Identity comes
// exclusively from the verified bearer token (requireSprechenAuth).
app.get('/api/sprechen/daily-usage/:userId', requireSprechenAuth, async (req, res) => {
  try {
    const out = await sprechenGetDailyUsage(req.verifiedUserId);
    return res.json({
      used_seconds: out.usedSeconds, remaining_seconds: out.remainingSeconds,
      cap_seconds: SPRECHEN_DAILY_CAP_SECONDS, allowed: out.remainingSeconds > 0,
      message: out.remainingSeconds > 0 ? null : SPRECHEN_DAILY_CAP_MESSAGE,
    });
  } catch (err) {
    console.error('[/api/sprechen/daily-usage] error:', err.message);
    return res.status(500).json({ error: 'Could not check daily usage.' });
  }
});

// ── Part 5: post-session feedback (shared builder + endpoint) ───────────────
function buildSprechenFeedbackPrompt(language) {
  const langName = SPRECHEN_LANGS[language] || 'English';
  return `You are a Goethe A1 exam feedback specialist for international learners preparing for life in Germany.

Analyze this Sprechen session transcript and generate structured feedback.

The candidate is preparing for life in Germany (work, study, or family)
and the Goethe A1 exam.

Generate ALL feedback in ${langName}.

Score each area 1-5:
- Aussprache (pronunciation) — this is a separate acoustic-quality score, do NOT tag it against the taxonomy below, it stays exactly as-is
- Kommunikation (did they get the message across?)
- Grammatik (grammar accuracy)
- Wortschatz (vocabulary range)
- Overall score

Feedback structure (unchanged, keep this prose exactly as it already is — the structured tagging below is ADDED alongside it, not a replacement):
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

${EXAM_GRADE_TAGGING_RULE}
For Sprechen, also apply this rule to register_mismatch/text_conventions_structure: since there is no fixed written text-type here, only flag register_mismatch if the candidate used the wrong Sie/du form for an examiner context, and text_conventions_structure rarely applies (spoken answers don't have salutations/paragraphs) — leave it out unless something structurally analogous is clearly missing (e.g. no self-introduction at all when asked to introduce themselves).

In ADDITION to the 5 prose fields above (unchanged), also return a "tagged_errors" array: one entry per distinct error you noticed in the transcript (reuse the same specific errors you already reference in "areas_to_improve" — don't invent new ones), each with the taxonomy category key and the exact transcript fragment. Empty array if no clear errors surfaced.

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
  "encouragement": "",
  "tagged_errors": [
    { "category": "verb_conjugation", "fragment": "exact words from the transcript", "note": "one short clause explaining the error" }
  ]
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
  // Sanitize tagged_errors: drop anything that isn't a real taxonomy key
  // (defensive against the model inventing a category) and cap length.
  fb.tagged_errors = (Array.isArray(fb.tagged_errors) ? fb.tagged_errors : [])
    .filter(e => e && dwTaxonomy.get(e.category))
    .slice(0, 6)
    .map(e => ({
      category: e.category,
      fragment: (typeof e.fragment === 'string') ? e.fragment.slice(0, 200) : '',
      note:     (typeof e.note === 'string')     ? e.note.slice(0, 300)     : ''
    }));
  return fb;
}

// Requires Authorization: Bearer <token> — identity is never taken from the
// request body. If a session_id is supplied, ownership is verified against
// the stored row before anything is generated or written.
app.post('/api/sprechen/feedback', requireSprechenAuth, async (req, res) => {
  const { transcript, session_id, preferred_language } = req.body || {};
  const language = sprechenLang(preferred_language);
  if (!transcript || String(transcript).trim().length < 10) {
    return res.status(400).json({ error: 'Transcript too short for feedback.' });
  }
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });

  if (session_id) {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
    const { data: session, error: lookupErr } = await supabaseAdmin
      .from('sprechen_sessions').select('user_id').eq('id', session_id).maybeSingle();
    if (lookupErr || !session || session.user_id !== req.verifiedUserId) {
      return res.status(403).json({ error: 'Not your session.' });
    }
  }

  try {
    const fb = await generateSprechenFeedback(transcript, language);
    if (!fb) return res.status(502).json({ error: 'Could not generate feedback.' });
    if (supabaseAdmin && session_id) {
      await supabaseAdmin.from('sprechen_sessions').update({
        feedback: fb, feedback_language: language,
        score_overall: fb.score_overall, score_aussprache: fb.score_aussprache,
        score_kommunikation: fb.score_kommunikation, score_grammatik: fb.score_grammatik,
        score_wortschatz: fb.score_wortschatz, completed: true,
      }).eq('id', session_id);
    }
    return res.json(fb);
  } catch (err) {
    console.error('[/api/sprechen/feedback] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// Retries feedback generation for an already-ended, already-valid session
// without opening a new live voice session. Transcript is loaded server-side
// from the stored row — never trusted from the request body. Idempotent:
// if feedback already succeeded, returns it rather than re-grading.
app.post('/api/sprechen/feedback/retry', requireSprechenAuth, async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required.' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server not configured.' });
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });

  const { data: session, error: lookupErr } = await supabaseAdmin
    .from('sprechen_sessions')
    .select('id, user_id, transcript, feedback_language, completed, feedback')
    .eq('id', session_id).maybeSingle();
  if (lookupErr || !session || session.user_id !== req.verifiedUserId) {
    return res.status(403).json({ error: 'Not your session.' });
  }
  if (session.completed && session.feedback) {
    return res.json(session.feedback); // already succeeded — idempotent, no re-grade
  }
  if (!session.transcript || String(session.transcript).trim().length < 20) {
    return res.status(400).json({ error: 'Nothing to grade for this session.' });
  }

  const result = await attemptSprechenFeedbackGeneration(session.id, session.transcript, session.feedback_language || 'english');
  if (result.ok) return res.json(result.feedback);
  return res.status(202).json({ status: 'feedback_pending', message: 'Feedback generation failed again — you can retry.' });
});

// ═══════════════════════════════════════════════════════════════════════════
// HÖRVERSTEHEN — Goethe A1 listening simulator. Claude writes a fresh German
// script + questions; ElevenLabs renders it to audio (female voices; two for
// conversations); audio is stored in Supabase Storage; exercises are cached
// (max 5 per type) and rotated.
// ═══════════════════════════════════════════════════════════════════════════

const HOEREN_TYPES   = ['announcement', 'conversation', 'voicemail'];
// Bumped from 5 -> 6: A1 Hören restructure (hoeren-a1-restructure-plan.md)
// targets a 6-item pool for conversation (Teil 1, official item count) so
// the next "Generate new" on the standalone practice page doesn't silently
// prune the pool back down below that target.
const HOEREN_KEEP    = 6;            // cached exercises kept per type
const HOEREN_BUCKET  = 'hoerverstehen-audio';
// Female voices (configurable). A = single-speaker (announcements/voicemail)
// and Speaker 1 in conversations; B = Speaker 2 in conversations.
const HOEREN_VOICE_A = process.env.HOEREN_VOICE_A || process.env.ELEVENLABS_VOICE_ID || 'rKiu7lQ4c5P3az3745s3';
const HOEREN_VOICE_B = process.env.HOEREN_VOICE_B || 'EXAVITQu4vr4xnSDxMaL';

// `avoid` — optional array of short scenario descriptions already in use
// for this type (both kept and replaced items), so a targeted regeneration
// doesn't just reword the same premise. Not used by the live generate/
// practice endpoints' default callers; only passed explicitly when needed.
function buildHoerenPrompt(type, avoid) {
  const avoidBlock = (Array.isArray(avoid) && avoid.length)
    ? `\n\nSTRICT — do not reuse these scenarios, settings, or premises (already in use for this exercise type):\n` +
      avoid.map((a) => `- ${a}`).join('\n') +
      `\nGenerate a genuinely different situation: different setting, different reason for the conversation/call, different names. ` +
      `Do not just reword one of the above with a different symptom, time, or café name — the underlying premise must be new.`
    : '';
  const qFormat = {
    announcement: '- Use 3-4 true_false questions. Each: type "true_false", options ["Richtig","Falsch"], correct_answer exactly "Richtig" or "Falsch".',
    conversation: '- Use 3 multiple_choice questions. Each: type "multiple_choice", options = 3 short German answers, correct_answer = the exact text of the correct option.\n- Label the two speakers exactly as "Speaker 1:" and "Speaker 2:" at the start of each line. Both speakers are women.',
    // Was "fill_in" — corrected per hoeren-a1-restructure-plan.md: the real
    // Goethe A1 Teil 3 (monologue) is multiple-choice a/b/c, not fill-in.
    // Functionally identical rendering/scoring to fill_in in this codebase
    // (both already carry a 3-option array), so this is a label/semantics
    // fix, not a UI change.
    voicemail:    '- Use 3 multiple_choice questions (about a detail: name, time, place, or phone number). Each: type "multiple_choice", options = 3 short choices, correct_answer = the exact text of the correct option.',
  }[type];
  return `You are generating Goethe A1 Hörverstehen listening exercise scripts for international learners preparing for the German exam.

Exercise type: ${type} (announcement / conversation / voicemail)

Rules:
- Use only genuine A1 level German — simple vocabulary, short sentences
- Content must reflect real life situations in Germany
- Announcements: train station, supermarket, doctor, airport scenarios
- Conversations: everyday topics — shopping, appointments, introductions, directions
- Voicemails: leaving a message with name, time, place or phone number
- Audio script maximum 60 seconds when spoken
- Never use vocabulary above A1 level
- Make it feel authentic — like something the learner will actually hear in Germany
${qFormat}
- Every correct_answer MUST exactly match one of that question's options.
- Questions must be answerable from the audio script alone.${avoidBlock}

Return valid JSON only:
{
  "exercise_type": "${type}",
  "scenario": "",
  "audio_script": "",
  "speaker_instructions": "",
  "questions": [
    { "question_text": "", "type": "", "options": [], "correct_answer": "", "explanation": "" }
  ]
}`;
}

// ElevenLabs TTS → mp3 Buffer (same model/settings as /api/tts).
async function hoerenTTS(text, voiceId) {
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
    {
      method:  'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text, model_id: modelId, language_code: 'de',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!r.ok) { const e = await r.text().catch(() => ''); throw new Error('ElevenLabs ' + r.status + ' ' + e.slice(0, 160)); }
  return await r.buffer();
}

// Split a conversation script into [{voice,text}] by "Speaker 1/2:" labels.
function hoerenConversationSegments(script) {
  const segs = [];
  let voice = HOEREN_VOICE_A, buf = [];
  const flush = () => { const t = buf.join(' ').trim(); if (t) segs.push({ voice, text: t }); buf = []; };
  String(script || '').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*(?:Speaker|Sprecher(?:in)?|Person)\s*([12AB])\s*[:\-]\s*(.*)$/i);
    if (m) {
      flush();
      const who = m[1].toUpperCase();
      voice = (who === '2' || who === 'B') ? HOEREN_VOICE_B : HOEREN_VOICE_A;
      if (m[2]) buf.push(m[2]);
    } else if (line.trim()) {
      buf.push(line.trim());
    }
  });
  flush();
  return segs;
}

function hoerenStripLabels(script) {
  return String(script || '').split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:Speaker|Sprecher(?:in)?|Person)\s*[12AB]\s*[:\-]\s*/i, '').trim())
    .filter(Boolean).join(' ');
}

// Render the script to a single mp3 Buffer (two voices for conversations).
async function hoerenSynthesize(type, script) {
  if (type === 'conversation') {
    const segs = hoerenConversationSegments(script);
    if (segs.length) {
      const buffers = [];
      for (const s of segs) buffers.push(await hoerenTTS(s.text, s.voice));  // sequential keeps order
      return Buffer.concat(buffers);
    }
  }
  return hoerenTTS(hoerenStripLabels(script), HOEREN_VOICE_A);
}

function hoerenPathFromUrl(url) {
  const marker = '/' + HOEREN_BUCKET + '/';
  const i = String(url || '').indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

// Shape returned to the client (includes correct answers — A1 self-practice
// grades client-side).
function hoerenPublic(row) {
  return {
    id: row.id, exercise_type: row.exercise_type, level: row.level,
    scenario: row.scenario, audio_url: row.audio_url, questions: row.questions || [],
    times_used: row.times_used,
  };
}

async function generateHoerenExercise(type, avoid) {
  const gen = await callClaudeJSON(buildHoerenPrompt(type, avoid), 'Generate the exercise now.', 1500);
  if (!gen || !gen.audio_script || !Array.isArray(gen.questions) || !gen.questions.length) {
    throw new Error('Could not generate a valid exercise.');
  }
  const audio = await hoerenSynthesize(type, gen.audio_script);

  const path = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const up = await supabaseAdmin.storage.from(HOEREN_BUCKET)
    .upload(path, audio, { contentType: 'audio/mpeg', upsert: false });
  if (up.error) throw new Error('Audio upload failed: ' + up.error.message);
  const audioUrl = supabaseAdmin.storage.from(HOEREN_BUCKET).getPublicUrl(path).data.publicUrl;

  const { data: row, error: insErr } = await supabaseAdmin.from('hoerverstehen_exercises').insert({
    exercise_type: type, level: 'A1',
    scenario: gen.scenario || '', audio_script: gen.audio_script || '',
    audio_url: audioUrl, questions: gen.questions, times_used: 1,
  }).select().maybeSingle();
  if (insErr || !row) throw new Error('Could not save exercise: ' + (insErr && insErr.message));

  // Prune to the newest HOEREN_KEEP per type (best-effort, incl. audio files).
  supabaseAdmin.from('hoerverstehen_exercises')
    .select('id, audio_url').eq('exercise_type', type)
    .order('created_at', { ascending: false }).range(HOEREN_KEEP, 999)
    .then(({ data }) => {
      if (!data || !data.length) return;
      const paths = data.map((e) => hoerenPathFromUrl(e.audio_url)).filter(Boolean);
      if (paths.length) supabaseAdmin.storage.from(HOEREN_BUCKET).remove(paths).then(() => {}, () => {});
      supabaseAdmin.from('hoerverstehen_exercises').delete().in('id', data.map((e) => e.id)).then(() => {}, () => {});
    }, () => {});

  return row;
}

// ── POST /api/hoerverstehen/generate ───────────────────────────────────────
app.post('/api/hoerverstehen/generate', async (req, res) => {
  const type = HOEREN_TYPES.includes((req.body && req.body.exercise_type)) ? req.body.exercise_type : null;
  if (!type) return res.status(400).json({ error: 'Invalid exercise_type.' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Storage not configured.' });
  if (!process.env.CLAUDE_API_KEY) return res.status(500).json({ error: 'API key not configured.' });
  if (!process.env.ELEVENLABS_API_KEY) return res.status(500).json({ error: 'Audio not configured.' });
  // Optional — only ever sent by an explicit content-regeneration call (see
  // hoeren-a1-restructure-plan.md), never by the standalone practice page's
  // "Generate new" button. Array of short scenario descriptions to avoid
  // repeating.
  const avoid = Array.isArray(req.body && req.body.avoid)
    ? req.body.avoid.filter((a) => typeof a === 'string').slice(0, 30)
    : undefined;
  console.log(`[/api/hoerverstehen/generate] type=${type}${avoid ? ', avoid=' + avoid.length + ' items' : ''}`);
  try {
    const row = await generateHoerenExercise(type, avoid);
    return res.json({ exercise: hoerenPublic(row), generated: true });
  } catch (err) {
    console.error('[/api/hoerverstehen/generate] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ── POST /api/hoerverstehen/practice ───────────────────────────────────────
// Serve a cached exercise (least-used first, to rotate); generate if none.
app.post('/api/hoerverstehen/practice', async (req, res) => {
  const type = HOEREN_TYPES.includes((req.body && req.body.exercise_type)) ? req.body.exercise_type : null;
  if (!type) return res.status(400).json({ error: 'Invalid exercise_type.' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Storage not configured.' });
  try {
    const { data: row } = await supabaseAdmin.from('hoerverstehen_exercises')
      .select('*').eq('exercise_type', type)
      .order('times_used', { ascending: true }).order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!row) {
      const fresh = await generateHoerenExercise(type);
      return res.json({ exercise: hoerenPublic(fresh), generated: true });
    }
    supabaseAdmin.from('hoerverstehen_exercises')
      .update({ times_used: (row.times_used || 0) + 1 }).eq('id', row.id).then(() => {}, () => {});
    return res.json({ exercise: hoerenPublic(row), generated: false });
  } catch (err) {
    console.error('[/api/hoerverstehen/practice] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
});

// ── POST /api/exam-grade ─────────────────────────────────────────────────────
// Grades a structured A1 Schreiben exam submission (form fill + short message).
// Returns a JSON response with per-task scores, rubric breakdown, top mistakes,
// and a next-step recommendation. The client renders this verbatim — no
// post-processing beyond shape validation here.

// Pass mark for all four exam-grade rubrics below — single canonical
// value from scoring-config.js, interpolated into each prompt instead of
// being retyped as a bare number per level (only B1 used to state one at
// all; A1/A2/B2 now say the same thing B1 always did).
const EXAM_GRADE_PASS_PCT = dwScoring.PASS_THRESHOLD_PCT;

// Taxonomy reference block, generated once from taxonomy.js and reused
// in all four rubric prompts below (and in the Sprechen feedback prompt)
// so there's exactly one authored copy of "here are the categories you
// may tag" instead of four independently-typed copies that could drift.
// register_mismatch/text_conventions_structure are excluded here — they
// are restricted to each task's register_check.flags, never a general
// criterion's tags array (see EXAM_GRADE_TAGGING_RULE below).
const EXAM_GRADE_TAXONOMY_BLOCK = dwTaxonomy.CATEGORIES
  .filter(c => c.key !== 'register_mismatch' && c.key !== 'text_conventions_structure')
  .map(c => `- ${c.key}: ${c.description}`)
  .join('\n');

const EXAM_GRADE_TAGGING_RULE = `TAXONOMY TAGGING — when a criterion's feedback notes a specific error type, tag it with the matching category key(s) from this list in that criterion's "tags" array (use [] if none clearly apply — do not force a fit):
${EXAM_GRADE_TAXONOMY_BLOCK}
IMPORTANT: register_mismatch and text_conventions_structure are NEVER used in a criterion's "tags" — those two categories belong ONLY inside "register_check.flags" (see below).`;

// A1/A2 use 2 criteria (Erfüllung + Kommunikative Gestaltung) per
// scoring-reconciliation-plan.md / feedback-audit.md Part B step 2 — B1/B2
// use 4 (adding Wortschatz + Formale Richtigkeit as their own lines,
// matching what B2's grader already did). Register/text-type is checked
// as its own diagnostic per task (step 1) — it never changes a score.
const EXAM_GRADE_A1_SYSTEM_PROMPT = `You are a certified Goethe-Institut A1 exam grader. Grade this student's Schreiben submission using the official Goethe A1 Fit in Deutsch 1 rubric exactly.

The student wrote a short message (~30 words) responding to an email stimulus. Grade using these two criteria:

CRITERION — Erfüllung (task fulfillment / content, max 3 points):
- 3 points: Text fully matches the prompt AND reaches approximately 30 words. Gives relevant personal information covering the stimulus.
- 2 points: Text largely matches the prompt. Word count is between 20–30. Most required content is present.
- 1 point: Text partially matches the prompt OR sentences are copied verbatim from the stimulus. Content is too sparse.
- 0 points: Text does not match the prompt at all. If 0 — the ENTIRE Schreiben section scores 0.

CRITERION — Kommunikative Gestaltung (coherence, register, appropriate form, and basic correctness, max 3 points):
- 3 points: Greeting and closing present and appropriate. Reads coherently. No errors or only isolated errors that don't affect comprehension.
- 2 points: Greeting/closing present but simple. Some errors in syntax, morphology, orthography that slightly affect comprehension.
- 1 point: Greeting or closing missing or awkward. Errors at multiple points that noticeably affect comprehension.
- 0 points: So many errors that the content is no longer comprehensible. If 0 — the ENTIRE Schreiben section scores 0.

REGISTER CHECK — separate diagnostic, does NOT change either score above:
A1 short messages to a friend/acquaintance are informal (du-form). Check specifically whether the student used "du" throughout (a "Sie" here would be a register_mismatch) and whether SOME greeting and SOME closing exist at all in any form (their total absence is a text_conventions_structure issue, independent of whether the one used was the right formality).

${EXAM_GRADE_TAGGING_RULE}

IMPORTANT RULES:
- Spelling errors are only penalised if they affect comprehension.
- Even imperfect sentences can score full marks if they are understandable.
- If either criterion scores 0, set both scores to 0 and total_score to 0.
- The raw total (Erfüllung + Kommunikative Gestaltung) is multiplied by 2 to get the final score out of 12.
- Pass mark = ${Math.ceil(12 * EXAM_GRADE_PASS_PCT / 100)}/12 (${EXAM_GRADE_PASS_PCT}%) — official Goethe pass threshold.
- Word count: count the student's words carefully. Do not count the greeting line as words if it is a single word like "Hallo".

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau A1.
Benutze nur sehr einfache Wörter und kurze Sätze.
Maximal 8 Wörter pro Satz.
Keine langen Erklärungen.
Sei freundlich. Benutze 'du'.

Respond as a single raw JSON object — no markdown, no code fences, no text outside the JSON. Use this exact shape:
{
  "tasks": {
    "task1": {
      "erfuellung": { "score": <integer 0-3>, "max": 3, "explanation": "...", "tip": "...", "tags": [] },
      "kommunikative_gestaltung": { "score": <integer 0-3>, "max": 3, "explanation": "...", "tip": "...", "tags": [] },
      "register_check": { "expected_register": "informal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <erfuellung.score + kommunikative_gestaltung.score>
    }
  },
  "total_raw": <tasks.task1.task_raw>,
  "total_score": <total_raw * 2>,
  "max_score": 12,
  "word_count": <integer — number of words counted in the student's message>,
  "overall_feedback": "Two encouraging sentences.",
  "top_mistakes": ["First mistake to fix.", "Second mistake to fix."],
  "next_recommendation": "One concrete next-practice activity."
}`;

const EXAM_GRADE_A2_SYSTEM_PROMPT = `You are a certified Goethe-Institut A2 exam grader. Grade this student's Schreiben submission using the official Goethe A2 rubric.

The student wrote TWO texts:
- Task 1: SMS (target 20–30 words, must cover 3 bullet points, informal register)
- Task 2: Semi-formal email (target 30–40 words, must cover 3 bullet points, semi-formal/formal register)

Grade EACH task independently on TWO criteria using this 5-level scale:

CRITERION — Erfüllung (task completion — content only, NOT register; register is judged separately below):
A = 5 points: all 3 bullet points covered adequately
B = 3.5 points: 2 bullet points adequate OR 1 adequate + 2 partial
C = 2 points: 1 bullet point adequate + 1 partial OR all partial
D = 0.5 points: only 1 bullet point adequate or partial
E = 0 points: text too short (under 10 words Task1 / under 15 words Task2) OR topic missed entirely — IF E then entire task scores 0

CRITERION — Kommunikative Gestaltung (language, coherence, and basic correctness — vocabulary/structures/flow, NOT register; register is judged separately below):
A = 5 points: appropriate and varied, isolated errors don't affect comprehension
B = 3.5 points: mostly appropriate, several errors don't affect comprehension
C = 2 points: partly appropriate, several errors partly affect comprehension
D = 0.5 points: barely appropriate, errors seriously affect comprehension
E = 0 points: text completely inappropriate throughout

REGISTER CHECK — separate diagnostic per task, does NOT change either score above:
Task 1 (SMS) is informal (du-form, casual tone). Task 2 (email) is semi-formal/formal (check greeting/closing conventions and Sie-vs-du appropriateness for a semi-formal email). For each task, flag register_mismatch if the tone/formality choice is wrong for that task, and flag text_conventions_structure if expected structural elements (greeting, closing, paragraph shape) are missing or malformed — independent of whether the formality choice itself was right.

${EXAM_GRADE_TAGGING_RULE}

SCORING:
- Task 1 raw = Erfüllung + Kommunikative Gestaltung (max 10)
- Task 2 raw = Erfüllung + Kommunikative Gestaltung (max 10)
- Total raw = Task1 + Task2 (max 20)
- Final score = total raw × 1.25 (max 25)
- Pass mark = ${Math.ceil(25 * EXAM_GRADE_PASS_PCT / 100)}/25 (${EXAM_GRADE_PASS_PCT}%) — official Goethe pass threshold.
- If Erfüllung = E for a task, that entire task = 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau A2.
Benutze einfache Wörter und kurze Sätze.
Maximal 12 Wörter pro Satz.
Sei freundlich und ermutigend. Benutze 'du'.

Return raw JSON only, no markdown, using this exact shape:
{
  "tasks": {
    "task1": {
      "erfuellung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "kommunikative_gestaltung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "register_check": { "expected_register": "informal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <erfuellung.score + kommunikative_gestaltung.score>
    },
    "task2": {
      "erfuellung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "kommunikative_gestaltung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "register_check": { "expected_register": "formal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <erfuellung.score + kommunikative_gestaltung.score>
    }
  },
  "total_raw":   <tasks.task1.task_raw + tasks.task2.task_raw>,
  "total_score": <total_raw * 1.25>,
  "max_score":   25,
  "overall_feedback": "...",
  "top_mistakes": ["...", "..."],
  "next_recommendation": "..."
}`;

// B1 rubric — official Goethe-Zertifikat B1 Modellsatz Schreiben.
// Three independent tasks, each now graded on 4 criteria (matching B2's
// depth per feedback-audit.md Part B step 2) using the A-E scale
// (5/3.5/2/0.5/0) per criterion. Per-task raw max = 20 (4 x 5). Total
// raw max = 60 (3 tasks). Final score = round(total_raw / 60 x 100) so
// the displayed number is still always /100, matching the official
// conversion and leaving max_score/pass-threshold mechanics untouched.
const EXAM_GRADE_B1_SYSTEM_PROMPT = `You are a certified Goethe-Institut B1 exam grader. Grade this student's Schreiben submission using the official Goethe-Zertifikat B1 Modellsatz rubric exactly.

The student wrote THREE texts:
- Aufgabe 1: personal email (target ~80 words, must cover 3 bullet points, informal register)
- Aufgabe 2: opinion / discussion text (target ~80 words, must give a clear opinion + reasons, neutral/semi-formal register)
- Aufgabe 3: short formal email (target ~40 words, must cover 3 bullet points, formal register)

Grade EACH task INDEPENDENTLY on FOUR criteria using this 5-level A-E scale:

CRITERION — Erfüllung (task completion + content only, NOT register — register is judged separately below):
A = 5    points: all required content fully addressed
B = 3.5  points: most content addressed, one bullet point underdeveloped
C = 2    points: about half the required content addressed
D = 0.5  points: very little content addressed
E = 0    points: topic missed entirely OR text far too short — IF E for a task, that whole task scores 0

CRITERION — Kommunikative Gestaltung (coherence and flow — how well ideas connect, NOT vocabulary or grammar, which are scored separately below):
A = 5    points: clear coherence, ideas flow logically, appropriate connectors
B = 3.5  points: mostly coherent, occasional abrupt transitions
C = 2    points: some coherence but connectors repetitive or missing
D = 0.5  points: ideas mostly disconnected
E = 0    points: incoherent

CRITERION — Wortschatz (vocabulary range and precision):
A = 5    points: B1-appropriate vocabulary, varied, precise word choice
B = 3.5  points: mostly appropriate, occasional imprecision or repetition
C = 2    points: limited vocabulary, frequent repetition
D = 0.5  points: very limited vocabulary
E = 0    points: vocabulary completely inadequate

CRITERION — Formale Richtigkeit (grammar accuracy — sentence structure correctness):
A = 5    points: varied structures, isolated errors don't impede comprehension
B = 3.5  points: mostly correct, several errors don't impede comprehension
C = 2    points: simple structures dominate, errors slightly impede comprehension
D = 0.5  points: very basic structures, errors seriously impede comprehension
E = 0    points: grammar so poor the text is incomprehensible

REGISTER CHECK — separate diagnostic per task, does NOT change any score above:
Aufgabe 1 is informal (du-form). Aufgabe 2 is neutral/semi-formal opinion writing. Aufgabe 3 is formal (Sie-form, formal greeting/closing). For each task, flag register_mismatch if the tone/formality choice is wrong for that task, and flag text_conventions_structure if expected structural elements (greeting, closing, paragraph shape) are missing or malformed — independent of whether the formality choice itself was right.

${EXAM_GRADE_TAGGING_RULE}

SCORING (compute exactly as below):
- aufgabe1.task_raw = sum of aufgabe1's 4 criteria scores   (max 20)
- aufgabe2.task_raw = sum of aufgabe2's 4 criteria scores   (max 20)
- aufgabe3.task_raw = sum of aufgabe3's 4 criteria scores   (max 20)
- total_raw   = aufgabe1.task_raw + aufgabe2.task_raw + aufgabe3.task_raw  (max 60)
- total_score = round(total_raw / 60 × 100)                                (max 100)
- max_score   = 100
- Pass mark   = ${EXAM_GRADE_PASS_PCT} (${EXAM_GRADE_PASS_PCT}%) — official Goethe B1 pass threshold
- IF Erfüllung = E for a task → set ALL FOUR of that task's criteria scores to 0 and task_raw to 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau B1.
Klare, einfache Sätze. Sei freundlich, konstruktiv. Benutze 'du'.

Return raw JSON only, no markdown, no code fences, no text outside the JSON. Use this exact shape:
{
  "tasks": {
    "aufgabe1": {
      "erfuellung": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "Ein bis zwei Sätze auf Deutsch.", "tip": "...", "tags": [] },
      "kommunikative_gestaltung": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "...", "tags": [] },
      "wortschatz": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "...", "tags": [] },
      "formale_richtigkeit": { "score": <0|0.5|2|3.5|5>, "label": "A|B|C|D|E", "explanation": "...", "tip": "...", "tags": [] },
      "register_check": { "expected_register": "informal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <sum of the 4 criteria scores above>
    },
    "aufgabe2": {
      "erfuellung": {...}, "kommunikative_gestaltung": {...}, "wortschatz": {...}, "formale_richtigkeit": {...},
      "register_check": { "expected_register": "neutral", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <n>
    },
    "aufgabe3": {
      "erfuellung": {...}, "kommunikative_gestaltung": {...}, "wortschatz": {...}, "formale_richtigkeit": {...},
      "register_check": { "expected_register": "formal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <n>
    }
  },
  "total_raw":   <tasks.aufgabe1.task_raw + tasks.aufgabe2.task_raw + tasks.aufgabe3.task_raw>,
  "total_score": <integer = round(total_raw / 60 * 100)>,
  "max_score":   100,
  "overall_feedback":    "Zwei ermutigende Sätze auf Deutsch.",
  "top_mistakes":        ["Erste Verbesserung.", "Zweite Verbesserung.", "Dritte Verbesserung."],
  "next_recommendation": "Eine konkrete Übung als nächster Schritt."
}`;

// B2 rubric — 2 writing tasks (forum/opinion post + formal letter).
// Each task scored on 4 criteria, A-E scale, per-task max = 20, total = 40.
// Criterion names below are now Erfüllung/Kommunikative Gestaltung/
// Wortschatz/Formale Richtigkeit — same 4 concepts B2 already scored
// (content/Kohärenz/vocabulary/Strukturen), renamed to match the
// standardized cross-level naming introduced in feedback-audit.md Part B
// step 2 (Kohärenz -> Kommunikative Gestaltung, Strukturen -> Formale
// Richtigkeit) so B1 and B2 use identical criterion names. Register,
// previously folded into Wortschatz's "register fits"/"register slips"
// tiers, is now its own separate, unscored diagnostic (step 1).
const EXAM_GRADE_B2_SYSTEM_PROMPT = `You are a certified Goethe-Institut B2 exam grader. Grade this student's Schreiben submission using the official Goethe-Zertifikat B2 rubric.

The student wrote TWO texts:
- Aufgabe 1: forum / opinion post (target ~150 words, clear position + arguments + examples, neutral/semi-formal register)
- Aufgabe 2: formal letter or semi-formal email (target ~100 words, all bullet points, formal register)

Grade each task on FOUR criteria using this 5-level scale:

CRITERION — Erfüllung (content — coverage of all bullet points + topic depth, NOT register):
A = 5 points: all bullet points fully addressed, depth appropriate, topic clearly developed
B = 3.5 points: most bullet points addressed, some depth missing
C = 2 points: about half addressed OR superficial throughout
D = 0.5 points: very little content addressed
E = 0 points: topic missed entirely — IF E then entire task scores 0

CRITERION — Kommunikative Gestaltung (text structure — transitions, paragraphing, opening/closing, flow):
A = 5 points: well-structured, varied connectors, clear opening + closing, smooth flow
B = 3.5 points: mostly structured, basic connectors, some flow issues
C = 2 points: partial structure, repetitive transitions
D = 0.5 points: mostly disconnected
E = 0 points: incoherent

CRITERION — Wortschatz (vocabulary — range + precision, NOT register):
A = 5 points: varied B2-appropriate vocabulary, precise word choice
B = 3.5 points: adequate vocabulary, occasional imprecision
C = 2 points: limited vocabulary, frequent imprecision
D = 0.5 points: very limited vocabulary
E = 0 points: vocabulary completely inadequate

CRITERION — Formale Richtigkeit (grammar — sentence variety + accuracy):
A = 5 points: complex + varied structures, isolated errors don't impede comprehension
B = 3.5 points: mostly varied, several errors don't impede comprehension
C = 2 points: simple structures dominate, several errors slightly impede comprehension
D = 0.5 points: very basic structures, errors seriously impede comprehension
E = 0 points: grammar so poor the text is incomprehensible

REGISTER CHECK — separate diagnostic per task, does NOT change any score above:
Aufgabe 1 is a neutral/semi-formal forum post. Aufgabe 2 is a formal letter/email (Sie-form, formal greeting/closing conventions). For each task, flag register_mismatch if the tone/formality choice is wrong for that task, and flag text_conventions_structure if expected structural elements (greeting, closing, paragraph shape) are missing or malformed — independent of whether the formality choice itself was right.

${EXAM_GRADE_TAGGING_RULE}

SCORING:
- Each task raw = Erfüllung + Kommunikative Gestaltung + Wortschatz + Formale Richtigkeit (max 20)
- Total raw = aufgabe1.task_raw + aufgabe2.task_raw (max 40)
- Final score = total raw (no scaling at B2)
- Pass mark = ${Math.ceil(40 * EXAM_GRADE_PASS_PCT / 100)}/40 (${EXAM_GRADE_PASS_PCT}%) — official Goethe pass threshold.
- If Erfüllung = E for a task, that entire task = 0

Schreib das gesamte Feedback auf Deutsch — auf dem Sprachniveau B2.
Präzise, sachlich, freundlich. Benutze 'du'.

Return raw JSON only, no markdown, using this exact shape:
{
  "tasks": {
    "aufgabe1": {
      "erfuellung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "kommunikative_gestaltung": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "wortschatz": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "formale_richtigkeit": { "score": <0/0.5/2/3.5/5>, "label": "A/B/C/D/E", "explanation": "...", "tip": "...", "tags": [] },
      "register_check": { "expected_register": "neutral", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <sum of the 4 criteria scores above>
    },
    "aufgabe2": {
      "erfuellung": {...}, "kommunikative_gestaltung": {...}, "wortschatz": {...}, "formale_richtigkeit": {...},
      "register_check": { "expected_register": "formal", "passed": true, "flags": [], "explanation": "..." },
      "task_raw": <n>
    }
  },
  "total_raw":   <tasks.aufgabe1.task_raw + tasks.aufgabe2.task_raw>,
  "total_score": <total_raw>,
  "max_score":   40,
  "overall_feedback": "...",
  "top_mistakes": ["...", "..."],
  "next_recommendation": "..."
}`;

// Marks a task's response as blank for the grader rather than silently
// grading an empty string — used only for timeout-triggered submissions
// (see isTimeoutSubmit below), where "no response" is a real, expected
// outcome that must still resolve to a finished, scored result.
const EXAM_GRADE_BLANK_MARKER = '[KEINE ANTWORT — Zeit abgelaufen, bevor etwas geschrieben wurde]';
function examGradeBlockOrBlankMarker(block) {
  return (block && block.length) ? block : EXAM_GRADE_BLANK_MARKER;
}
const EXAM_GRADE_BLANK_INSTRUCTION =
  `\n\nIf any task above shows exactly "${EXAM_GRADE_BLANK_MARKER}" instead of real text, ` +
  'that task had no response submitted before time expired — award the minimum possible score ' +
  '(0) for every criterion in that task specifically, with an explanation noting no response was ' +
  'submitted, and set that task\'s register_check.passed to false. Do NOT let a blank task affect ' +
  'the scoring of any OTHER task in the same submission.';

// Deterministic form_fill scoring (Mock Exam A1 Schreiben Teil 1 — official
// Start Deutsch 1 structure: 5 blanks, 1 point each, exact/case-insensitive
// match). Separate from the Claude-graded task2/task3/task4 short-message
// rubrics below on purpose — a fill-in-the-form field has one correct
// answer, so this doesn't need (and shouldn't get) AI judgment. Looks up
// the authoritative answer key server-side via examId + task_number=1,
// never trusts a client-supplied "correct" value.
async function scoreFormFill(examId, submittedValues) {
  if (!Array.isArray(submittedValues) || !submittedValues.length) return null;
  if (!examId || !supabaseAdmin) return null;
  const { data: task, error } = await supabaseAdmin
    .from('exam_tasks')
    .select('stimulus, max_score')
    .eq('exam_id', examId)
    .eq('task_number', 1)
    .eq('task_type', 'form_fill')
    .maybeSingle();
  if (error || !task) return null;
  const fields  = (task.stimulus && task.stimulus.fields)  || [];
  const answers = (task.stimulus && task.stimulus.answers) || [];
  const items = fields.map((field, i) => {
    const your    = String(submittedValues[i] || '').trim();
    const correct = String(answers[i] || '').trim();
    const ok = your.length > 0 && your.toLowerCase() === correct.toLowerCase();
    return { field, your, correct, ok };
  });
  return {
    score: items.filter(it => it.ok).length,
    max:   (typeof task.max_score === 'number') ? task.max_score : fields.length,
    items,
  };
}

app.post('/api/exam-grade', async (req, res) => {
  const { level, task1, examId, task2, task3, task4, isTimeoutSubmit } = req.body || {};
  const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const safeLevel = VALID_LEVELS.indexOf(level) !== -1 ? level : 'A1';
  const isTimeout  = isTimeoutSubmit === true;

  if (!isTimeout) {
    // Manual submission — completely unaffected by this change. The
    // Submit button's own word-minimum gate already guarantees these are
    // non-empty by the time a request gets here; this is the server-side
    // backstop for that same rule.
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
  } else {
    // Timeout submission — a blank required field is graded as blank, not
    // rejected (candidate-experience-audit.md Part 2: no grace period, and
    // no error state either). Only type-check what's present.
    if (task2 != null && typeof task2 !== 'string') {
      return res.status(400).json({ error: 'Invalid task2 response.' });
    }
    if (task3 != null && typeof task3 !== 'string') {
      return res.status(400).json({ error: 'Invalid task3 response.' });
    }
    if (task4 != null && typeof task4 !== 'string') {
      return res.status(400).json({ error: 'Invalid task4 response.' });
    }
  }
  if (!process.env.CLAUDE_API_KEY) {
    console.error('[/api/exam-grade] CLAUDE_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const task2Block = String(task2 || '').slice(0, 2500).trim();
  const task3Block = task3 ? String(task3).slice(0, 2500).trim() : '';
  const task4Block = task4 ? String(task4).slice(0, 2500).trim() : '';

  // Pick the per-level system prompt + user-message format.
  let systemPrompt, userMessage;
  if (safeLevel === 'B2') {
    systemPrompt = EXAM_GRADE_B2_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (Forum/Meinung, target ~150 words):\n"""\n${examGradeBlockOrBlankMarker(task2Block)}\n"""\n\n` +
      `Aufgabe 2 (formelle E-Mail/Brief, target ~100 words):\n"""\n${examGradeBlockOrBlankMarker(task3Block)}\n"""`;
  } else if (safeLevel === 'B1') {
    systemPrompt = EXAM_GRADE_B1_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (informeller Beitrag, target ~80 words):\n"""\n${examGradeBlockOrBlankMarker(task2Block)}\n"""\n\n` +
      `Aufgabe 2 (Forumsbeitrag mit Meinung, target ~80 words):\n"""\n${examGradeBlockOrBlankMarker(task3Block)}\n"""\n\n` +
      `Aufgabe 3 (formelle E-Mail, target ~40 words):\n"""\n${examGradeBlockOrBlankMarker(task4Block)}\n"""`;
  } else if (safeLevel === 'A2') {
    systemPrompt = EXAM_GRADE_A2_SYSTEM_PROMPT;
    userMessage  =
      `Aufgabe 1 (SMS, target 20–30 words):\n"""\n${examGradeBlockOrBlankMarker(task2Block)}\n"""\n\n` +
      `Aufgabe 2 (E-Mail, target 30–40 words):\n"""\n${examGradeBlockOrBlankMarker(task3Block)}\n"""`;
  } else {
    systemPrompt = EXAM_GRADE_A1_SYSTEM_PROMPT;
    userMessage  = `Student's short message (target ~30 words):\n"""\n${examGradeBlockOrBlankMarker(task2Block)}\n"""`;
  }
  if (isTimeout) userMessage += EXAM_GRADE_BLANK_INSTRUCTION;

  console.log(`[/api/exam-grade] Request — level=${safeLevel}, timeout=${isTimeout}, task2=${task2Block.length}${task3Block ? ', task3=' + task3Block.length : ''}${task4Block ? ', task4=' + task4Block.length : ''} chars, origin: ${req.headers.origin || 'none'}`);

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
        // Bumped from 2500: B1/B2 responses now carry up to 3 tasks x 4
        // criteria (each with a tags array) plus a register_check per
        // task, which is noticeably larger than the old 2-criteria shape
        // and was hitting truncated/unparseable JSON at the old limit.
        max_tokens: 4000,
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

    // Shape validation — unified across all 4 levels since
    // feedback-audit.md Part B: every level now returns
    // result.tasks.<taskKey>.<criterion>.score, differing only in which
    // task keys exist (task1/task2 for A1/A2, aufgabe1/2/3 for B1,
    // aufgabe1/2 for B2) and which criteria each task carries (A1/A2 =
    // erfuellung + kommunikative_gestaltung; B1/B2 = those two plus
    // wortschatz + formale_richtigkeit). A criterion object always has a
    // numeric .score; register_check always has a boolean .passed.
    const EXAM_GRADE_TASK_KEYS = {
      A1: ['task1'],
      A2: ['task1', 'task2'],
      B1: ['aufgabe1', 'aufgabe2', 'aufgabe3'],
      B2: ['aufgabe1', 'aufgabe2'],
    };
    const EXAM_GRADE_CRITERIA = {
      A1: ['erfuellung', 'kommunikative_gestaltung'],
      A2: ['erfuellung', 'kommunikative_gestaltung'],
      B1: ['erfuellung', 'kommunikative_gestaltung', 'wortschatz', 'formale_richtigkeit'],
      B2: ['erfuellung', 'kommunikative_gestaltung', 'wortschatz', 'formale_richtigkeit'],
    };
    function taskShapeOk(task, criteriaKeys) {
      if (!task) return false;
      for (const key of criteriaKeys) {
        if (!task[key] || typeof task[key].score !== 'number') return false;
      }
      return !!task.register_check && typeof task.register_check.passed === 'boolean';
    }
    const shapeOk = (
      !!result.tasks &&
      EXAM_GRADE_TASK_KEYS[safeLevel].every(k => taskShapeOk(result.tasks[k], EXAM_GRADE_CRITERIA[safeLevel])) &&
      typeof result.total_score === 'number'
    );
    if (!shapeOk) {
      console.error('[/api/exam-grade] Unexpected response shape:', result);
      return res.status(502).json({ error: 'Unexpected response format from grader. Try again.' });
    }

    const fallbackMax = { A1: 12, A2: 25, B1: 100, B2: 40 }[safeLevel];

    // Additive, separate from the Claude-graded task2 rubric above — only
    // present when the submission actually included a form_fill task
    // (Mock Exam A1 Übungssatz Teil 1). Absent for every Practice Pool A1
    // exam, which has no form_fill task, so this never touches those.
    const formFill = await scoreFormFill(examId, task1).catch(err => {
      console.error('[/api/exam-grade] form_fill scoring failed:', err.message);
      return null;
    });
    if (formFill) {
      result.form_fill  = formFill;
      result.total_score = (result.total_score || 0) + formFill.score;
      result.max_score   = (typeof result.max_score === 'number' ? result.max_score : fallbackMax) + formFill.max;
    }

    console.log(`[/api/exam-grade] Success — level=${safeLevel}, total=${result.total_score}/${result.max_score || fallbackMax}${formFill ? ` (incl. form_fill ${formFill.score}/${formFill.max})` : ''}`);
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
// SPRECHEN — Part 4: OpenAI Realtime WebSocket (wss://…/sprechen-session)
// The browser streams 24kHz PCM16 mic audio here; we proxy it to the OpenAI
// Realtime API (the examiner) and stream 24kHz PCM16 audio back. Transcripts
// are collected, and on session end we save the session, generate Claude
// feedback, and bump the cap. Same client protocol as before — only the
// upstream voice provider changed.
// ═══════════════════════════════════════════════════════════════════════════

const SPRECHEN_OPENAI_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
const SPRECHEN_OPENAI_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy';
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

// German towns/cities the candidate may name when introducing themselves —
// includes smaller/lower-frequency ones (not just Berlin/München) so Whisper
// doesn't default to a higher-frequency look-alike (e.g. "Neunkirchen" heard
// as "München") when an A1-accented place name is acoustically ambiguous.
const SPRECHEN_PLACE_NAMES = 'Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Dortmund, Essen, Bremen, Dresden, Hannover, Nürnberg, Duisburg, Bochum, Wuppertal, Bielefeld, Bonn, Münster, Karlsruhe, Mannheim, Augsburg, Wiesbaden, Mönchengladbach, Gelsenkirchen, Aachen, Braunschweig, Chemnitz, Kiel, Halle, Magdeburg, Freiburg, Krefeld, Lübeck, Mainz, Erfurt, Rostock, Kassel, Saarbrücken, Potsdam, Neunkirchen, Pforzheim, Würzburg, Göttingen, Wolfsburg, Offenbach, Heidelberg';

// Whisper's transcription prompt is treated as preceding context, not an
// instruction — it autoregressively continues from these tokens, so writing
// it IN German (rather than describing German in English) is what actually
// biases decoding toward German and away from acoustically-similar words in
// other languages. Combined with transcription.language='de' below, this is
// the fix for the "mein Name" → "mi nombre" language-switch bug: language
// pins the model to German, the prompt nudges vocabulary within German.
function buildTranscriptionPrompt(topics) {
  const t = topics || {};
  const topicWords = [t.part1 && t.part1.topic, t.part2 && t.part2.topic, t.part3 && t.part3.topic]
    .filter(Boolean).join(' ');
  return `Goethe-Zertifikat A1 Sprechprüfung. Der Kandidat spricht einfaches Deutsch, oft mit ausländischem Akzent. Themen: sich vorstellen (Name, Herkunftsland, Wohnort, Beruf), ein Bild beschreiben, gemeinsam planen. Deutsche Städte und Orte, auch kleinere: ${SPRECHEN_PLACE_NAMES}. ${topicWords}`.trim();
}

function attachSprechenWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/sprechen-session' });
  console.log('  ✦ WSS /sprechen-session ready (OpenAI Realtime examiner)');

  wss.on('connection', function (ws) {
    let upstream = null;        // OpenAI Realtime WS
    let upstreamReady = false;  // session.update sent + ready for audio
    let openerSent = false;     // examiner greeting triggered once
    let started = false;        // init received
    let finalized = false;
    let sessionId = null;
    let userId = null, level = 'A1', language = 'english';
    let mockExamAttemptId = null;   // set only when this session belongs to a Complete Mock Exam attempt
    let isRestartSession = false;   // true only for a server-authorized technical-failure restart
    let startedAt = Date.now();
    let timeout = null;
    let warnTimeout = null;
    const transcript = [];      // [{role, text}]
    const pendingAudio = [];    // base64 mic chunks queued before upstream is ready

    const send = (obj) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (_) {} };
    const toUpstream = (obj) => { try { if (upstream && upstream.readyState === 1) upstream.send(JSON.stringify(obj)); } catch (_) {} };

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
      if (warnTimeout) clearTimeout(warnTimeout);
      try { if (upstream) upstream.close(); } catch (_) {}
      const duration = Math.round((Date.now() - startedAt) / 1000);
      const fullTranscript = transcriptString();

      // Persist transcript + duration + end_reason — awaited and checked,
      // not fire-and-forget, because the mock-exam completion decision
      // below must never be made against a row that failed to save.
      let persistOk = true;
      if (supabaseAdmin && sessionId) {
        const persistResult = await supabaseAdmin.from('sprechen_sessions')
          .update({ transcript: fullTranscript, duration_seconds: duration, end_reason: reason })
          .eq('id', sessionId);
        if (persistResult.error) {
          persistOk = false;
          console.error('[sprechen-ws] finalize persist failed', sessionId, persistResult.error.message);
        }
      }

      if (!mockExamAttemptId) {
        // ── Standalone practice: byte-identical to the pre-existing wire
        // protocol — sprechen.html isn't being touched this round, so its
        // ws.onmessage contract (feedback / error / done) must not change.
        if (!persistOk) {
          send({ type: 'error', message: 'Could not save your session. Please refresh.' });
        } else if (fullTranscript.trim().length > 20 && process.env.CLAUDE_API_KEY) {
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
        if (userId) {
          try { await sprechenIncrementCap(userId, level); } catch (_) {}
          if (level === 'A1') { try { await sprechenAddDailyUsage(userId, duration); } catch (_) {} }
        }
        try { ws.close(); } catch (_) {}
        return;
      }

      // ── Complete Mock Exam: new lifecycle. Exam-mode sessions never
      // touch the standalone caps (sprechenIncrementCap/sprechenAddDailyUsage
      // are simply never called in this branch).
      if (!persistOk) {
        send({ type: 'error', message: 'Could not save your session. Please refresh.' });
        try { ws.close(); } catch (_) {}
        return;
      }

      const valid = isValidSprechenConversation(transcript, duration, reason);
      const isTechnical = SPRECHEN_TECHNICAL_END_REASONS.indexOf(reason) !== -1;

      if (!valid) {
        if (isTechnical && !isRestartSession) {
          // isRestartSession only affects this message's wording — the
          // actual one-restart authority is mock_exam_attempts.sprechen_restart_used,
          // enforced server-side in validateMockExamSprechenAccess(), not here.
          send({ type: 'technical_failure', message: 'Connection lost before the session really started. You can restart once.' });
        } else {
          send({ type: 'session_ended', message: 'This session ended without enough conversation to count.' });
        }
        try { ws.close(); } catch (_) {} // umbrella attempt is never touched — no link, no completion
        return;
      }

      // Valid conversation — idempotent by SQL condition (safe if finalize()
      // somehow runs more than once for this session across reconnects).
      try {
        const { data: linked } = await supabaseAdmin.from('mock_exam_attempts')
          .update({ sprechen_session_id: sessionId })
          .eq('id', mockExamAttemptId).eq('user_id', userId).is('sprechen_session_id', null)
          .select('id').maybeSingle();
        if (linked) {
          await supabaseAdmin.from('mock_exam_attempts')
            .update({ current_section: null, completed_at: new Date().toISOString() })
            .eq('id', mockExamAttemptId).eq('sprechen_session_id', sessionId).is('completed_at', null)
            .not('hoeren_attempt_id', 'is', null).not('lesen_attempt_id', 'is', null).not('schreiben_attempt_id', 'is', null);
        }
      } catch (e) {
        console.error('[sprechen-ws] mock-exam linking/completion failed:', e.message);
      }
      send({ type: 'submitted', session_id: sessionId, duration_seconds: duration });

      // Feedback is decoupled from completion — the umbrella attempt is
      // already done above regardless of how this resolves, matching "the
      // learner can safely leave the page while feedback is still pending."
      attemptSprechenFeedbackGeneration(sessionId, fullTranscript, language).then(function (result) {
        if (result.ok) send({ type: 'feedback', feedback: result.feedback, session_id: sessionId, duration_seconds: duration });
        else send({ type: 'feedback_pending', session_id: sessionId, message: 'Saved — feedback will be available shortly, or you can retry.' });
      });

      try { ws.close(); } catch (_) {}
    }

    // Translate OpenAI Realtime server events → our client protocol. Event
    // names differ slightly between the preview and GA realtime models, so we
    // accept both spellings.
    function handleUpstream(m) {
      const t = (m && m.type) || '';

      // Examiner audio (24kHz PCM16, base64).
      if ((t === 'response.audio.delta' || t === 'response.output_audio.delta') && m.delta) {
        send({ type: 'audio', data: m.delta, mimeType: 'audio/pcm;rate=24000' });
        return;
      }
      // Examiner transcript — accumulate from deltas (this is the record source).
      if ((t === 'response.audio_transcript.delta' || t === 'response.output_audio_transcript.delta') && m.delta) {
        appendTranscript('examiner', m.delta);
        send({ type: 'transcript', role: 'examiner', text: m.delta });
        return;
      }
      // Candidate transcript (Whisper). Deltas are live-display only; the
      // 'completed' event carries the full turn and is what we record — this
      // avoids double-counting when both fire on the GA model.
      if (t === 'conversation.item.input_audio_transcription.delta' && m.delta) {
        send({ type: 'transcript', role: 'candidate', text: m.delta });
        return;
      }
      if (t === 'conversation.item.input_audio_transcription.completed' && m.transcript) {
        appendTranscript('candidate', m.transcript);
        send({ type: 'transcript', role: 'candidate', text: m.transcript });
        return;
      }
      // Once the session is configured, trigger the examiner's opening turn.
      if (t === 'session.updated') {
        if (!openerSent) { openerSent = true; toUpstream({ type: 'response.create' }); }
        return;
      }
      if (t === 'response.done') { send({ type: 'turn_complete' }); return; }
      if (t === 'error') {
        console.error('[sprechen-ws] openai error event:', JSON.stringify(m.error || m).slice(0, 400));
        send({ type: 'error', message: (m.error && m.error.message) || 'Examiner error.' });
        return;
      }
    }

    async function startSession(init) {
      // Identity is never taken from the client — init.user_id is not read
      // at all. A missing/invalid/expired token rejects before any cap
      // check, any DB write, or the upstream OpenAI connection ever opens.
      const authResult = await verifySupabaseToken(init.access_token);
      if (!authResult.userId) {
        send({ type: 'error', message: 'Please sign in again.' });
        return ws.close();
      }
      userId   = authResult.userId;
      level    = init.level || 'A1';
      language = sprechenLang(init.preferred_language);
      mockExamAttemptId = init.mock_exam_attempt_id || null;

      // Ownership/cap gates run BEFORE the OpenAI-availability check —
      // a security-relevant rejection (wrong owner, wrong section, cap
      // exceeded) should never depend on unrelated infra config, and this
      // ordering means a legitimately-denied request never has any chance
      // of opening the upstream connection.
      if (mockExamAttemptId) {
        // Complete Mock Exam: server-verified ownership/state gate, exempt
        // from the standalone caps entirely (sprechenGetCap/sprechenGetDailyUsage
        // are simply never consulted in this branch).
        const access = await validateMockExamSprechenAccess(userId, mockExamAttemptId);
        if (!access.allowed) {
          send({ type: 'error', message: 'Could not start this Sprechen session (' + access.reason + ').' });
          return ws.close();
        }
        isRestartSession = Boolean(access.isRestart);
      } else {
        // Standalone — unchanged.
        try {
          const cap = await sprechenGetCap(userId, level);
          if (!cap.allowed) { send({ type: 'cap_exceeded', message: cap.message }); return ws.close(); }
        } catch (_) {}
      }

      if (!process.env.OPENAI_API_KEY) {
        send({ type: 'error', message: 'Live speaking is temporarily unavailable. Please try again later.' });
        return ws.close();
      }

      // Daily minute cap gate (free A1 tier — 10 cumulative minutes/day,
      // resets at UTC midnight; standalone only — exam mode is exempt).
      // Block the session before it ever opens the upstream OpenAI Realtime
      // connection. The 15-minute hard per-session cap below still applies
      // to exam-mode sessions regardless — that's a technical ceiling of
      // the live engine, not one of the standalone usage caps.
      const isFreeA1 = level === 'A1' && !mockExamAttemptId;
      let dailyRemainingSeconds = SPRECHEN_DAILY_CAP_SECONDS;
      if (isFreeA1) {
        try {
          const daily = await sprechenGetDailyUsage(userId);
          dailyRemainingSeconds = daily.remainingSeconds;
          if (dailyRemainingSeconds <= 0) {
            send({ type: 'daily_cap_exceeded', message: SPRECHEN_DAILY_CAP_MESSAGE });
            return ws.close();
          }
        } catch (_) {}
      }

      // Create the session row up front. mock_exam_attempt_id is set at
      // INSERT time (not patched on later) so ownership/state is knowable
      // from the row itself immediately. A unique-constraint failure here
      // means another connection for this attempt is already live
      // (sprechen_sessions_one_live_per_attempt) — the SELECT-based check
      // in validateMockExamSprechenAccess() can't fully close that race on
      // its own; this is the actual guarantee.
      if (supabaseAdmin) {
        const { data, error: insErr } = await supabaseAdmin.from('sprechen_sessions')
          .insert({ user_id: userId, level, feedback_language: language, completed: false, mock_exam_attempt_id: mockExamAttemptId })
          .select('id').maybeSingle();
        if (insErr) {
          console.error('[sprechen-ws] session insert failed:', insErr.message);
          send({ type: 'error', message: mockExamAttemptId ? 'A session is already active for this attempt.' : 'Could not start session.' });
          return ws.close();
        }
        sessionId = data && data.id;
      }
      startedAt = Date.now();

      // The session's own clock is capped at whichever is shorter: the fixed
      // 15-min per-session hard cap, or today's remaining daily allowance
      // (A1 only). Warn ~1 min before a daily-cap-bound cutoff so the user
      // isn't stopped mid-sentence without notice.
      const dailyBound = isFreeA1 && (dailyRemainingSeconds * 1000 < SPRECHEN_MAX_MS);
      const sessionCapMs = isFreeA1 ? Math.min(SPRECHEN_MAX_MS, dailyRemainingSeconds * 1000) : SPRECHEN_MAX_MS;
      timeout = setTimeout(() => finalize('timeout'), sessionCapMs);
      if (dailyBound) {
        const warnLeadMs = SPRECHEN_DAILY_WARNING_LEAD_SECONDS * 1000;
        if (sessionCapMs > warnLeadMs) {
          warnTimeout = setTimeout(() => {
            send({ type: 'daily_cap_warning', seconds_left: SPRECHEN_DAILY_WARNING_LEAD_SECONDS });
          }, sessionCapMs - warnLeadMs);
        } else {
          send({ type: 'daily_cap_warning', seconds_left: Math.round(sessionCapMs / 1000) });
        }
      }

      const url = 'wss://api.openai.com/v1/realtime?model=' + encodeURIComponent(SPRECHEN_OPENAI_MODEL);
      upstream = new WebSocket(url, {
        headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
      });

      upstream.on('open', () => {
        console.log('[sprechen-ws] openai realtime open');
        // Configure the examiner (GA Realtime shape): German A1 voice,
        // server-side VAD turn-taking, pcm16 in/out (24kHz), Whisper
        // transcription of the candidate locked to German (language: 'de')
        // — without this, Whisper auto-detects per-utterance and can drift
        // to another language entirely (e.g. "mein Name" → "mi nombre")
        // rather than just mishearing an accent. The prompt biases vocab
        // toward expected A1-exam German and place names.
        toUpstream({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: buildExaminerPrompt(init.topics),
            output_modalities: ['audio'],
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                transcription: { model: 'whisper-1', language: 'de', prompt: buildTranscriptionPrompt(init.topics) },
                turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
              },
              output: {
                format: { type: 'audio/pcm', rate: 24000 },
                voice: SPRECHEN_OPENAI_VOICE,
              },
            },
          },
        });
        upstreamReady = true;
        // Flush any mic audio that arrived before the session was configured.
        pendingAudio.forEach((d) => toUpstream({ type: 'input_audio_buffer.append', audio: d }));
        pendingAudio.length = 0;
        send({ type: 'ready' });
        // The examiner's opening turn is triggered on 'session.updated' (above).
      });
      upstream.on('message', (raw) => {
        let m = null; try { m = JSON.parse(raw.toString()); } catch (_) { return; }
        handleUpstream(m);
      });
      upstream.on('error', (e) => {
        console.error('[sprechen-ws] openai ws error:', e && e.message);
        send({ type: 'error', message: 'Examiner connection error.' });
      });
      upstream.on('close', (code, reason) => {
        console.log('[sprechen-ws] openai ws close', code, (reason && reason.toString().slice(0, 200)) || '');
        finalize('upstream_closed');
      });
    }

    ws.on('message', (raw) => {
      let msg = null;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (msg.type === 'init') {
        if (started) return;
        started = true;
        startSession(msg).catch((e) => { send({ type: 'error', message: e.message }); });
      } else if (msg.type === 'audio' && msg.data) {
        // server_vad auto-commits + auto-responds, so just append; no manual commit.
        if (upstreamReady) toUpstream({ type: 'input_audio_buffer.append', audio: msg.data });
        else pendingAudio.push(msg.data);
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
