# DeutschWeg — Exam Whisperer Backend

Simple Node.js proxy that sits between `exam-whisperer.html` and the Claude API.
The API key never leaves the server — the browser only talks to `localhost:3000`.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API key
Open `.env` and replace `your_api_key_here` with your actual Anthropic API key:
```
CLAUDE_API_KEY=sk-ant-...
PORT=3000
```
Get a key at: https://console.anthropic.com/

### 3. Start the server
```bash
node server.js
```
You should see:
```
  ✦ DeutschWeg Exam Whisperer API
  ✦ Running at http://localhost:3000
  ✦ POST /api/score to score a Schreiben submission
```

### 4. Open the frontend
Open `exam-whisperer.html` directly in your browser (double-click the file),
or serve it with any static server:
```bash
npx serve .
```
Then visit `http://localhost:5000/exam-whisperer.html`

---

## API

### `POST /api/score`

**Request body:**
```json
{
  "text":  "Sehr geehrte Damen und Herren, ich schreibe...",
  "level": "B1"
}
```

**Response:**
```json
{
  "total": 26,
  "breakdown": {
    "task":       { "score": 7, "feedback": "..." },
    "grammar":    { "score": 5, "feedback": "..." },
    "vocabulary": { "score": 7, "feedback": "..." },
    "structure":  { "score": 7, "feedback": "..." }
  },
  "fixes": [
    { "points": 2, "category": "Grammar", "fix": "...", "wrong": "...", "correct": "..." },
    { "points": 3, "category": "Task",    "fix": "...", "wrong": "...", "correct": "..." },
    { "points": 3, "category": "Vocab",   "fix": "...", "wrong": "...", "correct": "..." }
  ],
  "corrected_version": "Full corrected text..."
}
```

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express proxy — receives student text, calls Claude, returns JSON |
| `.env` | API key and port — **never commit this** |
| `.gitignore` | Ensures `.env` and `node_modules` are excluded from git |
| `package.json` | Node dependencies |
| `exam-whisperer.html` | Frontend — calls `localhost:3000/api/score` |

---

## Security note

- The `.env` file is listed in `.gitignore` — it will never be committed.
- The browser never sees the API key — it only ever talks to your local server.
- Before deploying to production, move the server to a real backend (Vercel, Railway, etc.) and set the environment variable there.
