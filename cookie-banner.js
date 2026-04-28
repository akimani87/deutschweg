/**
 * DeutschWeg cookie consent banner.
 *
 * Loads on every page; shows once until the user clicks Accept or
 * Decline. Choice is stored in localStorage.dw_cookie_consent so the
 * banner stays dismissed across visits and pages. No-op if the user
 * has already responded.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dw_cookie_consent';

  // Already decided in a previous visit — skip silently.
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch (_) {
    // Storage unavailable (private mode, sandboxed iframe). Treat as
    // first-visit but the choice won't persist; harmless.
  }

  var css = ''
    + '#dw-cookie-banner{'
    +   'position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;'
    +   'background:#1F2937;color:#fff;border-radius:14px;'
    +   'padding:14px 18px;display:flex;align-items:center;gap:14px;'
    +   'font-family:"Plus Jakarta Sans","DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
    +   'box-shadow:0 12px 36px rgba(0,0,0,0.28);'
    +   'max-width:760px;margin:0 auto;'
    +   'animation:dwCBin .25s ease;'
    + '}'
    + '@keyframes dwCBin{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}'
    + '#dw-cookie-banner-text{flex:1;min-width:0;font-size:13px;line-height:1.55;color:#E5E7EB;}'
    + '#dw-cookie-banner-text strong{color:#fff;font-weight:700;}'
    + '#dw-cookie-banner-text a{color:#93C5FD;text-decoration:underline;}'
    + '#dw-cookie-banner-text a:hover{color:#BFDBFE;}'
    + '.dw-cb-actions{display:flex;gap:8px;flex-shrink:0;}'
    + '.dw-cb-btn{'
    +   'font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;'
    +   'padding:9px 18px;border-radius:9px;border:none;line-height:1.2;'
    +   'transition:transform .15s,background .15s,border-color .15s;'
    + '}'
    + '.dw-cb-btn:hover{transform:translateY(-1px);}'
    + '.dw-cb-decline{background:transparent;color:#D1D5DB;border:1.5px solid rgba(255,255,255,0.18);}'
    + '.dw-cb-decline:hover{background:rgba(255,255,255,0.06);color:#fff;border-color:rgba(255,255,255,0.32);}'
    + '.dw-cb-accept{background:#3B82F6;color:#fff;box-shadow:0 2px 8px rgba(59,130,246,0.35);}'
    + '.dw-cb-accept:hover{background:#2563EB;}'
    + '@media (max-width:600px){'
    +   '#dw-cookie-banner{flex-direction:column;align-items:stretch;gap:10px;padding:14px 16px;}'
    +   '.dw-cb-actions{justify-content:flex-end;}'
    + '}';

  function inject() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'dw-cookie-banner';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
        '<div id="dw-cookie-banner-text">'
      +   '<strong>We use cookies and local storage</strong> to keep you signed in, '
      +   'remember your level, and track your study progress. See our '
      +   '<a href="/privacy-policy.html">Privacy Policy</a>.'
      + '</div>'
      + '<div class="dw-cb-actions">'
      +   '<button type="button" class="dw-cb-btn dw-cb-decline" id="dw-cb-decline">Decline</button>'
      +   '<button type="button" class="dw-cb-btn dw-cb-accept" id="dw-cb-accept">Accept</button>'
      + '</div>';
    document.body.appendChild(bar);

    function close(choice) {
      try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
    document.getElementById('dw-cb-accept').addEventListener('click', function () { close('accepted'); });
    document.getElementById('dw-cb-decline').addEventListener('click', function () { close('declined'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
