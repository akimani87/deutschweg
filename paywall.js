/**
 * DeutschWeg — Paywall (gating only, no payments yet)
 *
 * Single source of truth for:
 *   1. Which products exist + their unlock copy/price.
 *   2. hasAccess(user, productKey) — does this user own this product?
 *   3. dwPaywall.gate(...) — drop-in unlock screen renderer.
 *
 * No payment integration yet. The "Freischalten" button just goes to a
 * placeholder URL (/freischalten/<key>) — we'll wire LemonSqueezy later.
 *
 * Depends on: window.dwSupabase (Supabase client).
 */
(function() {
  'use strict';

  // ── Product catalog ────────────────────────────────────────────────────────
  // Single place to edit prices, titles, and unlock copy. The unlock screen
  // reads everything from this map; nothing else in the codebase should
  // hard-code a price.
  //
  // Levels (A2/B1/B2) and Exam Whisperer per level are the only paid SKUs
  // for now. A1 is intentionally absent — A1 is always free and never gated.
  var CATALOG = {
    a2_module: {
      level:        'A2',
      kind:         'module',
      title:        'A2 freischalten',
      valueLine:    'Alle A2-Module — einmalig 19 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/a2'
    },
    b1_module: {
      level:        'B1',
      kind:         'module',
      title:        'B1 freischalten',
      valueLine:    'Alle B1-Module — einmalig 24 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/b1'
    },
    b2_module: {
      level:        'B2',
      kind:         'module',
      title:        'B2 freischalten',
      valueLine:    'Alle B2-Module — einmalig 29 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/b2'
    },
    examwhisperer_a2: {
      level:        'A2',
      kind:         'examwhisperer',
      title:        'Exam Whisperer A2 freischalten',
      valueLine:    'AI-Bewertung für A2-Schreiben — einmalig 19 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/examwhisperer-a2'
    },
    examwhisperer_b1: {
      level:        'B1',
      kind:         'examwhisperer',
      title:        'Exam Whisperer B1 freischalten',
      valueLine:    'AI-Bewertung für B1-Schreiben — einmalig 19 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/examwhisperer-b1'
    },
    examwhisperer_b2: {
      level:        'B2',
      kind:         'examwhisperer',
      title:        'Exam Whisperer B2 freischalten',
      valueLine:    'AI-Bewertung für B2-Schreiben — einmalig 19 €',
      ctaLabel:     'Freischalten',
      placeholder:  '/freischalten/examwhisperer-b2'
    }
  };

  // ── Key builders ───────────────────────────────────────────────────────────
  function moduleKeyForLevel(level) {
    var lvl = String(level || '').toUpperCase();
    if (lvl === 'A1') return null;                 // A1 is always free
    return lvl.toLowerCase() + '_module';          // a2_module, b1_module, b2_module
  }
  function whispererKeyForLevel(level) {
    var lvl = String(level || '').toUpperCase();
    if (lvl === 'A1') return null;                 // A1 whisperer is also free
    return 'examwhisperer_' + lvl.toLowerCase();
  }

  // ── Access check ───────────────────────────────────────────────────────────
  // Returns a Promise<boolean>.
  //   - Free products (null key, A1) → true
  //   - Anonymous (no user) → false (caller decides whether to bounce to signup)
  //   - Otherwise: existence of a row in entitlements.
  //
  // RLS: with the standard "user can read own entitlements" policy, an
  // anonymous client can't read this table at all (which is the desired
  // behaviour — they shouldn't be able to enumerate entitlements). We short-
  // circuit on `!user` before issuing the query.
  function hasAccess(user, productKey) {
    if (!productKey) return Promise.resolve(true); // null = free
    if (!user || !user.id) return Promise.resolve(false);
    if (typeof window.dwSupabase === 'undefined') return Promise.resolve(false);

    return window.dwSupabase
      .from('entitlements')
      .select('id', { head: false, count: 'exact' })
      .eq('user_id',     user.id)
      .eq('product_key', productKey)
      .limit(1)
      .then(function(res) {
        if (res.error) {
          console.warn('[paywall] entitlement read failed:', res.error.message);
          // Fail closed: pretend they don't have access. The unlock screen is
          // a softer failure mode than accidentally giving away paid content.
          return false;
        }
        return Array.isArray(res.data) && res.data.length > 0;
      })
      .catch(function(e) {
        console.warn('[paywall] entitlement read threw:', e && e.message);
        return false;
      });
  }

  // ── Unlock screen renderer ─────────────────────────────────────────────────
  // Renders into a given container element (innerHTML replacement). Uses the
  // shared deutschweg-theme.css tokens via inline CSS-vars so it picks up the
  // current page's palette without needing a separate stylesheet.
  function renderUnlockScreen(container, productKey, opts) {
    var meta = CATALOG[productKey];
    if (!meta) {
      console.warn('[paywall] unknown product key:', productKey);
      return;
    }
    opts = opts || {};
    var backHref  = opts.backHref  || '/dashboard';
    var backLabel = opts.backLabel || '← Zurück zum Dashboard';
    var anon      = !!opts.anonymous;

    var anonNote = anon
      ? '<div style="margin-top:14px;font-size:13px;color:#9CA3AF;line-height:1.6;">'
        + 'Noch kein Konto? <a href="signup.html" style="color:#3B82F6;font-weight:600;text-decoration:none;">Kostenlos anmelden</a> '
        + '— A1 ist immer frei.'
        + '</div>'
      : '';

    container.innerHTML =
      '<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;">' +
        '<div style="max-width:440px;width:100%;background:#fff;border:1px solid #E5E7EB;border-radius:20px;padding:36px 32px;box-shadow:0 4px 16px rgba(0,0,0,0.07);text-align:center;">' +
          '<div style="width:64px;height:64px;border-radius:50%;background:#EFF6FF;border:1px solid #DBEAFE;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 18px;">🔒</div>' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#3B82F6;text-transform:uppercase;margin-bottom:10px;">' + escapeHtml(meta.level) + ' · ' + (meta.kind === 'module' ? 'Modul' : 'Exam Whisperer') + '</div>' +
          '<h1 style="font-size:24px;font-weight:800;color:#1F2937;line-height:1.25;margin-bottom:12px;letter-spacing:-0.3px;">' + escapeHtml(meta.title) + '</h1>' +
          '<p style="font-size:15px;color:#4B5563;line-height:1.65;margin-bottom:24px;">' + escapeHtml(meta.valueLine) + '</p>' +
          '<a href="' + escapeAttr(meta.placeholder) + '" data-dw-unlock="' + escapeAttr(productKey) + '" style="display:block;width:100%;background:#3B82F6;color:#fff;padding:14px 22px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(59,130,246,0.3);transition:background .18s, transform .18s;">' + escapeHtml(meta.ctaLabel) + ' →</a>' +
          '<a href="' + escapeAttr(backHref) + '" style="display:inline-block;margin-top:16px;font-size:13px;color:#6B7280;text-decoration:none;">' + escapeHtml(backLabel) + '</a>' +
          anonNote +
        '</div>' +
      '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── Convenience: one-call gate ─────────────────────────────────────────────
  // gate({ container, productKey, user, onAllowed, backHref })
  //   - If access is granted: calls onAllowed() and returns.
  //   - Otherwise: replaces container's contents with the unlock screen.
  //
  // Designed so callers can do:
  //   dwPaywall.gate({ container: mainEl, productKey: 'a2_module', user: state.user, onAllowed: render });
  function gate(opts) {
    opts = opts || {};
    var key = opts.productKey;
    var container = opts.container;
    var user = opts.user;
    var onAllowed = opts.onAllowed || function() {};

    if (!key) { onAllowed(); return; }            // free
    hasAccess(user, key).then(function(ok) {
      if (ok) { onAllowed(); return; }
      if (container) {
        renderUnlockScreen(container, key, {
          anonymous: !user,
          backHref:  opts.backHref,
          backLabel: opts.backLabel
        });
      }
      if (typeof opts.onDenied === 'function') opts.onDenied();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.dwPaywall = {
    catalog:             CATALOG,
    hasAccess:           hasAccess,
    moduleKeyForLevel:   moduleKeyForLevel,
    whispererKeyForLevel: whispererKeyForLevel,
    renderUnlockScreen:  renderUnlockScreen,
    gate:                gate
  };
})();
