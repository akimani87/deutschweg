/**
 * DeutschWeg AI Tutor
 * Drop-in chat widget for all module pages.
 * Usage: <script src="../ai-tutor.js" data-module="0"></script>
 *   or:  <script src="./ai-tutor.js"  data-module="5"></script>
 */
(function () {
  'use strict';

  var API_BASE = 'https://deutschweg.onrender.com';
  var MAX_HISTORY = 6; // messages kept for context (pairs)

  // ── Detect module number ────────────────────────────────────────────────────
  var scriptEl = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();
  var moduleNum = parseInt(scriptEl.getAttribute('data-module') || '0', 10);

  // ── Conversation history ────────────────────────────────────────────────────
  var history = [];

  // ── CSS ─────────────────────────────────────────────────────────────────────
  var css = `
    #dw-tutor-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: #c9a84c;
      border: none;
      cursor: pointer;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(201,168,76,0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 26px;
      line-height: 1;
    }
    #dw-tutor-bubble:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 8px 28px rgba(201,168,76,0.55);
    }
    #dw-tutor-bubble.open { background: #1a1a1a; color: #c9a84c; font-size: 20px; }

    #dw-tutor-window {
      position: fixed;
      bottom: 94px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 500px;
      max-height: calc(100vh - 120px);
      background: #0f0f0f;
      border: 1px solid rgba(201,168,76,0.25);
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      z-index: 9999;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      overflow: hidden;
      transform: translateY(12px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.22s cubic-bezier(0.4,0,0.2,1),
                  opacity 0.22s cubic-bezier(0.4,0,0.2,1);
    }
    #dw-tutor-window.open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    #dw-tutor-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: #141414;
      border-bottom: 1px solid rgba(201,168,76,0.15);
      flex-shrink: 0;
    }
    #dw-tutor-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(201,168,76,0.12);
      border: 1px solid rgba(201,168,76,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', serif;
      font-size: 11px;
      font-weight: 900;
      color: #c9a84c;
      flex-shrink: 0;
    }
    #dw-tutor-header-info { flex: 1; min-width: 0; }
    #dw-tutor-header-name {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #f5f0e8;
    }
    #dw-tutor-header-sub {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 1.5px;
      color: #c9a84c;
      margin-top: 1px;
    }
    #dw-tutor-close {
      background: none;
      border: none;
      color: #6b6b6b;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      transition: color 0.2s;
    }
    #dw-tutor-close:hover { color: #f5f0e8; }

    #dw-tutor-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    #dw-tutor-messages::-webkit-scrollbar { width: 4px; }
    #dw-tutor-messages::-webkit-scrollbar-track { background: transparent; }
    #dw-tutor-messages::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); border-radius: 2px; }

    .dw-msg {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 88%;
      animation: dwMsgIn 0.18s ease;
    }
    @keyframes dwMsgIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .dw-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .dw-msg.tutor { align-self: flex-start; }

    .dw-msg-av {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(201,168,76,0.1);
      border: 1px solid rgba(201,168,76,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Playfair Display', serif;
      font-size: 9px;
      font-weight: 900;
      color: #c9a84c;
      flex-shrink: 0;
    }
    .dw-msg-bubble {
      padding: 10px 13px;
      border-radius: 16px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13.5px;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .dw-msg.tutor .dw-msg-bubble {
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.07);
      color: #ede8dc;
      border-bottom-left-radius: 4px;
    }
    .dw-msg.user .dw-msg-bubble {
      background: rgba(201,168,76,0.15);
      border: 1px solid rgba(201,168,76,0.3);
      color: #f5f0e8;
      border-bottom-right-radius: 4px;
    }

    .dw-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
    }
    .dw-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #c9a84c;
      opacity: 0.4;
      animation: dwDot 1.2s ease infinite;
    }
    .dw-typing span:nth-child(2) { animation-delay: 0.2s; }
    .dw-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dwDot {
      0%, 80%, 100% { opacity: 0.4; transform: scale(1); }
      40% { opacity: 1; transform: scale(1.3); }
    }

    #dw-tutor-input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: #0f0f0f;
      flex-shrink: 0;
    }
    #dw-tutor-input {
      flex: 1;
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 13px;
      color: #f5f0e8;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      resize: none;
      max-height: 90px;
      min-height: 40px;
      line-height: 1.5;
      outline: none;
      transition: border-color 0.2s;
    }
    #dw-tutor-input:focus { border-color: rgba(201,168,76,0.4); }
    #dw-tutor-input::placeholder { color: #4a4a4a; }
    #dw-tutor-send {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #c9a84c;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
      color: #0a0a0a;
      font-size: 16px;
    }
    #dw-tutor-send:hover { background: #e8c96a; transform: scale(1.05); }
    #dw-tutor-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    @media (max-width: 480px) {
      #dw-tutor-window {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 70vh;
        max-height: 70vh;
        border-radius: 20px 20px 0 0;
      }
      #dw-tutor-bubble {
        bottom: 20px;
        right: 20px;
      }
    }
  `;

  // ── Inject CSS ───────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Level label ──────────────────────────────────────────────────────────────
  function levelLabel() {
    if (moduleNum <= 3)  return 'A1 BEGINNER';
    if (moduleNum <= 7)  return 'A1 ELEMENTARY';
    return 'A1 INTERMEDIATE';
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.id = 'dw-tutor-bubble';
  bubble.title = 'Ask the AI Tutor';
  bubble.innerHTML = '🤖';

  var win = document.createElement('div');
  win.id = 'dw-tutor-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'DeutschWeg AI Tutor');
  win.innerHTML = `
    <div id="dw-tutor-header">
      <div id="dw-tutor-avatar">DW</div>
      <div id="dw-tutor-header-info">
        <div id="dw-tutor-header-name">DeutschWeg Tutor</div>
        <div id="dw-tutor-header-sub">MODULE ${String(moduleNum).padStart(2,'0')} · ${levelLabel()}</div>
      </div>
      <button id="dw-tutor-close" title="Close">✕</button>
    </div>
    <div id="dw-tutor-messages"></div>
    <div id="dw-tutor-input-row">
      <textarea id="dw-tutor-input" placeholder="Ask anything about German…" rows="1"></textarea>
      <button id="dw-tutor-send" title="Send">➤</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(win);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  var messagesEl = win.querySelector('#dw-tutor-messages');
  var inputEl    = win.querySelector('#dw-tutor-input');
  var sendBtn    = win.querySelector('#dw-tutor-send');
  var closeBtn   = win.querySelector('#dw-tutor-close');

  // ── Wake up Render server (free tier sleeps after inactivity) ────────────────
  var serverAwake = false;
  function pingServer() {
    if (serverAwake) return;
    fetch(API_BASE + '/', { method: 'GET' })
      .then(function () { serverAwake = true; })
      .catch(function () { /* silent — will retry on first message */ });
  }
  // Ping immediately on page load so server is warm by the time student opens chat
  setTimeout(pingServer, 1500);

  // ── Open / close ─────────────────────────────────────────────────────────────
  var isOpen = false;
  function openChat() {
    isOpen = true;
    win.classList.add('open');
    bubble.classList.add('open');
    bubble.innerHTML = '✕';
    inputEl.focus();
    if (messagesEl.children.length === 0) showWelcome();
    pingServer(); // also ping when bubble is clicked in case page just loaded
  }
  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
    bubble.classList.remove('open');
    bubble.innerHTML = '🤖';
  }
  bubble.addEventListener('click', function () { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);

  // ── Welcome message ──────────────────────────────────────────────────────────
  function showWelcome() {
    var welcomes = [
      'Hallo! 👋 I\'m your DeutschWeg tutor. Ask me anything about Module ' + moduleNum + ' — grammar, pronunciation, examples — anything at all!',
      'Welcome! I\'m here to help you master German for your Goethe exam. What would you like to learn today?',
      'Guten Tag! I\'m your personal German tutor. Ask me questions about what you\'re studying and I\'ll explain it in a way that makes sense for you.'
    ];
    appendMessage('tutor', welcomes[moduleNum % welcomes.length]);
  }

  // ── Append a message bubble ──────────────────────────────────────────────────
  function appendMessage(role, text) {
    var row = document.createElement('div');
    row.className = 'dw-msg ' + role;
    if (role === 'tutor') {
      row.innerHTML = `<div class="dw-msg-av">DW</div><div class="dw-msg-bubble"></div>`;
    } else {
      row.innerHTML = `<div class="dw-msg-bubble"></div>`;
    }
    row.querySelector('.dw-msg-bubble').textContent = text;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  // ── Typing indicator ─────────────────────────────────────────────────────────
  function showTyping() {
    var row = document.createElement('div');
    row.className = 'dw-msg tutor';
    row.id = 'dw-typing-row';
    row.innerHTML = `<div class="dw-msg-av">DW</div>
      <div class="dw-msg-bubble dw-typing">
        <span></span><span></span><span></span>
      </div>`;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    var el = document.getElementById('dw-typing-row');
    if (el) el.remove();
  }

  // ── Auto-resize textarea ─────────────────────────────────────────────────────
  inputEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
  });

  // ── Send on Enter (Shift+Enter = newline) ────────────────────────────────────
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);

  // ── Send message ─────────────────────────────────────────────────────────────
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    appendMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // Add to history
    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);

    showTyping();

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, moduleNumber: moduleNum })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      hideTyping();
      var reply = data.reply || data.error || 'Sorry, something went wrong. Try again!';
      appendMessage('tutor', reply);
      history.push({ role: 'assistant', content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
    })
    .catch(function () {
      hideTyping();
      appendMessage('tutor', 'I\'m having trouble connecting right now. Check your internet connection and try again.');
    })
    .finally(function () {
      sendBtn.disabled = false;
      inputEl.focus();
    });
  }

})();
