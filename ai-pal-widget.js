/**
 * DeutschWeg AI Pal — floating widget
 * Drop into any module page with: <script src="./ai-pal-widget.js"></script>
 *
 * Reads document.title for the {MODULE} context, level from localStorage
 * (key: dw_ai_pal_level), keeps last 6 messages, and refers complex
 * questions to ai-tutor.html.
 */
(function () {
  'use strict';

  var API_BASE = 'https://deutschweg.onrender.com';
  var LS_KEY   = 'dw_ai_pal_level';
  var LEVELS   = ['A1','A2','B1','B2'];

  // ── Module name ─────────────────────────────────────────────────────────
  function getModuleName() {
    var t = (document.title || '').replace(/^DeutschWeg\s*[—–-]\s*/i, '').trim();
    return t || 'general German practice';
  }

  // ── Level (read from localStorage, default A1) ──────────────────────────
  function getLevel() {
    try {
      var v = localStorage.getItem(LS_KEY);
      if (v && LEVELS.indexOf(v) !== -1) return v;
    } catch (_) {}
    return 'A1';
  }

  // ── History (last 6 messages — short memory by design) ──────────────────
  var history = [];
  function pushHistory(role, content) {
    history.push({ role: role, content: content });
    if (history.length > 6) history = history.slice(history.length - 6);
  }

  // ── CSS ─────────────────────────────────────────────────────────────────
  var css = ''
    + '#aip-bubble{'
    +   'position:fixed;bottom:84px;right:18px;width:54px;height:54px;border-radius:50%;'
    +   'background:#3B82F6;color:#fff;border:none;cursor:pointer;z-index:9998;'
    +   'display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;'
    +   'box-shadow:0 6px 20px rgba(59,130,246,0.45);'
    +   'transition:transform .2s,box-shadow .2s,background .2s;'
    + '}'
    + '#aip-bubble:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 10px 28px rgba(59,130,246,0.55);}'
    + '#aip-bubble.open{background:#1F2937;font-size:18px;}'

    + '#aip-card{'
    +   'position:fixed;bottom:148px;right:18px;width:320px;max-width:calc(100vw - 32px);'
    +   'height:380px;max-height:calc(100vh - 200px);'
    +   'background:#fff;border:1px solid #E5E7EB;border-radius:18px;'
    +   'display:flex;flex-direction:column;z-index:9999;overflow:hidden;'
    +   'box-shadow:0 18px 48px rgba(0,0,0,0.18);'
    +   'transform:translateY(12px) scale(0.97);opacity:0;pointer-events:none;'
    +   'transition:transform .22s cubic-bezier(0.4,0,0.2,1),opacity .22s cubic-bezier(0.4,0,0.2,1);'
    +   'font-family:"Plus Jakarta Sans","DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
    +   'color:#1F2937;'
    + '}'
    + '#aip-card.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}'

    + '.aip-header{'
    +   'display:flex;align-items:center;gap:10px;padding:12px 14px;'
    +   'background:linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%);color:#fff;flex-shrink:0;'
    + '}'
    + '.aip-av-h{width:32px;height:32px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.18);}'
    + '.aip-title{flex:1;min-width:0;}'
    + '.aip-name{font-size:14px;font-weight:800;letter-spacing:-0.2px;line-height:1.2;}'
    + '.aip-sub{font-size:10px;font-weight:600;color:rgba(255,255,255,0.85);margin-top:2px;letter-spacing:0.3px;}'
    + '.aip-close{background:rgba(255,255,255,0.16);border:none;color:#fff;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .2s;}'
    + '.aip-close:hover{background:rgba(255,255,255,0.28);}'

    + '.aip-msgs{flex:1;overflow-y:auto;padding:12px 12px 8px;display:flex;flex-direction:column;gap:8px;background:#F8FAFC;-webkit-overflow-scrolling:touch;}'
    + '.aip-msgs::-webkit-scrollbar{width:4px;}'
    + '.aip-msgs::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:2px;}'

    + '.aip-msg{display:flex;align-items:flex-end;gap:6px;max-width:92%;animation:aipIn .2s ease;}'
    + '@keyframes aipIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}'
    + '.aip-msg.user{align-self:flex-end;flex-direction:row-reverse;}'
    + '.aip-msg.pal{align-self:flex-start;}'
    + '.aip-msg-av{width:24px;height:24px;border-radius:50%;background:#EFF6FF;border:1px solid #DBEAFE;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}'

    + '.aip-bubble-wrap{display:flex;flex-direction:column;gap:4px;align-items:flex-start;min-width:0;}'
    + '.aip-bubble{padding:8px 11px;border-radius:14px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}'
    + '.aip-msg.pal .aip-bubble{background:#fff;border:1px solid #E5E7EB;color:#1F2937;border-bottom-left-radius:5px;}'
    + '.aip-msg.user .aip-bubble{background:#3B82F6;color:#fff;border-bottom-right-radius:5px;box-shadow:0 1px 4px rgba(59,130,246,0.25);}'

    + '.aip-ask-tutor{'
    +   'background:#fff;border:1px solid #DBEAFE;color:#3B82F6;'
    +   'border-radius:11px;padding:4px 10px;font-size:11px;font-weight:700;'
    +   'text-decoration:none;align-self:flex-start;line-height:1.3;'
    +   'transition:all .18s ease;cursor:pointer;font-family:inherit;'
    + '}'
    + '.aip-ask-tutor:hover{background:#EFF6FF;border-color:#3B82F6;}'

    + '.aip-typing{display:flex;align-items:center;gap:4px;padding:10px 13px;}'
    + '.aip-typing span{width:5px;height:5px;border-radius:50%;background:#94A3B8;opacity:0.5;animation:aipDot 1.2s ease infinite;}'
    + '.aip-typing span:nth-child(2){animation-delay:.2s;}'
    + '.aip-typing span:nth-child(3){animation-delay:.4s;}'
    + '@keyframes aipDot{0%,80%,100%{opacity:0.4;transform:scale(1);}40%{opacity:1;transform:scale(1.3);}}'

    + '.aip-input-row{display:flex;align-items:flex-end;gap:6px;padding:8px 10px 10px;border-top:1px solid #E5E7EB;background:#fff;flex-shrink:0;}'
    + '.aip-input{'
    +   'flex:1;background:#F1F5F9;border:1.5px solid transparent;border-radius:16px;'
    +   'padding:8px 12px;font-family:inherit;font-size:13px;line-height:1.4;'
    +   'color:#1F2937;resize:none;max-height:80px;min-height:36px;outline:none;'
    +   'transition:border-color .2s,background .2s;'
    + '}'
    + '.aip-input:focus{border-color:#3B82F6;background:#fff;}'
    + '.aip-input::placeholder{color:#94A3B8;}'
    + '.aip-send{width:36px;height:36px;border-radius:50%;background:#3B82F6;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:all .2s;box-shadow:0 2px 6px rgba(59,130,246,0.3);}'
    + '.aip-send:hover{background:#2563EB;transform:translateY(-1px);}'
    + '.aip-send:disabled{opacity:0.5;cursor:not-allowed;transform:none;}'

    + '.aip-welcome{text-align:center;padding:14px 12px 6px;color:#475569;}'
    + '.aip-welcome-emoji{font-size:34px;margin-bottom:6px;}'
    + '.aip-welcome-title{font-size:14px;font-weight:800;color:#1F2937;margin-bottom:4px;}'
    + '.aip-welcome-sub{font-size:12px;line-height:1.55;}'

    + '@media (max-width:380px){'
    +   '#aip-card{right:10px;width:calc(100vw - 20px);bottom:148px;}'
    +   '#aip-bubble{right:14px;bottom:80px;}'
    + '}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Build DOM ───────────────────────────────────────────────────────────
  var bubble = document.createElement('button');
  bubble.id = 'aip-bubble';
  bubble.type = 'button';
  bubble.title = 'Ask AI Pal';
  bubble.setAttribute('aria-label', 'Open AI Pal');
  bubble.innerHTML = '🤖';

  var card = document.createElement('div');
  card.id = 'aip-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'AI Pal chat');
  card.innerHTML =
      '<div class="aip-header">'
    +   '<div class="aip-av-h">🤖</div>'
    +   '<div class="aip-title">'
    +     '<div class="aip-name">AI Pal</div>'
    +     '<div class="aip-sub">QUICK HINTS · LEVEL <span id="aip-lvl"></span></div>'
    +   '</div>'
    +   '<button class="aip-close" type="button" id="aip-close" aria-label="Close">✕</button>'
    + '</div>'
    + '<div class="aip-msgs" id="aip-msgs">'
    +   '<div class="aip-welcome" id="aip-welcome">'
    +     '<div class="aip-welcome-emoji">🤖</div>'
    +     '<div class="aip-welcome-title">Stuck on this lesson?</div>'
    +     '<div class="aip-welcome-sub">Ask me a quick question. I keep it short — full explanations live in the AI Tutor.</div>'
    +   '</div>'
    + '</div>'
    + '<div class="aip-input-row">'
    +   '<textarea class="aip-input" id="aip-input" placeholder="Quick question…" rows="1"></textarea>'
    +   '<button class="aip-send" type="button" id="aip-send" aria-label="Send">➤</button>'
    + '</div>';

  document.body.appendChild(bubble);
  document.body.appendChild(card);

  // ── Refs ────────────────────────────────────────────────────────────────
  var msgsEl   = card.querySelector('#aip-msgs');
  var welcome  = card.querySelector('#aip-welcome');
  var inputEl  = card.querySelector('#aip-input');
  var sendBtn  = card.querySelector('#aip-send');
  var closeBtn = card.querySelector('#aip-close');
  var lvlEl    = card.querySelector('#aip-lvl');
  lvlEl.textContent = getLevel();

  // ── Open / close ────────────────────────────────────────────────────────
  var isOpen = false;
  function openCard() {
    isOpen = true;
    card.classList.add('open');
    bubble.classList.add('open');
    bubble.innerHTML = '✕';
    bubble.setAttribute('aria-label', 'Close AI Pal');
    lvlEl.textContent = getLevel();
    // wake server when opening
    fetch(API_BASE + '/').catch(function(){});
    setTimeout(function(){ inputEl.focus(); }, 80);
  }
  function closeCard() {
    isOpen = false;
    card.classList.remove('open');
    bubble.classList.remove('open');
    bubble.innerHTML = '🤖';
    bubble.setAttribute('aria-label', 'Open AI Pal');
  }
  bubble.addEventListener('click', function(){ isOpen ? closeCard() : openCard(); });
  closeBtn.addEventListener('click', closeCard);

  // ── Auto-resize input ───────────────────────────────────────────────────
  inputEl.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });
  inputEl.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);

  // ── Render bubbles ──────────────────────────────────────────────────────
  function dropWelcome() {
    if (welcome && welcome.parentNode) {
      welcome.parentNode.removeChild(welcome);
      welcome = null;
    }
  }
  function appendUser(text){
    dropWelcome();
    var row = document.createElement('div');
    row.className = 'aip-msg user';
    row.innerHTML = '<div class="aip-bubble"></div>';
    row.querySelector('.aip-bubble').textContent = text;
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function appendPal(text){
    dropWelcome();
    var row = document.createElement('div');
    row.className = 'aip-msg pal';
    row.innerHTML =
        '<div class="aip-msg-av">🤖</div>'
      + '<div class="aip-bubble-wrap">'
      +   '<div class="aip-bubble"></div>'
      +   '<a class="aip-ask-tutor" href="ai-tutor.html">Ask Tutor 👩‍🏫</a>'
      + '</div>';
    row.querySelector('.aip-bubble').textContent = text;
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function showTyping(){
    var row = document.createElement('div');
    row.className = 'aip-msg pal';
    row.id = 'aip-typing';
    row.innerHTML = '<div class="aip-msg-av">🤖</div><div class="aip-bubble aip-typing"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping(){
    var t = document.getElementById('aip-typing');
    if (t) t.remove();
  }

  // ── Send ────────────────────────────────────────────────────────────────
  function send(){
    var text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    appendUser(text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    pushHistory('user', text);
    showTyping();

    fetch(API_BASE + '/api/aipal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messages: history,
        level:    getLevel(),
        module:   getModuleName()
      })
    })
    .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
    .then(function(res){
      hideTyping();
      if (res.ok && res.body && res.body.reply){
        appendPal(res.body.reply);
        pushHistory('assistant', res.body.reply);
      } else {
        var msg = (res.body && res.body.error) ? res.body.error : 'Oops — something went wrong. Try again!';
        appendPal(msg);
      }
    })
    .catch(function(){
      hideTyping();
      appendPal('Connection issue. Check your internet and try again.');
    })
    .finally(function(){
      sendBtn.disabled = false;
      inputEl.focus();
    });
  }
})();
