/**
 * DeutschWeg — Paywall guard for static (legacy) lesson pages.
 *
 * The dynamic loader (module.html) already gates A2/B1/B2 via paywall.js.
 * The old standalone pages (module-b1-*, module-b2-*, mini-test-a2/b1/b2-*,
 * mock-exam-a2/b1, module24-mock-exam) had NO gate and were reachable by
 * direct URL — free paid content. This guard closes that hole.
 *
 * Drop into a paid static page with a single tag in <head>:
 *   <script src="./paywall-guard.js"></script>
 *
 * It:
 *   1. Infers the level (A2/B1/B2) from the page filename. A1/free → no-op.
 *   2. Hides the page immediately (fail-closed — content stays hidden unless
 *      access is explicitly confirmed).
 *   3. Lazy-loads supabase-js + supabase-config.js + paywall.js if absent.
 *   4. Checks the level's module entitlement. Owner/entitled → reveal;
 *      otherwise → replace the page with the standard unlock screen.
 *
 * Only injected into paid pages, so the filename inference only ever needs to
 * be right for those — and every paid filename carries a b1/b2/a2 token.
 */
(function () {
  'use strict';

  function levelFromPath() {
    var p = (location.pathname || '').toLowerCase();
    // Legacy numbered pages (no level token in the filename): the old combined
    // course. module0–12 = A1 (free), module13–24 = A2 (incl. the A2 mock at
    // 24), module25–27 = B1 (Konjunktiv II / Passiv / Relativsätze).
    var m = p.match(/module(\d+)-/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n <= 12) return null;
      if (n <= 24) return 'A2';
      if (n <= 27) return 'B1';
    }
    if (p.indexOf('b2') !== -1) return 'B2';
    if (p.indexOf('b1') !== -1) return 'B1';
    if (p.indexOf('a2') !== -1) return 'A2';
    return null; // A1 / free → never gate
  }

  // An explicit window.DW_PAGE_LEVEL (set inline before this script) wins.
  var level = (typeof window.DW_PAGE_LEVEL === 'string' && /^(A2|B1|B2)$/.test(window.DW_PAGE_LEVEL))
    ? window.DW_PAGE_LEVEL
    : levelFromPath();
  if (!level) return;

  // Hide immediately so paid content never flashes. Fail-closed: if anything
  // below throws before we decide, the page stays hidden / shows the lock.
  var de = document.documentElement;
  var prevVis = de.style.visibility;
  de.style.visibility = 'hidden';
  function reveal() { de.style.visibility = prevVis || ''; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function ensureDeps() {
    var chain = Promise.resolve();
    if (typeof window.supabase === 'undefined' && typeof window.dwSupabase === 'undefined') {
      chain = chain.then(function () { return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'); });
    }
    chain = chain.then(function () { if (typeof window.dwSupabase === 'undefined') return loadScript('./supabase-config.js'); });
    chain = chain.then(function () { if (typeof window.dwPaywall === 'undefined') return loadScript('./paywall.js'); });
    return chain;
  }

  function showUnlock(user) {
    var key = (window.dwPaywall && window.dwPaywall.moduleKeyForLevel)
      ? window.dwPaywall.moduleKeyForLevel(level)
      : (level.toLowerCase() + '_module');
    document.body.innerHTML = '<div id="dw-gate-root"></div>';
    reveal();
    var root = document.getElementById('dw-gate-root');
    if (window.dwPaywall && window.dwPaywall.renderUnlockScreen && key) {
      window.dwPaywall.renderUnlockScreen(root, key, {
        anonymous: !user,
        backHref: '/dashboard',
        backLabel: '← Back to Dashboard'
      });
    } else {
      root.innerHTML = '<div style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;'
        + 'font-family:\'Plus Jakarta Sans\',sans-serif;text-align:center;color:#1F2937;">'
        + '<div><div style="font-size:40px;margin-bottom:12px;">🔒</div>'
        + '<div style="font-weight:800;font-size:18px;margin-bottom:8px;">This ' + level + ' content is locked.</div>'
        + '<a href="/dashboard" style="color:#3B82F6;font-weight:700;text-decoration:none;">← Back to Dashboard</a></div></div>';
    }
  }

  function run() {
    ensureDeps().then(function () {
      var key = window.dwPaywall.moduleKeyForLevel(level);
      if (!key) { reveal(); return; }            // safety: free level
      var sb = window.dwSupabase;
      var getUser = (sb && sb.auth && sb.auth.getUser)
        ? sb.auth.getUser()
        : Promise.resolve({ data: { user: null } });
      return getUser.then(function (res) {
        var user = res && res.data && res.data.user;
        return window.dwPaywall.hasAccess(user, key).then(function (ok) {
          if (ok) reveal(); else showUnlock(user);
        });
      });
    }).catch(function (e) {
      // Fail closed — show the lock screen rather than leak paid content.
      try { showUnlock(null); } catch (_) { reveal(); }
      if (window.console) console.warn('[paywall-guard]', e && e.message);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
