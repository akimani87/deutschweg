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
  // Friendly title from <title>, used to give the AI prompt human context.
  function getModuleName() {
    var t = (document.title || '').replace(/^DeutschWeg\s*[—–-]\s*/i, '').trim();
    return t || 'general German practice';
  }

  // ── Module UUID ─────────────────────────────────────────────────────────
  // Read the module's UUID from the URL's ?id= parameter (set by the
  // dynamic module.html loader). Returns null on pages that don't carry
  // an id (e.g. ai-pal.html standalone, sprechen-prep.html, etc.) — the
  // pal_errors upsert is skipped in that case.
  function getModuleId() {
    try {
      var v = new URLSearchParams(window.location.search).get('id');
      return v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
    } catch (_) {
      return null;
    }
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

  // ── Shared verb-form set ────────────────────────────────────────────────
  // Comprehensive list of finite verb forms + past participles that
  // commonly sit at the end of a German subordinate clause. Used by
  // hasSubordinateClauseError to decide whether the last word of a
  // weil/dass/wenn/obwohl clause is a verb (correct) or something else
  // (likely word-order error). Stored as a hash for O(1) lookup.
  var FINITE_VERBS_SET = (function(){
    var list = (
      // sein / haben / werden — all conjugations + participles
      'bin bist ist sind seid war warst waren wart gewesen ' +
      'habe hast hat haben habt hatte hattest hatten hattet gehabt ' +
      'werde wirst wird werden werdet wurde wurdest wurden wurdet geworden ' +
      // 6 modal verbs
      'kann kannst können könnt konnte konnten gekonnt ' +
      'muss musst müssen müsst musste mussten gemusst ' +
      'will willst wollen wollt wollte wollten gewollt ' +
      'darf darfst dürfen dürft durfte durften gedurft ' +
      'soll sollst sollen sollt sollte sollten gesollt ' +
      'mag magst mögen mögt mochte mochten gemocht ' +
      'möchte möchtest möchten möchtet ' +
      // common A1–B1 verbs in 1st/2nd/3rd sg + pl + past + participle
      'gehe gehst geht gehen ging gingen gegangen ' +
      'komme kommst kommt kommen kam kamen gekommen ' +
      'mache machst macht machen machte machten gemacht ' +
      'sage sagst sagt sagen sagte sagten gesagt ' +
      'sehe siehst sieht sehen sah sahen gesehen ' +
      'gebe gibst gibt geben gab gaben gegeben ' +
      'nehme nimmst nimmt nehmen nahm nahmen genommen ' +
      'finde findest findet finden fand fanden gefunden ' +
      'bleibe bleibst bleibt bleiben blieb blieben geblieben ' +
      'lebe lebst lebt leben lebte lebten gelebt ' +
      'wohne wohnst wohnt wohnen wohnte wohnten gewohnt ' +
      'arbeite arbeitest arbeitet arbeiten arbeitete arbeiteten gearbeitet ' +
      'lerne lernst lernt lernen lernte lernten gelernt ' +
      'spiele spielst spielt spielen spielte spielten gespielt ' +
      'esse isst essen esst aß aßen gegessen ' +
      'trinke trinkst trinkt trinken trank tranken getrunken ' +
      'kaufe kaufst kauft kaufen kaufte kauften gekauft ' +
      'fahre fährst fährt fahren fuhr fuhren gefahren ' +
      'laufe läufst läuft laufen lief liefen gelaufen ' +
      'bringe bringst bringt bringen brachte brachten gebracht ' +
      'denke denkst denkt denken dachte dachten gedacht ' +
      'glaube glaubst glaubt glauben glaubte glaubten geglaubt ' +
      'weiß weißt wissen wisst wusste wussten gewusst ' +
      'kenne kennst kennt kennen kannte kannten gekannt ' +
      'lese liest lest lesen las lasen gelesen ' +
      'schreibe schreibst schreibt schreiben schrieb schrieben geschrieben ' +
      'spreche sprichst spricht sprechen sprach sprachen gesprochen ' +
      'verstehe verstehst versteht verstehen verstand verstanden ' +
      'höre hörst hört hören hörte hörten gehört ' +
      'liebe liebst liebt lieben liebte liebten geliebt ' +
      'brauche brauchst braucht brauchen brauchte brauchten gebraucht ' +
      'helfe hilfst hilft helfen half halfen geholfen ' +
      'schlafe schläfst schläft schlafen schlief schliefen geschlafen ' +
      'regne regnest regnet regnen regnete regneten geregnet ' +
      'scheine scheinst scheint scheinen schien schienen geschienen ' +
      'tanze tanzt tanzen tanzte tanzten getanzt ' +
      'singe singst singt singen sang sangen gesungen ' +
      'reise reist reisen reiste reisten gereist ' +
      'warte wartest wartet warten wartete warteten gewartet ' +
      'koche kochst kocht kochen kochte kochten gekocht ' +
      'treffe triffst trifft treffen traf trafen getroffen ' +
      'öffne öffnest öffnet öffnen öffnete öffneten geöffnet ' +
      'schließe schließt schließen schloss schlossen geschlossen ' +
      'stehe stehst steht stehen stand standen gestanden ' +
      'sitze sitzt sitzen saß saßen gesessen ' +
      'liege liegst liegt liegen lag lagen gelegen ' +
      'tue tust tut tun tat taten getan ' +
      'antworte antwortest antwortet antworten antwortete antworteten geantwortet ' +
      'frage fragst fragt fragen fragte fragten gefragt ' +
      'rufe rufst ruft rufen rief riefen gerufen ' +
      'lache lachst lacht lachen lachte lachten gelacht ' +
      'trage trägst trägt tragen trug trugen getragen'
    ).toLowerCase().split(/\s+/);
    var set = {};
    list.forEach(function(v){ if (v) set[v] = true; });
    return set;
  })();

  // ── Subordinate-clause detector (function-based) ────────────────────────
  // Returns true when the input contains a subordinate conjunction whose
  // clause (from the conjunction up to the next comma or terminal
  // punctuation) doesn't end in a recognised verb form.
  // Catches all three patterns the user asked for:
  //   • verb in middle (not at end):    "weil ich bin krank"
  //   • verb missing entirely:          "Ich esse weil ich dick"
  //   • after dass / wenn / obwohl too: "Sie sagt dass es schön"
  function hasSubordinateClauseError(text){
    var t = String(text || '');
    var m = t.match(/\b(weil|dass|daß|wenn|obwohl|damit|während|nachdem|falls|als|sobald|bevor|seitdem|sodass)\b/i);
    if (!m) return false;
    var rest     = t.slice(m.index + m[0].length);
    var boundary = rest.search(/[,.!?]/);
    var clause   = (boundary === -1 ? rest : rest.slice(0, boundary))
      .replace(/[.!?,;:"\s]+$/g, '')
      .replace(/^\s+/, '');
    if (!clause) return false;
    var words = clause.split(/\s+/);
    if (words.length < 2) return false;            // need subject + something
    var lastWord = words[words.length - 1].toLowerCase();
    return !FINITE_VERBS_SET[lastWord];
  }

  // ── ERROR CATEGORIES (dual-layer tracker) ───────────────────────────────
  var ERROR_CATEGORIES = {
    article_masculine_accusative: {
      patterns: [/\b(der|ein)\s+\w*(mann|bruder|vater|hund|apfel|tisch)\b/i, /einen?\s+\w+en\b/i],
      session: 0, dbCount: 0
    },
    verb_position: {
      patterns: [/^(morgen|heute|gestern|dann|danach|trotzdem)\s+ich\s+/i],
      session: 0, dbCount: 0
    },
    verb_conjugation: {
      // ich + bare infinitive (subject-verb agreement). Broadened from
      // 8 to ~75 common A1–B2 infinitives so natural sentences like
      // "ich essen", "ich verstehen", "ich bezahlen" all surface.
      patterns: [/\bich\s+(gehen|kommen|machen|haben|sein|spielen|lernen|arbeiten|essen|trinken|laufen|fahren|sehen|geben|nehmen|finden|lieben|brauchen|wohnen|schreiben|lesen|sprechen|denken|verstehen|sagen|fragen|kennen|wissen|hören|glauben|leben|schlafen|helfen|kaufen|kochen|tanzen|singen|reisen|warten|treffen|öffnen|schließen|stehen|sitzen|liegen|tragen|fallen|steigen|fliegen|schwimmen|bezahlen|verlieren|gewinnen|reden|antworten|bestellen|reservieren|tun|werden|bringen|holen|stellen|legen|setzen|hängen|wählen|möchten|können|müssen|wollen|dürfen|sollen|mögen|rufen|lachen|bleiben|heißen|regnen|scheinen)\b/i],
      session: 0, dbCount: 0
    },
    perfekt_auxiliary: {
      patterns: [/\bhabe\s+(gegangen|gefahren|gelaufen|gekommen|geblieben)\b/i, /\bbin\s+(gespielt|gemacht|gelernt|gearbeitet|gekauft)\b/i],
      session: 0, dbCount: 0
    },
    subordinate_clause_word_order: {
      // Function detector: fires whenever a subordinate clause introduced
      // by weil/dass/wenn/obwohl/damit/während/nachdem/falls/als/sobald/
      // bevor/seitdem/sodass doesn't end with a recognised verb form.
      // Subsumes the previous two narrow regexes — handles verb-in-3rd-
      // position, missing-verb-entirely, and any non-verb at clause end.
      patterns: [hasSubordinateClauseError],
      session: 0, dbCount: 0
    },
    preposition_pattern: {
      patterns: [/\bin\s+(schule|arbeit|markt|stadt|kirche)\b/i, /\bnach\s+(hause)\b/i],
      session: 0, dbCount: 0
    }
  };

  // Module pages don't currently load supabase-js; fall back to session-only
  // tracking silently when the global client isn't present.
  function getSupabase(){
    return (typeof dwSupabase !== 'undefined') ? dwSupabase : null;
  }

  function detectError(userMessage){
    console.log('[ai-pal-widget] detectError scanning:', JSON.stringify(userMessage));
    var detected = null;
    Object.keys(ERROR_CATEGORIES).forEach(function(category){
      var data = ERROR_CATEGORIES[category];
      // Walk patterns in order; one hit per category counts as one
      // session occurrence — break to avoid double-counting if multiple
      // patterns within the same category match the same input.
      for (var i = 0; i < data.patterns.length; i++){
        var pattern = data.patterns[i];
        var hit = (typeof pattern === 'function')
          ? !!pattern(userMessage)
          : pattern.test(userMessage);
        if (hit){
          data.session++;
          detected = { category: category, sessionCount: data.session };
          console.log('[ai-pal-widget] ✓ matched category=' + category + ' (pattern #' + i + ', session count=' + data.session + ')');
          break;
        }
      }
    });
    if (!detected) console.log('[ai-pal-widget] no error category matched');
    return detected;
  }

  // Cached top-3 weak spots, sent into the system prompt on every request.
  // Populated once on session start; kept fresh by the optimistic bump in
  // saveErrorToDatabase so the next message reflects the just-made error.
  var topErrors = [];

  function recomputeTopErrors(){
    var rows = Object.keys(ERROR_CATEGORIES).map(function(cat){
      return { category: cat, count: ERROR_CATEGORIES[cat].dbCount || 0 };
    }).filter(function(r){ return r.count > 0; });
    rows.sort(function(a, b){ return b.count - a.count; });
    topErrors = rows.slice(0, 3);
  }

  function saveErrorToDatabase(category, moduleId, userLevel){
    console.log('[ai-pal-widget] saveErrorToDatabase START — category=' + category + ', module=' + moduleId + ', level=' + userLevel);

    // Skip-silent guards. The pal_errors upsert needs both a real
    // module UUID (from ?id= on a module page) and an authenticated
    // user. If either is missing, we never even build a payload —
    // session-layer counters keep ticking, but no DB write happens.
    if (!moduleId) {
      console.log('[ai-pal-widget] save skipped — no module UUID (page has no ?id= or it is malformed)');
      return Promise.resolve(null);
    }
    var sb = getSupabase();
    if (!sb) {
      console.log('[ai-pal-widget] save skipped — dwSupabase global is missing');
      return Promise.resolve(null);
    }

    return sb.auth.getUser().then(function(res){
      var user = res && res.data && res.data.user;
      if (!user) {
        console.log('[ai-pal-widget] save skipped — no authenticated user');
        return null;
      }
      console.log('[ai-pal-widget] auth.getUser OK — user.id=' + user.id);

      var payload = {
        user_id:        user.id,
        error_category: category,
        count:          1,
        last_seen:      new Date().toISOString(),
        module_id:      moduleId,
        user_level:     userLevel || 'A1'
      };
      console.log('[ai-pal-widget] upsert pal_errors →', payload);

      return sb.from('pal_errors').upsert(payload, {
        onConflict:       'user_id,error_category',
        ignoreDuplicates: false
      }).select().then(function(out){
        if (out.error){
          console.error('[ai-pal-widget] upsert FAILED', {
            message: out.error.message,
            code:    out.error.code,
            details: out.error.details,
            hint:    out.error.hint,
            status:  out.status
          });
          return null;
        }
        console.log('[ai-pal-widget] ✓ upsert OK — row:', out.data && out.data[0]);

        if (ERROR_CATEGORIES[category]){
          ERROR_CATEGORIES[category].dbCount = (ERROR_CATEGORIES[category].dbCount || 0) + 1;
          recomputeTopErrors();
        }
        return sb.rpc('increment_pal_error', {
          p_user_id:  user.id,
          p_category: category
        }).then(function(rpcRes){
          if (rpcRes.error) console.error('[ai-pal-widget] increment_pal_error RPC FAILED', rpcRes.error);
          else               console.log('[ai-pal-widget] ✓ increment_pal_error RPC OK');
          return rpcRes;
        });
      });
    }).catch(function(e){
      console.error('[ai-pal-widget] save threw:', e);
      return null;
    });
  }

  // One-shot load on session start: populates dbCount per category and
  // seeds the topErrors cache used in every API call.
  function loadErrorsFromDatabase(){
    console.log('[ai-pal-widget] loadErrorsFromDatabase START');
    var sb = getSupabase();
    if (!sb) {
      console.warn('[ai-pal-widget] load aborted — dwSupabase global is missing');
      return Promise.resolve();
    }

    return sb.auth.getUser().then(function(res){
      var user = res && res.data && res.data.user;
      if (!user) {
        console.warn('[ai-pal-widget] load aborted — no authenticated user');
        return;
      }
      console.log('[ai-pal-widget] load auth OK — user.id=' + user.id);

      return sb.from('pal_errors')
        .select('error_category, count')
        .eq('user_id', user.id)
        .order('count', { ascending: false })
        .then(function(out){
          if (out.error){
            console.error('[ai-pal-widget] load FAILED', out.error);
            return;
          }
          var rows = out.data || [];
          rows.forEach(function(row){
            if (ERROR_CATEGORIES[row.error_category]){
              ERROR_CATEGORIES[row.error_category].dbCount = row.count;
            }
          });
          recomputeTopErrors();
          console.log('[ai-pal-widget] ✓ loaded ' + rows.length + ' past error categories, top 3:', topErrors);
        });
    }).catch(function(e){
      console.error('[ai-pal-widget] load threw:', e);
    });
  }

  // Kick off the one-shot load now (session start).
  loadErrorsFromDatabase();

  function getErrorContext(detected){
    if (!detected) return '';
    var category     = detected.category;
    var sessionCount = detected.sessionCount;
    var dbCount      = (ERROR_CATEGORIES[category] && ERROR_CATEGORIES[category].dbCount) || 0;
    var total        = sessionCount + dbCount;

    if (sessionCount === 2){
      return '\n\nNOTE: Student repeated "' + category + '" mistake ' + sessionCount + ' times this session. Use Template 4 (⚠️ Same pattern again).';
    }
    if (total >= 3){
      return '\n\nNOTE: Student has made "' + category + '" mistake ' + total + ' times total (' + sessionCount + ' this session, ' + dbCount + ' previous sessions). Use Template 4 AND end with "Need more help? → Ask Tutor 👩‍🏫".';
    }
    return '\n\nNOTE: Student made a "' + category + '" mistake. Use Template 1 (Correction).';
  }

  // loadErrorsFromDatabase already ran once at session start, so we rely
  // on the cached dbCounts here (kept fresh by saveErrorToDatabase's
  // optimistic bump). No per-message round trip.
  function handleUserMessage(userMessage, moduleId, userLevel){
    var detected = detectError(userMessage);
    if (detected){
      saveErrorToDatabase(detected.category, moduleId, userLevel);
    }
    return Promise.resolve(getErrorContext(detected));
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

    var moduleName = getModuleName();   // friendly title — for the AI prompt only
    var moduleId   = getModuleId();      // UUID from ?id= — for the pal_errors row
    var levelNow   = getLevel();

    handleUserMessage(text, moduleId, levelNow).then(function(errorContext){
      return fetch(API_BASE + '/api/aipal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages:       history,
          level:          levelNow,
          module:         moduleName,
          errorContext:   errorContext || '',
          userTopErrors:  topErrors
        })
      });
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
