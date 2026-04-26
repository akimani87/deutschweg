#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Replace sq- quizzes in all 14 B2 modules with proper Uebungsaufgaben
using the same pattern as A1/A2/B1 modules.
"""
import os, re, json

BASE = os.path.dirname(os.path.abspath(__file__))

# ─────────────────── CSS for new quiz (dark theme) ────────────────────
UBQ_CSS = """\n  /* ===== UEBUNGSAUFGABEN ===== */
  .ubq-wrap{margin-top:32px;}
  .ubq-qnum{font-family:'DM Mono',monospace;font-size:11px;color:var(--blue);letter-spacing:2px;margin-bottom:8px;}
  .ubq-dots{display:flex;gap:6px;margin-bottom:16px;}
  .ubq-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.15);transition:all 0.3s;}
  .ubq-dot.active{background:var(--blue);width:20px;border-radius:4px;}
  .ubq-dot.done{background:var(--green);}
  .ubq-dot.wrong-dot{background:var(--red);}
  .ubq-q{font-family:'Playfair Display',serif;font-size:19px;margin-bottom:14px;line-height:1.45;white-space:pre-line;}
  .ubq-opts{display:flex;flex-direction:column;gap:10px;margin-bottom:14px;}
  .ubq-opt{padding:13px 18px;border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all 0.2s;font-size:14px;background:transparent;color:var(--white);font-family:'DM Sans',sans-serif;text-align:left;display:flex;align-items:center;gap:12px;width:100%;}
  .ubq-opt:hover:not([disabled]){border-color:var(--blue);background:rgba(52,152,219,0.08);}
  .ubq-opt.correct{border-color:var(--green)!important;background:rgba(39,174,96,0.1)!important;}
  .ubq-opt.wrong{border-color:var(--red)!important;background:rgba(192,57,43,0.1)!important;}
  .ubq-letter{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:11px;font-family:'DM Mono',monospace;flex-shrink:0;}
  .ubq-opt.correct .ubq-letter{background:var(--green);color:#fff;}
  .ubq-opt.wrong .ubq-letter{background:var(--red);color:#fff;}
  .ubq-fb{display:none;padding:14px 16px;border-radius:12px;margin-bottom:12px;}
  .ubq-fb.show{display:block;animation:fadeUp 0.3s ease both;}
  .ubq-fb.ok{background:rgba(39,174,96,0.1);border:1px solid rgba(39,174,96,0.3);}
  .ubq-fb.no{background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.3);}
  .ubq-fbt{font-weight:700;font-size:14px;margin-bottom:5px;}
  .ubq-fbt.ok{color:var(--green);}
  .ubq-fbt.no{color:#e74c3c;}
  .ubq-fbd{font-size:13px;color:var(--cream);line-height:1.7;}
  .ubq-nx{display:none;margin-top:8px;}
  .ubq-nx.show{display:block;}
  .ubq-score-num{font-family:'Playfair Display',serif;font-size:48px;color:var(--blue);margin-bottom:6px;}
  .ubq-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
  .ubq-btns .btn{width:auto;padding:12px 28px;}
"""

# ─────────────────── Light theme overrides for new quiz ───────────────
UBQ_LIGHT = """\n  .ubq-opt{border:1px solid #E5E7EB;background:white;color:#1F2937;}
  .ubq-opt:hover:not([disabled]){border-color:#3B82F6;background:#EFF6FF;}
  .ubq-letter{background:#F3F4F6;color:#374151;}
"""

# ─────────────────── HTML block (injected after start button) ─────────
UBQ_HTML = u"""
    <!-- UEBUNGSAUFGABEN -->
    <div class="card ubq-wrap" id="ubqWrap">
      <div class="concept-tag">&#220;BUNGSAUFGABEN</div>
      <h2 class="lesson-h" style="font-size:22px;margin-bottom:4px;">Teste dein Wissen</h2>
      <p style="font-size:13px;color:var(--gray);margin-bottom:20px;font-family:'DM Mono',monospace;">5 Fragen zum Modul</p>
      <div id="ubqMain"></div>
    </div>
"""

# ─────────────────── JS template (placeholder = JSON quiz data) ───────
UBQ_JS_TPL = u"""
  // ===== UEBUNGSAUFGABEN =====
  var UBQ_DATA = %s;
  var ubqIdx=0, ubqScore=0, ubqAnswered=false, ubqResults=[], ubqNextHref='%s';
  function ubqInit(){ubqIdx=0;ubqScore=0;ubqAnswered=false;ubqResults=[];ubqRender();}
  function ubqRender(){
    var d=UBQ_DATA[ubqIdx];
    var dots='<div class="ubq-dots">';
    for(var i=0;i<5;i++){
      var c='ubq-dot';
      if(i<ubqIdx){c+=ubqResults[i]?' done':' wrong-dot';}
      else if(i===ubqIdx){c+=' active';}
      dots+='<div class="'+c+'"></div>';
    }
    dots+='</div>';
    var opts=d.opts.map(function(o,i){
      return '<button class="ubq-opt" id="ubqO'+i+'" onclick="ubqPick('+i+')">'
        +'<span class="ubq-letter">'+['A','B','C','D'][i]+'</span>'+o+'</button>';
    }).join('');
    document.getElementById('ubqMain').innerHTML=
      '<div class="ubq-qnum">FRAGE '+(ubqIdx+1)+' VON 5</div>'
      +dots
      +'<div class="ubq-q">'+d.q+'</div>'
      +'<div class="ubq-opts">'+opts+'</div>'
      +'<div class="ubq-fb" id="ubqFb"><div class="ubq-fbt" id="ubqFbt"></div><div class="ubq-fbd" id="ubqFbd"></div></div>'
      +'<div class="ubq-nx" id="ubqNx"><button class="btn btn-primary" onclick="ubqAdv()">'
      +(ubqIdx<4?'N\\u00e4chste Frage \\u2192':'Ergebnis anzeigen \\u2192')+'</button></div>';
    ubqAnswered=false;
  }
  function ubqPick(idx){
    if(ubqAnswered)return;
    ubqAnswered=true;
    var d=UBQ_DATA[ubqIdx];
    var ok=(idx===d.ans);
    if(ok){ubqScore++;ubqResults[ubqIdx]=true;}else{ubqResults[ubqIdx]=false;}
    for(var i=0;i<4;i++){
      var b=document.getElementById('ubqO'+i);
      if(b){b.disabled=true;if(i===d.ans)b.classList.add('correct');if(i===idx&&!ok)b.classList.add('wrong');}
    }
    var fbt=document.getElementById('ubqFbt');
    var fbd=document.getElementById('ubqFbd');
    var fb=document.getElementById('ubqFb');
    if(ok){
      fbt.className='ubq-fbt ok';
      fbt.textContent='\\u2705 Richtig!';
      fbd.textContent=d.exp;
    }else{
      fbt.className='ubq-fbt no';
      fbt.textContent='\\ud83d\\udcaa Nicht ganz.';
      fbd.textContent='Die richtige Antwort ist: '+d.opts[d.ans]+'. '+d.exp;
    }
    fb.className='ubq-fb show '+(ok?'ok':'no');
    document.getElementById('ubqNx').className='ubq-nx show';
  }
  function ubqAdv(){
    if(ubqIdx<4){ubqIdx++;ubqRender();}else{ubqShowResult();}
  }
  function ubqShowResult(){
    var msgs=[
      'Nicht aufgeben! \\ud83c\\udf1f\\nDu schaffst das!',
      'Nicht aufgeben! \\ud83c\\udf1f\\nDu schaffst das!',
      'Weiter \\u00fcben! \\ud83d\\udcda\\nLies die Lektion nochmal.',
      'Gut gemacht! \\ud83d\\udcaa\\nNoch etwas \\u00fcben!',
      'Sehr gut! \\ud83d\\udc4f\\nFast perfekt!',
      'Ausgezeichnet! \\ud83c\\udf89\\nDu hast alles verstanden!'
    ];
    document.getElementById('ubqMain').innerHTML=
      '<div style="text-align:center;padding:16px 0;">'
      +'<div style="font-size:52px;margin-bottom:10px;">'
      +(ubqScore===5?'\\ud83c\\udf89':ubqScore>=4?'\\ud83d\\udc4f':ubqScore>=3?'\\ud83d\\udcaa':'\\ud83d\\udcda')
      +'</div>'
      +'<div class="ubq-score-num">'+ubqScore+'/5</div>'
      +'<div style="font-size:18px;margin-bottom:4px;white-space:pre-line;">'+msgs[ubqScore]+'</div>'
      +'<div class="ubq-btns">'
      +'<button class="btn btn-outline" onclick="ubqReset()">Nochmal versuchen</button>'
      +'<button class="btn btn-primary" onclick="window.location.href=ubqNextHref">N\\u00e4chstes Modul \\u2192</button>'
      +'</div></div>';
  }
  function ubqReset(){ubqIdx=0;ubqScore=0;ubqAnswered=false;ubqResults=[];ubqRender();}
  document.addEventListener('DOMContentLoaded',function(){ubqInit();});
"""

# ─────────────────── Quiz data per module ─────────────────────────────
QUIZ = {
"module-b2-1-konjunktiv1.html": [
  {"q": "Wandle in indirekte Rede um:\nEr sagt: \"Ich bin m\u00fcde.\"",
   "opts": ["Er sagt, dass er m\u00fcde ist.", "Er sagt, er sei m\u00fcde.", "Er sagt, er ist m\u00fcde.", "Er sagt, er w\u00e4re m\u00fcde."],
   "ans": 1, "exp": "Konjunktiv I (sei) wird in der indirekten Rede verwendet, um Distanz zur Aussage zu zeigen."},
  {"q": "Wann benutzt man Konjunktiv II statt Konjunktiv I?",
   "opts": ["Immer bei sein", "Wenn KI = Indikativ", "Nur bei haben", "Bei allen Verben"],
   "ans": 1, "exp": "Wenn die KI-Form mit dem Indikativ identisch ist (z.B. 'sie kommen'), verwendet man KII."},
  {"q": "Konjunktiv I von \"kommen\" (er/sie/es):",
   "opts": ["k\u00e4me", "komme", "kommt", "k\u00e4mpfe"],
   "ans": 1, "exp": "Konjunktiv I: Stamm + -e \u2192 kommen \u2192 komme."},
  {"q": "Amina berichtet: \"Ich habe keine Zeit.\"\nIndirekte Rede:",
   "opts": ["Amina sagt, sie hatte keine Zeit.", "Amina sagt, sie habe keine Zeit.", "Amina sagt, sie hat keine Zeit.", "Amina sagt, sie h\u00e4tte keine Zeit."],
   "ans": 1, "exp": "'Habe' ist die Konjunktiv-I-Form von 'haben' (3. Pers. Sg.)."},
  {"q": "Konjunktiv I wird haupts\u00e4chlich verwendet in:",
   "opts": ["Alltagsgespr\u00e4chen", "Indirekter Rede", "Bedingungss\u00e4tzen", "W\u00fcnschen"],
   "ans": 1, "exp": "Konjunktiv I ist der Modus der indirekten Rede, typisch in Nachrichten und Zeitungen."},
],
"module-b2-2-passiv-erweitert.html": [
  {"q": "Was ist der Unterschied zwischen Vorgangs- und Zustandspassiv?",
   "opts": ["Kein Unterschied", "Vorgangspassiv = werden + P2, Zustandspassiv = sein + P2", "Zustandspassiv = werden + P2", "Beide benutzen haben"],
   "ans": 1, "exp": "Vorgangspassiv: Das Haus wird gebaut. Zustandspassiv: Das Haus ist gebaut (Ergebnis)."},
  {"q": "Bilde Passiv:\n\"Man baut hier ein Haus.\"",
   "opts": ["Ein Haus wird hier gebaut.", "Ein Haus ist hier gebaut.", "Ein Haus hat hier gebaut.", "Hier baut ein Haus."],
   "ans": 0, "exp": "Passiv Pr\u00e4sens = werden + Partizip II. 'Man' f\u00e4llt weg."},
  {"q": "Zustandspassiv:\n\"Die T\u00fcr _____ geschlossen.\"",
   "opts": ["wird", "wurde", "ist", "hat"],
   "ans": 2, "exp": "Zustandspassiv = sein + Partizip II: beschreibt den resultierenden Zustand."},
  {"q": "Passiv mit Modalverb:\n\"Das muss gemacht werden\" \u2014 welche Zeit?",
   "opts": ["Perfekt", "Pr\u00e4teritum", "Pr\u00e4sens", "Futur"],
   "ans": 2, "exp": "Passiv mit Modalverb im Pr\u00e4sens: Modalverb (Pr\u00e4s.) + Partizip II + werden."},
  {"q": "Welcher Satz ist ein unpers\u00f6nliches Passiv?",
   "opts": ["Es wird hier gearbeitet.", "Hier arbeitet es.", "Es hat gearbeitet.", "Hier wird Arbeit."],
   "ans": 0, "exp": "Das unpers\u00f6nliche Passiv hat kein grammatisches Subjekt: Es wird gearbeitet."},
],
"module-b2-3-nominalisierung.html": [
  {"q": "Nominalisiere das Verb \"entwickeln\":",
   "opts": ["die Entwickler", "die Entwicklung", "das Entwickeln", "der Entwickel"],
   "ans": 1, "exp": "Viele Verben \u2192 Nomen auf -ung: entwickeln \u2192 die Entwicklung."},
  {"q": "Welche Endung bildet feminine Nomen aus Verben?",
   "opts": ["-er", "-ung", "-lich", "-sam"],
   "ans": 1, "exp": "Das Suffix -ung bildet feminine Substantive aus Verben: planen \u2192 die Planung."},
  {"q": "Verbalisiere \"die Planung\":",
   "opts": ["planieren", "planen", "plannen", "geplant"],
   "ans": 1, "exp": "Die Planung \u2192 planen (Verb\u2192Nomen r\u00fcckw\u00e4rts)."},
  {"q": "Warum benutzt man Nominalisierung in formellen Texten?",
   "opts": ["Es ist k\u00fcrzer", "Es klingt formeller und akademischer", "Es ist einfacher", "Es ist grammatisch notwendig"],
   "ans": 1, "exp": "Nominalisierungen verdichten Informationen und wirken im akademischen Stil professioneller."},
  {"q": "Nominalisiere das Adjektiv \"wichtig\":",
   "opts": ["die Wichtigkeit", "die Wichtigung", "das Wichtige", "der Wichtig"],
   "ans": 0, "exp": "Adjektive + -keit/-heit \u2192 Substantive: wichtig \u2192 die Wichtigkeit."},
],
"module-b2-4-konzessivsaetze.html": [
  {"q": "Welches Wort leitet einen Konzessivsatz ein?",
   "opts": ["weil", "damit", "obwohl", "sodass"],
   "ans": 2, "exp": "'Obwohl' leitet Konzessivsätze ein und drückt einen Widerspruch/Gegensatz aus."},
  {"q": "Was ist der Unterschied zwischen \"weil\" und \"da\"?",
   "opts": ["Kein Unterschied", "\"da\" steht meist am Satzanfang, \"weil\" kann \u00fcberall stehen", "\"weil\" ist formeller", "\"da\" ist nur m\u00fcndlich"],
   "ans": 1, "exp": "'Da' steht meist am Satzanfang und dr\u00fcckt bekannte/offensichtliche Gr\u00fcnde aus."},
  {"q": "Finalsatz:\n\"Kwame lernt Deutsch, _____ er in Deutschland arbeiten kann.\"",
   "opts": ["weil", "obwohl", "damit", "sodass"],
   "ans": 2, "exp": "'Damit' leitet Finalsätze ein und drückt Absicht/Zweck aus."},
  {"q": "Konsekutivsatz:\n\"Es war so kalt, _____ Kofi seinen Mantel anzog.\"",
   "opts": ["obwohl", "damit", "weil", "dass"],
   "ans": 3, "exp": "'So ... dass' / 'sodass' leiten Konsekutivsätze ein (Folge)."},
  {"q": "\"Trotzdem\" ist grammatisch ein:",
   "opts": ["Konjunktion", "Adverb", "Pr\u00e4position", "Artikel"],
   "ans": 1, "exp": "'Trotzdem' ist ein konzessives Adverb (kein Nebensatz, steht im Hauptsatz)."},
],
"module-b2-5-partizipialkonstruktionen.html": [
  {"q": "Partizip I von \"schlafen\":",
   "opts": ["geschlafen", "schlafend", "geschlafend", "schl\u00e4fend"],
   "ans": 1, "exp": "Partizip I = Infinitiv + -d: schlafen \u2192 schlafend."},
  {"q": "Wandle in Partizipialkonstruktion um:\n\"Der Mann, der im B\u00fcro arbeitet\"",
   "opts": ["Der arbeitende Mann im B\u00fcro", "Der gearbeitete Mann im B\u00fcro", "Der Arbeitsmann im B\u00fcro", "Der Mann arbeitend im B\u00fcro"],
   "ans": 0, "exp": "Partizip I + Adjektivendung ersetzt einen Relativsatz mit gleichzeitiger Handlung."},
  {"q": "Partizip II als Adjektiv:\n\"die _____ Pr\u00fcfung\" (bestehen)",
   "opts": ["bestandene", "bestandende", "bestehenende", "begehende"],
   "ans": 0, "exp": "bestehen \u2192 bestanden (unregelm\u00e4\u00dfig) + -e \u2192 die bestandene Pr\u00fcfung."},
  {"q": "Wof\u00fcr werden Partizipialkonstruktionen verwendet?",
   "opts": ["Um Relativs\u00e4tze zu ersetzen", "Um Modalverben zu ersetzen", "Um Passiv zu bilden", "Um Futur auszudr\u00fccken"],
   "ans": 0, "exp": "Partizipialkonstruktionen ersetzen Relativsätze kompakter, typisch in Schriftsprache."},
  {"q": "\"Die von Kwame geschriebene Email...\"\nDas Partizip II ist hier:",
   "opts": ["Attributiv", "Pr\u00e4dikativ", "Adverbial", "Nominal"],
   "ans": 0, "exp": "Attributives Partizip: steht vor dem Nomen und wird gebeugt wie ein Adjektiv."},
],
"module-b2-6-modalpartikeln.html": [
  {"q": "Was macht \"doch\" in:\n\"Komm doch mal vorbei!\"",
   "opts": ["Negation", "Macht die Bitte freundlicher", "Ausdruck von Zweifel", "Zeitangabe"],
   "ans": 1, "exp": "'Doch' mildert Aufforderungen und macht sie weniger direkt/freundlicher."},
  {"q": "\"Das ist ja interessant!\"\n\"ja\" dr\u00fcckt hier aus:",
   "opts": ["Zustimmung zu etwas Bekanntem/\u00dcberraschendem", "Eine Frage", "Negation", "Zukunft"],
   "ans": 0, "exp": "'Ja' dr\u00fcckt Bekanntheit oder leichte \u00dcberraschung aus: 'das wei\u00dft du doch'."},
  {"q": "\"Eben\" und \"halt\" bedeuten:",
   "opts": ["Jetzt sofort", "So ist es nun mal, nicht zu \u00e4ndern", "Vielleicht", "Niemals"],
   "ans": 1, "exp": "'Eben/halt' dr\u00fcckt Unver\u00e4nderlichkeit aus: Das ist eben so (= unvermeidlich)."},
  {"q": "Modalpartikeln stehen meist:",
   "opts": ["Am Satzanfang", "Am Satzende", "Im Mittelfeld", "Vor dem Verb"],
   "ans": 2, "exp": "Modalpartikeln stehen im Mittelfeld des Satzes, nach dem konjugierten Verb."},
  {"q": "\"Wohl\" dr\u00fcckt aus:",
   "opts": ["Gesundheit", "Vermutung/Wahrscheinlichkeit", "Wunsch", "Ablehnung"],
   "ans": 1, "exp": "'Wohl' dr\u00fcckt Vermutung aus: Er ist wohl krank = Er ist wahrscheinlich krank."},
],
"module-b2-7-textanalyse.html": [
  {"q": "Was ist eine \"These\" in einer Er\u00f6rterung?",
   "opts": ["Ein Beispiel", "Eine Hauptbehauptung, die man verteidigt", "Eine Zusammenfassung", "Eine Frage"],
   "ans": 1, "exp": "Die These ist die zentrale Behauptung des Textes, die mit Argumenten belegt wird."},
  {"q": "Welcher Konnektor leitet eine Schlussfolgerung ein?",
   "opts": ["Einerseits", "Obwohl", "Zusammenfassend l\u00e4sst sich sagen", "Zum Beispiel"],
   "ans": 2, "exp": "Schlusskonnektoren: zusammenfassend, insgesamt, abschlie\u00dfend, festzuhalten ist..."},
  {"q": "Was ist ein Kommentar (Textsorte)?",
   "opts": ["Eine neutrale Beschreibung", "Eine subjektive Meinungs\u00e4u\u00dferung zu einem aktuellen Thema", "Eine Zusammenfassung", "Ein Bericht"],
   "ans": 1, "exp": "Ein Kommentar ist eine wertende Stellungnahme \u2014 der Autor \u00e4u\u00dfert klar seine Meinung."},
  {"q": "TAES steht f\u00fcr:",
   "opts": ["Text, Analyse, Ergebnis, Schluss", "These, Argument, Beispiel, Schlussfolgerung", "Thema, Aufsatz, Er\u00f6rterung, Satz", "Text, Aufgabe, Erkl\u00e4rung, Satz"],
   "ans": 1, "exp": "TAES = These, Argument, Beispiel, Schlussfolgerung \u2014 die Argumentationsstruktur."},
  {"q": "\"Im Gegensatz dazu\" leitet ein:",
   "opts": ["Beispiel", "Ursache", "Gegenargument", "Schluss"],
   "ans": 2, "exp": "'Im Gegensatz dazu' ist ein adversatives Konnektiv f\u00fcr Gegenargumente."},
],
"module-b2-8-wissenschaftlich.html": [
  {"q": "Welche Anrede ist korrekt in einer formellen E-Mail?",
   "opts": ["Hey!", "Hallo du!", "Sehr geehrte Damen und Herren,", "Liebe Firma,"],
   "ans": 2, "exp": "'Sehr geehrte Damen und Herren' ist die standardm\u00e4\u00dfige formelle Anrede."},
  {"q": "Akademischer Stil vermeidet:",
   "opts": ["Lange S\u00e4tze", "Fachbegriffe", "Umgangssprache und Ich-Perspektive", "Passivkonstruktionen"],
   "ans": 2, "exp": "Akademisches Schreiben ist objektiv: kein 'ich finde', keine Umgangssprache."},
  {"q": "Ein Bewerbungsschreiben beginnt mit:",
   "opts": ["Meinem Lebenslauf", "Einer Betreffzeile und formeller Anrede", "Meinen Hobbys", "Meinem Gehaltswunsch"],
   "ans": 1, "exp": "Struktur: Betreff \u2192 Anrede \u2192 Einleitung \u2192 Erfahrungen \u2192 Abschluss."},
  {"q": "\"Mit freundlichen Gr\u00fc\u00dfen\" verwendet man:",
   "opts": ["In informellen E-Mails", "An Freunde", "Am Ende formeller Korrespondenz", "Nur in Briefen"],
   "ans": 2, "exp": "'Mit freundlichen Gr\u00fc\u00dfen' ist der formelle Abschluss von E-Mails und Briefen."},
  {"q": "Was geh\u00f6rt NICHT in ein Bewerbungsschreiben?",
   "opts": ["Motivation f\u00fcr die Stelle", "Relevante Erfahrungen", "Pers\u00f6nliche Probleme", "Kontaktdaten"],
   "ans": 2, "exp": "Pers\u00f6nliche Probleme sind in einer Bewerbung unangemessen und irrelevant."},
],
"module-b2-9-diskussion.html": [
  {"q": "Wie widerspricht man h\u00f6flich?",
   "opts": ["Das ist falsch!", "Ich sehe das etwas anders, weil...", "Nein!", "Du hast keine Ahnung."],
   "ans": 1, "exp": "H\u00f6flicher Widerspruch beginnt mit abschw\u00e4chenden Formulierungen wie 'etwas anders'."},
  {"q": "\"Ich bin der Meinung, dass...\" ist ein Ausdruck f\u00fcr:",
   "opts": ["Zustimmung", "Meinungs\u00e4u\u00dferung", "Widerspruch", "Zusammenfassung"],
   "ans": 1, "exp": "'Ich bin der Meinung...' ist eine typische B2-Formel zur Meinungs\u00e4u\u00dferung."},
  {"q": "Bei einer B2-Diskussion sollte man:",
   "opts": ["Nur die eigene Meinung sagen", "Argumente mit Beispielen belegen", "Sehr schnell sprechen", "Keine Fragen stellen"],
   "ans": 1, "exp": "Gute Argumente werden immer mit konkreten Beispielen oder Belegen gest\u00fctzt."},
  {"q": "\"Einerseits... andererseits...\" zeigt:",
   "opts": ["Chronologie", "Zwei Perspektiven/Gegen\u00fcberstellung", "Ursache und Wirkung", "Zusammenfassung"],
   "ans": 1, "exp": "'Einerseits... andererseits...' stellt zwei unterschiedliche Perspektiven gegen\u00fcber."},
  {"q": "Um Zeit beim Sprechen zu gewinnen, sagt man:",
   "opts": ["Nichts \u2014 einfach schweigen", "Das ist eine gute Frage, ich \u00fcberlege kurz...", "Ich wei\u00df es nicht.", "N\u00e4chste Frage bitte."],
   "ans": 1, "exp": "Zeitgewinner-Phrasen helfen beim \u00dcberlegen ohne unangenehme Sprechpausen."},
],
"module-b2-10-hoeren-lesen-b2.html": [
  {"q": "Was ist \"Skimming\"?",
   "opts": ["Jedes Wort genau lesen", "Schnelles \u00dcberfliegen zum Hauptthema verstehen", "Nur die \u00dcberschriften lesen", "R\u00fcckw\u00e4rts lesen"],
   "ans": 1, "exp": "Skimming = globales Lesen, um das Hauptthema schnell zu erfassen."},
  {"q": "Bei H\u00f6raufgaben sollte man:",
   "opts": ["Alles w\u00f6rtlich aufschreiben", "Schl\u00fcsselw\u00f6rter und Hauptideen notieren", "Die Augen schlie\u00dfen", "Nichts aufschreiben"],
   "ans": 1, "exp": "Schl\u00fcsselw\u00f6rter und Hauptideen notieren ist effizienter als alles aufschreiben."},
  {"q": "\"Selektives Lesen\" bedeutet:",
   "opts": ["Alles lesen", "Nur interessante Teile lesen", "Gezielt nach bestimmten Informationen suchen", "Sehr langsam lesen"],
   "ans": 2, "exp": "Selektives Lesen (Scanning) = gezielt nach spezifischen Informationen suchen."},
  {"q": "Was macht man bei einem unbekannten Wort im Text?",
   "opts": ["Sofort aufh\u00f6ren", "Kontext nutzen um Bedeutung zu erschlie\u00dfen", "Das W\u00f6rterbuch nehmen", "Den Text neu beginnen"],
   "ans": 1, "exp": "Unbekannte W\u00f6rter aus dem Kontext erschlie\u00dfen spart wertvolle Pr\u00fcfungszeit."},
  {"q": "Globalverstehen bedeutet:",
   "opts": ["Den ganzen Text \u00fcbersetzen", "Jedes Detail verstehen", "Den allgemeinen Inhalt und die Hauptideen verstehen", "Nur den Anfang lesen"],
   "ans": 2, "exp": "Globalverstehen = das Hauptthema und die Hauptideen eines Textes erfassen."},
],
"module-b2-11-wortschatz-b2.html": [
  {"q": "\"Die Nachhaltigkeit\" bedeutet:",
   "opts": ["Schnelles Wachstum", "Langfristig umweltvertr\u00e4gliches Handeln", "Wirtschaftlicher Gewinn", "Technologischer Fortschritt"],
   "ans": 1, "exp": "Nachhaltigkeit = Ressourcen so nutzen, dass sie f\u00fcr k\u00fcnftige Generationen erhalten bleiben."},
  {"q": "\"Integration\" im gesellschaftlichen Kontext bedeutet:",
   "opts": ["Mathematische Berechnung", "Eingliederung in die Gesellschaft", "Computerprogrammierung", "Sprachkurs besuchen"],
   "ans": 1, "exp": "Gesellschaftliche Integration = Menschen werden Teil der Gesellschaft."},
  {"q": "\"Die Fachkraft\" bedeutet:",
   "opts": ["Ein Werkzeug", "Eine qualifizierte Person in einem Berufsfeld", "Ein Unternehmen", "Eine Beh\u00f6rde"],
   "ans": 1, "exp": "Fachkraft = eine Person mit spezifischer Berufsausbildung (z.B. Fachkraft f\u00fcr IT)."},
  {"q": "\"Globalisierung\" beschreibt:",
   "opts": ["Lokale Entwicklungen", "Weltweite Vernetzung von Wirtschaft und Gesellschaft", "Einen Computerbegriff", "Einen geografischen Begriff"],
   "ans": 1, "exp": "Globalisierung = weltweite wirtschaftliche, kulturelle und politische Vernetzung."},
  {"q": "\"Die Beh\u00f6rde\" ist:",
   "opts": ["Ein privates Unternehmen", "Eine staatliche Verwaltungseinrichtung", "Eine Schule", "Ein Krankenhaus"],
   "ans": 1, "exp": "Beh\u00f6rde = staatliche/\u00f6ffentliche Verwaltungsstelle, z.B. Ausl\u00e4nderamt, Finanzamt."},
],
"module-b2-12-schreiben-b2.html": [
  {"q": "Eine Er\u00f6rterung hat folgende Struktur:",
   "opts": ["Begr\u00fc\u00dfung, Hauptteil, Abschied", "Einleitung, Hauptteil (Pro/Kontra), Schluss", "These, Antithese", "Nur Argumente"],
   "ans": 1, "exp": "Er\u00f6rterung: Einleitung (Thema) \u2192 Hauptteil (Pro/Kontra) \u2192 Schluss (Fazit)."},
  {"q": "Ein Leserbrief beginnt mit:",
   "opts": ["Hallo Redaktion!", "Einer formellen Anrede und Bezug auf den Artikel", "Einer Zusammenfassung", "Pers\u00f6nlichen Daten"],
   "ans": 1, "exp": "Leserbrief: formelle Anrede \u2192 Bezug auf den Artikel \u2192 eigene Meinung mit Begr\u00fcndung."},
  {"q": "Was geh\u00f6rt in die Einleitung einer Er\u00f6rterung?",
   "opts": ["Alle Argumente", "Das Thema vorstellen und Interesse wecken", "Die Schlussfolgerung", "Pers\u00f6nliche Daten"],
   "ans": 1, "exp": "Die Einleitung f\u00fchrt in das Thema ein und weckt das Interesse des Lesers."},
  {"q": "Beim Zusammenfassen:",
   "opts": ["Kopiert man den Text", "Gibt man alle Details wieder", "Fasst man Hauptpunkte in eigenen Worten zusammen", "Schreibt man seine Meinung"],
   "ans": 2, "exp": "Zusammenfassen = Hauptpunkte in eigenen Worten, k\u00fcrzer als das Original."},
  {"q": "\"Dar\u00fcber hinaus\" dient als:",
   "opts": ["Schlussfolgerung", "Widerspruch", "Zus\u00e4tzliches Argument", "Einleitung"],
   "ans": 2, "exp": "'Dar\u00fcber hinaus' ist additiv: es f\u00fcgt ein weiteres Argument hinzu."},
],
"module-b2-13-sprechen-b2.html": [
  {"q": "Eine B2-Pr\u00e4sentation dauert ca.:",
   "opts": ["1 Minute", "3\u20135 Minuten", "10 Minuten", "30 Minuten"],
   "ans": 1, "exp": "Die B2-Pr\u00e4sentation dauert ca. 3\u20135 Minuten."},
  {"q": "Wie beginnt man eine Pr\u00e4sentation?",
   "opts": ["Sofort mit Details", "Mit Begr\u00fc\u00dfung, Thema vorstellen und Gliederung", "Mit einer langen Geschichte", "Mit Fragen ans Publikum"],
   "ans": 1, "exp": "Gute Struktur: Begr\u00fc\u00dfung \u2192 Thema nennen \u2192 kurze Gliederung \u2192 Hauptteil."},
  {"q": "Bei der Bildbeschreibung B2:",
   "opts": ["Nur beschreiben was man sieht", "Beschreiben, interpretieren und Meinung \u00e4u\u00dfern", "Nur die Farben nennen", "Das Bild \u00fcbersetzen"],
   "ans": 1, "exp": "B2-Bildbeschreibung = beschreiben + interpretieren + eigene Meinung \u00e4u\u00dfern."},
  {"q": "Wenn man ein Wort vergisst:",
   "opts": ["Aufh\u00f6ren zu sprechen", "Ich wei\u00df nicht sagen", "Umschreiben und weitersprechen", "Auf Englisch sagen"],
   "ans": 2, "exp": "Umschreiben zeigt Sprachkompetenz: 'das Ding, mit dem man schreibt' = Stift."},
  {"q": "Pr\u00fcfungsangst bek\u00e4mpft man durch:",
   "opts": ["Gar nicht \u00fcben", "Regelm\u00e4\u00dfiges \u00dcben und positive Selbstgespr\u00e4che", "Viel Kaffee trinken", "Die Pr\u00fcfung vermeiden"],
   "ans": 1, "exp": "Regelm\u00e4\u00dfiges \u00dcben und positive Gedanken reduzieren Pr\u00fcfungsangst nachweislich."},
],
"module-b2-14-pruefungsvorbereitung.html": [
  {"q": "Wie viel sollte man vor der Pr\u00fcfung schlafen?",
   "opts": ["Die ganze Nacht lernen", "Mindestens 7\u20138 Stunden gut schlafen", "4 Stunden reichen", "Schlafen ist unwichtig"],
   "ans": 1, "exp": "Schlaf ist entscheidend f\u00fcr Konzentration und Ged\u00e4chtnis am Pr\u00fcfungstag."},
  {"q": "Was macht man, wenn man eine Aufgabe nicht versteht?",
   "opts": ["Die Pr\u00fcfung abgeben", "Leer lassen und weitermachen, am Ende zur\u00fcckkommen", "Raten ohne nachzudenken", "Den Pr\u00fcfer fragen"],
   "ans": 1, "exp": "Weitermachen und zur\u00fcckkommen spart Zeit und reduziert Stress in der Pr\u00fcfung."},
  {"q": "Gutes Zeitmanagement in der Pr\u00fcfung bedeutet:",
   "opts": ["So schnell wie m\u00f6glich fertig sein", "Zeit pro Aufgabe einteilen und einhalten", "Beim ersten Fehler aufh\u00f6ren", "Alles zweimal schreiben"],
   "ans": 1, "exp": "Zeitplan: z.B. Lesen 30 Min, H\u00f6ren 30 Min, Schreiben 40 Min einhalten."},
  {"q": "Kurz vor der Pr\u00fcfung sollte man:",
   "opts": ["Neue Grammatik lernen", "Bekannte Themen wiederholen und sich ausruhen", "Die ganze Nacht lernen", "Nichts tun"],
   "ans": 1, "exp": "Bekanntes wiederholen ist effektiver als kurz vor der Pr\u00fcfung Neues zu lernen."},
  {"q": "Nach einer nicht bestandenen Pr\u00fcfung sollte man:",
   "opts": ["Nie wieder versuchen", "Analysieren was falsch war und nochmal anmelden", "Aufgeben", "Sich sch\u00e4men"],
   "ans": 1, "exp": "Jede Pr\u00fcfung ist eine Lernm\u00f6glichkeit. Analysieren, verbessern, nochmal versuchen!"},
],
}

NEXT_MOD = {
  "module-b2-1-konjunktiv1.html": "module-b2-2-passiv-erweitert.html",
  "module-b2-2-passiv-erweitert.html": "module-b2-3-nominalisierung.html",
  "module-b2-3-nominalisierung.html": "module-b2-4-konzessivsaetze.html",
  "module-b2-4-konzessivsaetze.html": "module-b2-5-partizipialkonstruktionen.html",
  "module-b2-5-partizipialkonstruktionen.html": "module-b2-6-modalpartikeln.html",
  "module-b2-6-modalpartikeln.html": "module-b2-7-textanalyse.html",
  "module-b2-7-textanalyse.html": "module-b2-8-wissenschaftlich.html",
  "module-b2-8-wissenschaftlich.html": "module-b2-9-diskussion.html",
  "module-b2-9-diskussion.html": "module-b2-10-hoeren-lesen-b2.html",
  "module-b2-10-hoeren-lesen-b2.html": "module-b2-11-wortschatz-b2.html",
  "module-b2-11-wortschatz-b2.html": "module-b2-12-schreiben-b2.html",
  "module-b2-12-schreiben-b2.html": "module-b2-13-sprechen-b2.html",
  "module-b2-13-sprechen-b2.html": "module-b2-14-pruefungsvorbereitung.html",
  "module-b2-14-pruefungsvorbereitung.html": "dashboard.html",
}


def remove_old_sq(html):
    """Remove old sq- quiz CSS, HTML, and JS blocks."""
    # Remove sq- CSS block (between marker and closing </style>)
    html = re.sub(
        r'\n  /\* ===== STANDALONE QUIZ ===== \*/.*?(?=\n</style>)',
        '', html, flags=re.DOTALL
    )
    # Remove sq- HTML block (between marker and closing </div> of sq-wrap)
    html = re.sub(
        r'\n    <!-- STANDALONE QUIZ -->\n    <div class="sq-wrap".*?</div>\n',
        '\n', html, flags=re.DOTALL
    )
    # Remove sq- JS block (between marker and last </script>)
    html = re.sub(
        r'\n  // ===== STANDALONE QUIZ =====.*?(?=\n</script>)',
        '', html, flags=re.DOTALL
    )
    # Also remove the extra sqNextMod DOMContentLoaded block if present
    html = re.sub(
        r"\n  document\.addEventListener\('DOMContentLoaded',function\(\)\{\s*var nb=document\.getElementById\('sqNextMod'\).*?\}\);\n",
        '', html, flags=re.DOTALL
    )
    return html


def process(fname):
    path = os.path.join(BASE, fname)
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Remove old sq- quiz
    html = remove_old_sq(html)

    # 2. Skip if already has ubq quiz
    if 'ubqWrap' in html:
        print("  SKIP %s (already has ubq quiz)" % fname)
        return

    # 3. Add ubq CSS to first </style>
    # Insert before the first </style>
    html = html.replace('</style>', UBQ_CSS + '\n</style>', 1)

    # 4. Add ubq light theme overrides to the LIGHT THEME OVERRIDE <style> block
    # Find the second <style> block (LIGHT THEME OVERRIDE) and add before its </style>
    light_marker = '/* LIGHT THEME OVERRIDE */'
    if light_marker in html:
        # Find the </style> after the LIGHT THEME OVERRIDE comment
        lt_start = html.index(light_marker)
        lt_end = html.index('</style>', lt_start)
        html = html[:lt_end] + UBQ_LIGHT + '</style>' + html[lt_end+8:]

    # 5. Add ubq HTML after start button
    start_btn = u'Lektion 1 beginnen \u2192</button>'
    if start_btn not in html:
        print("  WARN %s: start button not found" % fname)
        return
    html = html.replace(start_btn, start_btn + UBQ_HTML, 1)

    # 6. Build quiz JS and insert before last </script>
    quiz_data_json = json.dumps(QUIZ[fname], ensure_ascii=True, indent=None)
    next_href = NEXT_MOD.get(fname, 'dashboard.html')
    quiz_js = UBQ_JS_TPL % (quiz_data_json, next_href)
    last_script = html.rfind('</script>')
    if last_script == -1:
        print("  WARN %s: no </script> found" % fname)
        return
    html = html[:last_script] + quiz_js + '\n</script>' + html[last_script+9:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("  OK   %s" % fname)


print("Processing 14 B2 modules...")
for fname in sorted(QUIZ.keys()):
    process(fname)
print("Done!")
