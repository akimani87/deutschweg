#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Replace ubq- quiz in B2 modules with one that uses the SAME CSS classes
and rendering pattern as the existing B1/B2 in-lesson quiz:
  .qopt, .qletter, .qfeedback, .qft, .qfb, .qfr, .quiz-qnum, .quiz-q, .quiz-hint, .qnext
"""
import os, re, json

BASE = os.path.dirname(os.path.abspath(__file__))

# ── Minimal new CSS (only wrapper + progress dots, reuse existing qopt/qletter etc.) ──
OBQ_CSS = """\n  /* ===== OBQ: Overview Quiz ===== */
  .obq-wrap{margin-top:32px;}
  .obq-dots{display:flex;gap:6px;margin-bottom:16px;}
  .obq-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.15);transition:all 0.3s;}
  .obq-dot.active{background:var(--blue);width:20px;border-radius:4px;}
  .obq-dot.done{background:var(--green);}
  .obq-dot.wrong{background:var(--red);}
  .obq-score{font-family:'Playfair Display',serif;font-size:48px;color:var(--blue);line-height:1;}
  .obq-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
  .obq-btns .btn{width:auto;padding:12px 28px;}
"""

# ── Light theme additions ──
OBQ_LIGHT = ""  # qopt already has light overrides; nothing extra needed

# ── HTML block ──
OBQ_HTML = u"""
    <!-- OBQ: OVERVIEW QUIZ -->
    <div class="card obq-wrap" id="obqWrap">
      <div class="concept-tag">&#220;BUNGSAUFGABEN</div>
      <h2 class="lesson-h" style="font-size:22px;margin-bottom:4px;">Teste dein Wissen</h2>
      <p style="font-size:13px;color:var(--gray);margin-bottom:20px;font-family:'DM Mono',monospace;">5 Fragen zum Modul</p>
      <div id="obqContainer"></div>
    </div>
"""

# ── JS template — renders using SAME classes as existing B1/B2 in-lesson quiz ──
OBQ_JS_TPL = u"""
  // ===== OBQ: OVERVIEW QUIZ =====
  var OBQ_DATA = %s;
  var obqIdx=0, obqScore=0, obqAnswered=false, obqResults=[], obqNextHref='%s';
  function obqInit(){obqIdx=0;obqScore=0;obqAnswered=false;obqResults=[];obqRender();}
  function obqRender(){
    var d=OBQ_DATA[obqIdx];
    var dots='<div class="obq-dots">';
    for(var i=0;i<5;i++){
      var c='obq-dot';
      if(i<obqIdx){c+=obqResults[i]?' done':' wrong';}
      else if(i===obqIdx){c+=' active';}
      dots+='<div class="'+c+'"></div>';
    }
    dots+='</div>';
    var letters=['A','B','C','D'];
    var opts=d.opts.map(function(o,i){
      return '<button class="qopt" id="obqO'+i+'" onclick="obqPick('+i+')">'
        +'<span class="qletter">'+letters[i]+'</span>'+o+'</button>';
    }).join('');
    document.getElementById('obqContainer').innerHTML=
      '<div class="quiz-qnum">FRAGE '+(obqIdx+1)+' VON 5</div>'
      +dots
      +'<div class="quiz-q" style="white-space:pre-line;margin-bottom:6px;">'+d.q+'</div>'
      +'<div class="quiz-hint" style="font-family:\\'DM Mono\\',monospace;margin-bottom:16px;">\U0001F4A1 '+d.hint+'</div>'
      +'<div class="quiz-opts">'+opts+'</div>'
      +'<div class="qfeedback" id="obqFb">'
        +'<div class="qft" id="obqFt"></div>'
        +'<div class="qfb" id="obqFb2"></div>'
        +'<div class="qfr" id="obqFr"></div>'
      +'</div>'
      +'<div class="qnext" id="obqNx">'
        +'<button class="btn btn-primary" onclick="obqAdv()">'
        +(obqIdx<4?'N\\u00e4chste Frage \\u2192':'Ergebnis anzeigen \\u2192')
        +'</button></div>';
    obqAnswered=false;
  }
  function obqPick(idx){
    if(obqAnswered)return;
    obqAnswered=true;
    var d=OBQ_DATA[obqIdx];
    var ok=(idx===d.ans);
    if(ok){obqScore++;obqResults[obqIdx]=true;}else{obqResults[obqIdx]=false;}
    var opts=document.querySelectorAll('#obqContainer .qopt');
    opts.forEach(function(b,i){
      b.disabled=true;
      if(i===d.ans) b.classList.add('correct');
      if(i===idx&&!ok) b.classList.add('wrong');
    });
    var ft=document.getElementById('obqFt');
    var fb2=document.getElementById('obqFb2');
    var fr=document.getElementById('obqFr');
    var fb=document.getElementById('obqFb');
    ft.className='qft '+(ok?'ok':'no');
    ft.textContent=ok?'\\u2713 Richtig!':'\\u2717 Nicht ganz';
    fb2.textContent=d.exp;
    fr.textContent='\\ud83d\\udccc Regel: '+d.rule;
    fb.classList.add('show',ok?'ok':'no');
    document.getElementById('obqNx').classList.add('show');
  }
  function obqAdv(){
    if(obqIdx<4){obqIdx++;obqRender();}else{obqShowResult();}
  }
  function obqShowResult(){
    var pct=Math.round(obqScore/5*100);
    var emoji=pct===100?'\\ud83c\\udf1f':pct>=80?'\\ud83d\\udc4f':pct>=60?'\\ud83d\\udc4d':'\\ud83d\\udcaa';
    var msg=pct===100?'Ausgezeichnet! \\ud83c\\udf89 Du hast alles verstanden!'
      :pct>=80?'Sehr gut! \\ud83d\\udc4f Fast perfekt!'
      :pct>=60?'Gut gemacht! \\ud83d\\udcaa Noch etwas \\u00fcben!'
      :pct>=40?'Weiter \\u00fcben! \\ud83d\\udcda Lies die Lektion nochmal.'
      :'Nicht aufgeben! \\ud83c\\udf1f Du schaffst das!';
    document.getElementById('obqContainer').innerHTML=
      '<div style="text-align:center;padding:16px 0;">'
      +'<div style="font-size:52px;margin-bottom:10px;">'+emoji+'</div>'
      +'<div class="obq-score">'+obqScore+'/5</div>'
      +'<div style="font-size:16px;margin:10px 0 20px;color:var(--cream);">'+msg+'</div>'
      +'<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(52,152,219,0.12);border:1px solid var(--blue);border-radius:50px;padding:9px 22px;color:var(--blue);font-weight:700;margin-bottom:20px;">\\u26a1 +'+obqScore*20+' XP</div>'
      +'<div class="obq-btns">'
      +'<button class="btn btn-outline" onclick="obqReset()">Nochmal versuchen</button>'
      +'<button class="btn btn-primary" onclick="window.location.href=obqNextHref">N\\u00e4chstes Modul \\u2192</button>'
      +'</div></div>';
  }
  function obqReset(){obqIdx=0;obqScore=0;obqAnswered=false;obqResults=[];obqRender();}
  document.addEventListener('DOMContentLoaded',function(){obqInit();});
"""

# ── Quiz data with hint + rule + exp per question ──
QUIZ = {
"module-b2-1-konjunktiv1.html": [
  {"q":"Wandle in indirekte Rede um:\nEr sagt: \"Ich bin m\u00fcde.\"",
   "opts":["Er sagt, dass er m\u00fcde ist.","Er sagt, er sei m\u00fcde.","Er sagt, er ist m\u00fcde.","Er sagt, er w\u00e4re m\u00fcde."],
   "ans":1,
   "hint":"Indirekte Rede \u2192 Konjunktiv I (nicht Indikativ!)",
   "exp":"'sei' ist Konjunktiv I von 'sein' und die korrekte Form f\u00fcr indirekte Rede.",
   "rule":"Indirekte Rede = Konjunktiv I. sein \u2192 sei (3. Sg.)"},
  {"q":"Wann benutzt man Konjunktiv II statt Konjunktiv I?",
   "opts":["Immer bei sein","Wenn KI = Indikativ","Nur bei haben","Bei allen Verben"],
   "ans":1,
   "hint":"Stell dir vor: 'sie lernen' \u2013 ist das KI oder Indikativ?",
   "exp":"Wenn KI = Indikativ (z.B. 'sie kommen'), verliert er seine Funktion \u2192 KII verwenden.",
   "rule":"KI = Indikativ? \u2192 KII verwenden (z.B. k\u00e4men statt kommen)"},
  {"q":"Konjunktiv I von \"kommen\" (er/sie/es):",
   "opts":["k\u00e4me","komme","kommt","k\u00e4mpfe"],
   "ans":1,
   "hint":"Stamm + -e (KI-Endung f\u00fcr 3. Sg.)",
   "exp":"Konjunktiv I: Infinitivstamm + -e \u2192 komm- + -e = komme.",
   "rule":"KI Bildung: Infinitivstamm + -e (3. Person Sg. immer eindeutig)"},
  {"q":"Amina berichtet: \"Ich habe keine Zeit.\"\nIndirekte Rede:",
   "opts":["Amina sagt, sie hatte keine Zeit.","Amina sagt, sie habe keine Zeit.","Amina sagt, sie hat keine Zeit.","Amina sagt, sie h\u00e4tte keine Zeit."],
   "ans":1,
   "hint":"haben \u2192 KI 3. Sg. = habe (nicht 'hat')!",
   "exp":"'habe' ist KI von 'haben'. 'hat' w\u00e4re Indikativ \u2014 nie in indirekter Rede.",
   "rule":"KI von haben: 3. Sg. \u2192 habe (Stamm hab- + -e)"},
  {"q":"Konjunktiv I wird haupts\u00e4chlich verwendet in:",
   "opts":["Alltagsgespr\u00e4chen","Indirekter Rede","Bedingungss\u00e4tzen","W\u00fcnschen"],
   "ans":1,
   "hint":"Zeitungen, Nachrichtenberichte, wissenschaftliche Texte...",
   "exp":"KI ist der Modus der indirekten Rede \u2014 typisch in Journalismus und akademischen Texten.",
   "rule":"Konjunktiv I = Distanzierung in indirekter Rede (nicht KI f\u00fcr W\u00fcnsche = KII)"},
],
"module-b2-2-passiv-erweitert.html": [
  {"q":"Was ist der Unterschied zwischen Vorgangs- und Zustandspassiv?",
   "opts":["Kein Unterschied","Vorgangspassiv = werden + P2, Zustandspassiv = sein + P2","Zustandspassiv = werden + P2","Beide benutzen haben"],
   "ans":1,
   "hint":"Vorgangspassiv: Handlung l\u00e4uft ab. Zustandspassiv: Ergebnis ist da.",
   "exp":"Vorgangspassiv (werden): Das Haus WIRD gebaut. Zustandspassiv (sein): Das Haus IST gebaut.",
   "rule":"Vorgangspassiv: werden + P2 | Zustandspassiv: sein + P2"},
  {"q":"Bilde Passiv:\n\"Man baut hier ein Haus.\"",
   "opts":["Ein Haus wird hier gebaut.","Ein Haus ist hier gebaut.","Ein Haus hat hier gebaut.","Hier baut ein Haus."],
   "ans":0,
   "hint":"Passiv Pr\u00e4sens = werden (Pr\u00e4s.) + Partizip II. 'Man' f\u00e4llt weg.",
   "exp":"Passiv: 'Man' f\u00e4llt weg, Akkusativobjekt wird Subjekt. werden + Partizip II.",
   "rule":"Aktiv mit 'man' \u2192 Passiv: man f\u00e4llt weg, Objekt = neues Subjekt"},
  {"q":"Zustandspassiv:\n\"Die T\u00fcr _____ geschlossen.\"",
   "opts":["wird","wurde","ist","hat"],
   "ans":2,
   "hint":"Zustand oder Vorgang? Die T\u00fcr ist schon zu \u2014 kein laufender Prozess.",
   "exp":"Zustandspassiv = sein + P2. 'Die T\u00fcr ist geschlossen' beschreibt den Zustand.",
   "rule":"Zustandspassiv: sein + P2 = beschreibt den Zustand nach einer Handlung"},
  {"q":"Passiv mit Modalverb:\n\"Das muss gemacht werden\" \u2014 welche Zeit?",
   "opts":["Perfekt","Pr\u00e4teritum","Pr\u00e4sens","Futur"],
   "ans":2,
   "hint":"muss = Pr\u00e4sens des Modalverbs",
   "exp":"Passiv + Modalverb im Pr\u00e4sens: Modalverb (Pr\u00e4s.) + P2 + werden.",
   "rule":"Passiv mit Modalverb: Modalverb + P2 + werden (Infinitiv Passiv)"},
  {"q":"Welcher Satz ist ein unpers\u00f6nliches Passiv?",
   "opts":["Es wird hier gearbeitet.","Hier arbeitet es.","Es hat gearbeitet.","Hier wird Arbeit."],
   "ans":0,
   "hint":"Unpers\u00f6nliches Passiv hat kein reales Subjekt \u2014 nur 'es' als Platzhalter.",
   "exp":"'Es wird hier gearbeitet' hat kein Subjekt. 'Es' ist nur Platzhalter.",
   "rule":"Unpers\u00f6nliches Passiv: es wird + Verb (kein reales Subjekt m\u00f6glich)"},
],
"module-b2-3-nominalisierung.html": [
  {"q":"Nominalisiere das Verb \"entwickeln\":",
   "opts":["die Entwickler","die Entwicklung","das Entwickeln","der Entwickel"],
   "ans":1,
   "hint":"Das h\u00e4ufigste Suffix f\u00fcr Verben im akademischen Stil?",
   "exp":"Viele Verben \u2192 Nomen auf -ung (feminin): entwickeln \u2192 die Entwicklung.",
   "rule":"Verb + -ung = feminines Substantiv (die Entwicklung, die Planung, die L\u00f6sung)"},
  {"q":"Welche Endung bildet feminine Nomen aus Verben?",
   "opts":["-er","-ung","-lich","-sam"],
   "ans":1,
   "hint":"-er = maskulin (der Lehrer), -ung = feminin (die Bildung)",
   "exp":"Das Suffix -ung bildet immer feminine Substantive aus Verben.",
   "rule":"-ung = feminin, -er = maskulin, -heit/-keit = feminin (aus Adjektiven)"},
  {"q":"Verbalisiere \"die Planung\":",
   "opts":["planieren","planen","plannen","geplant"],
   "ans":1,
   "hint":"Entferne das Suffix -ung und suche das Grundverb.",
   "exp":"die Planung \u2192 planen. Einfach das Suffix -ung entfernen und Infinitiv bilden.",
   "rule":"Nominalisierung r\u00fcck\u00e4ngig: -ung entfernen \u2192 Infinitiv (planen, l\u00f6sen, entwickeln)"},
  {"q":"Warum benutzt man Nominalisierung in formellen Texten?",
   "opts":["Es ist k\u00fcrzer","Es klingt formeller und akademischer","Es ist einfacher","Es ist grammatisch notwendig"],
   "ans":1,
   "hint":"Vergleiche: 'Man entwickelt etwas' vs. 'Die Entwicklung von etwas'",
   "exp":"Nominalisierungen verdichten Information und klingen formeller und akademischer.",
   "rule":"Nominalisierung = formeller, informativer Stil (typisch in B2-Schreiben)"},
  {"q":"Nominalisiere das Adjektiv \"wichtig\":",
   "opts":["die Wichtigkeit","die Wichtigung","das Wichtige","der Wichtig"],
   "ans":0,
   "hint":"Adjektive + -keit oder -heit \u2192 feminines Substantiv",
   "exp":"wichtig + -keit = die Wichtigkeit. Adjektive auf -ig nehmen meist -keit.",
   "rule":"Adjektiv + -keit/-heit = feminin (wichtig\u2192Wichtigkeit, Freiheit, Sicherheit)"},
],
"module-b2-4-konzessivsaetze.html": [
  {"q":"Welches Wort leitet einen Konzessivsatz ein?",
   "opts":["weil","damit","obwohl","sodass"],
   "ans":2,
   "hint":"Konzessiv = Gegensatz trotz Hindernis. Welches Wort dr\u00fcckt das aus?",
   "exp":"'Obwohl' leitet Konzessivsätze ein und drückt einen Widerspruch aus.",
   "rule":"Konzessivsatz: obwohl/obgleich/obschon + Verb am Ende"},
  {"q":"Was ist der Unterschied zwischen \"weil\" und \"da\"?",
   "opts":["Kein Unterschied","\"da\" steht meist am Satzanfang, \"weil\" kann \u00fcberall stehen","\"weil\" ist formeller","\"da\" ist nur m\u00fcndlich"],
   "ans":1,
   "hint":"'Da' leitet bekannte Gr\u00fcnde ein. Wo steht es im Satz?",
   "exp":"'Da' steht meist am Satzanfang f\u00fcr bekannte/offensichtliche Gr\u00fcnde. 'Weil' kann \u00fcberall stehen.",
   "rule":"da = bekannter Grund, meist satzeinleitend | weil = neuer Grund, flexibel"},
  {"q":"Finalsatz:\n\"Kwame lernt Deutsch, _____ er in Deutschland arbeiten kann.\"",
   "opts":["weil","obwohl","damit","sodass"],
   "ans":2,
   "hint":"Er hat ein Ziel \u2014 welche Konjunktion dr\u00fcckt Absicht aus?",
   "exp":"'Damit' leitet Finalsätze (Zweck/Absicht) ein. Kwame hat das Ziel, in Deutschland zu arbeiten.",
   "rule":"Finalsatz: damit + Nebensatz (Absicht) | um...zu + Inf. (gleiches Subjekt)"},
  {"q":"Konsekutivsatz:\n\"Es war so kalt, _____ Kofi seinen Mantel anzog.\"",
   "opts":["obwohl","damit","weil","dass"],
   "ans":3,
   "hint":"'So ... dass' = Folge. Was ist die Folge der K\u00e4lte?",
   "exp":"'So...dass' / 'sodass' leitet Konsekutivsätze ein. Die Folge: Kofi zieht den Mantel an.",
   "rule":"Konsekutivsatz: so + Adjektiv + dass / sodass (Folge/Ergebnis)"},
  {"q":"\"Trotzdem\" ist grammatisch ein:",
   "opts":["Konjunktion","Adverb","Pr\u00e4position","Artikel"],
   "ans":1,
   "hint":"Konjunktionen verbinden S\u00e4tze. Adverbien stehen im Satz. Was macht 'trotzdem'?",
   "exp":"'Trotzdem' ist ein konzessives Konjunktionaladverb. Es steht im Hauptsatz, kein Nebensatz!",
   "rule":"trotzdem = Adverb (Hauptsatz, Verb danach) | obwohl = Konj. (Nebensatz, Verb am Ende)"},
],
"module-b2-5-partizipialkonstruktionen.html": [
  {"q":"Partizip I von \"schlafen\":",
   "opts":["geschlafen","schlafend","geschlafend","schl\u00e4fend"],
   "ans":1,
   "hint":"Partizip I = Infinitiv + -d. Kein ge-!",
   "exp":"Partizip I: Infinitiv + -d \u2192 schlafen + d = schlafend.",
   "rule":"Partizip I: Infinitiv + -d (gleichzeitig, aktiv): lachend, laufend, schlafend"},
  {"q":"Wandle in Partizipialkonstruktion um:\n\"Der Mann, der im B\u00fcro arbeitet\"",
   "opts":["Der arbeitende Mann im B\u00fcro","Der gearbeitete Mann im B\u00fcro","Der Arbeitsmann im B\u00fcro","Der Mann arbeitend im B\u00fcro"],
   "ans":0,
   "hint":"Gleichzeitige aktive Handlung \u2192 Partizip I + Adjektivendung",
   "exp":"Partizip I (arbeitend) + Adjektivendung (-e) ersetzt den Relativsatz: der arbeitende Mann.",
   "rule":"Relativsatz (Gegenwart, aktiv) \u2192 Partizip I + Adjektivendung"},
  {"q":"Partizip II als Adjektiv:\n\"die _____ Pr\u00fcfung\" (bestehen)",
   "opts":["bestandene","bestandende","bestehenende","begehende"],
   "ans":0,
   "hint":"bestehen ist unregelmäßig. Partizip II + Adjektivendung.",
   "exp":"bestehen \u2192 bestanden (unregelmäßig). bestanden + -e = die bestandene Prüfung.",
   "rule":"Partizip II als Adjektiv: abgeschlossen, passiv (die bestandene Prüfung, das gelesene Buch)"},
  {"q":"Wof\u00fcr werden Partizipialkonstruktionen verwendet?",
   "opts":["Um Relativs\u00e4tze zu ersetzen","Um Modalverben zu ersetzen","Um Passiv zu bilden","Um Futur auszudr\u00fccken"],
   "ans":0,
   "hint":"Was kann man durch 'der laufende Mann' ersetzen?",
   "exp":"Partizipialkonstruktionen ersetzen Relativsätze kompakter, typisch in Schriftsprache.",
   "rule":"Partizipialkonstr. = kompakterer Relativsatz (typisch: formelle Schriftsprache)"},
  {"q":"\"Die von Kwame geschriebene Email...\"\nDas Partizip II ist hier:",
   "opts":["Attributiv","Pr\u00e4dikativ","Adverbial","Nominal"],
   "ans":0,
   "hint":"Es steht VOR dem Nomen und wird gebeugt \u2014 wie ein Adjektiv.",
   "exp":"Attributives Partizip: steht vor dem Nomen, wird wie Adjektiv gebeugt (geschriebene).",
   "rule":"Attributiv = vor dem Nomen + Endung | Pr\u00e4dikativ = nach sein/werden (ohne Endung)"},
],
"module-b2-6-modalpartikeln.html": [
  {"q":"Was macht \"doch\" in:\n\"Komm doch mal vorbei!\"",
   "opts":["Negation","Macht die Bitte freundlicher","Ausdruck von Zweifel","Zeitangabe"],
   "ans":1,
   "hint":"Ohne 'doch': direkter Befehl. Mit 'doch': ?",
   "exp":"'Doch' mildert Aufforderungen und macht sie weniger direkt und freundlicher.",
   "rule":"doch in Aufforderung = Abschwächung/freundlicher Ton"},
  {"q":"\"Das ist ja interessant!\"\n\"ja\" dr\u00fcckt hier aus:",
   "opts":["Zustimmung zu etwas Bekanntem/\u00dcberraschendem","Eine Frage","Negation","Zukunft"],
   "ans":0,
   "hint":"'Das ist ja...' \u2014 der Sprecher ist leicht \u00fcberrascht und findet es bemerkenswert.",
   "exp":"'Ja' drückt Bekanntheit oder Überraschung aus: 'das weißt du doch / das ist bemerkenswert'.",
   "rule":"ja = Bekanntheit oder Überraschung | nicht ja/nein als Antwort!"},
  {"q":"\"Eben\" und \"halt\" bedeuten:",
   "opts":["Jetzt sofort","So ist es nun mal, nicht zu \u00e4ndern","Vielleicht","Niemals"],
   "ans":1,
   "hint":"'Das ist eben so' \u2014 kann man das \u00e4ndern? Wie f\u00fchlt sich das an?",
   "exp":"'Eben/halt' drückt Unvermeidlichkeit aus: Das ist eben so = Das kann man nicht ändern.",
   "rule":"eben/halt = Unvermeidlichkeit, Selbstverst\u00e4ndlichkeit (regional: s\u00fcddeutsch: halt)"},
  {"q":"Modalpartikeln stehen meist:",
   "opts":["Am Satzanfang","Am Satzende","Im Mittelfeld","Vor dem Verb"],
   "ans":2,
   "hint":"Nach dem konjugierten Verb, aber vor den anderen Satzgliedern.",
   "exp":"Modalpartikeln stehen im Mittelfeld des Satzes, nach dem konjugierten Verb.",
   "rule":"Modalpartikeln: Position im Mittelfeld (nicht satzeinleitend, nicht betont)"},
  {"q":"\"Wohl\" dr\u00fcckt aus:",
   "opts":["Gesundheit","Vermutung/Wahrscheinlichkeit","Wunsch","Ablehnung"],
   "ans":1,
   "hint":"Er ist wohl krank. \u2014 Wei\u00df ich das sicher oder vermute ich das?",
   "exp":"'Wohl' drückt Vermutung aus: Er ist wohl krank = Er ist wahrscheinlich krank.",
   "rule":"wohl = Vermutung/Wahrscheinlichkeit (nicht: k\u00f6rperliches Wohlbefinden im Satz)"},
],
"module-b2-7-textanalyse.html": [
  {"q":"Was ist eine \"These\" in einer Er\u00f6rterung?",
   "opts":["Ein Beispiel","Eine Hauptbehauptung, die man verteidigt","Eine Zusammenfassung","Eine Frage"],
   "ans":1,
   "hint":"Die These ist der Ausgangspunkt \u2014 die Aussage, die man belegen will.",
   "exp":"Die These ist die zentrale Behauptung des Textes, die mit Argumenten belegt wird.",
   "rule":"These = Hauptaussage | Argument = Bel eg | Beispiel = Illustration"},
  {"q":"Welcher Konnektor leitet eine Schlussfolgerung ein?",
   "opts":["Einerseits","Obwohl","Zusammenfassend l\u00e4sst sich sagen","Zum Beispiel"],
   "ans":2,
   "hint":"Am Ende einer Analyse kommt ein Fazit. Welcher Ausdruck passt dazu?",
   "exp":"Schlusskonnektoren: zusammenfassend, insgesamt, abschlie\u00dfend, festzuhalten ist...",
   "rule":"Schluss: zusammenfassend / insgesamt / abschlie\u00dfend + l\u00e4sst sich sagen"},
  {"q":"Was ist ein Kommentar (Textsorte)?",
   "opts":["Eine neutrale Beschreibung","Eine subjektive Meinungs\u00e4u\u00dferung zu einem aktuellen Thema","Eine Zusammenfassung","Ein Bericht"],
   "ans":1,
   "hint":"Neutral oder wertend? Der Autor zeigt klar seine Haltung.",
   "exp":"Ein Kommentar ist eine wertende Stellungnahme \u2014 der Autor \u00e4u\u00dfert klar seine Meinung.",
   "rule":"Kommentar = subjektiv, wertend | Bericht = objektiv, sachlich"},
  {"q":"TAES steht f\u00fcr:",
   "opts":["Text, Analyse, Ergebnis, Schluss","These, Argument, Beispiel, Schlussfolgerung","Thema, Aufsatz, Er\u00f6rterung, Satz","Text, Aufgabe, Erkl\u00e4rung, Satz"],
   "ans":1,
   "hint":"TAES ist die Argumentationsstruktur f\u00fcr einen Absatz.",
   "exp":"TAES = These, Argument, Beispiel, Schlussfolgerung \u2014 Struktur eines Argumentationsabsatzes.",
   "rule":"TAES: These \u2192 Argument (Warum?) \u2192 Beispiel (z.B.) \u2192 Schlussfolgerung (Also...)"},
  {"q":"\"Im Gegensatz dazu\" leitet ein:",
   "opts":["Beispiel","Ursache","Gegenargument","Schluss"],
   "ans":2,
   "hint":"'Im Gegensatz' \u2014 was f\u00fcr eine Beziehung zwischen zwei Ideen?",
   "exp":"'Im Gegensatz dazu' ist ein adversatives Konnektiv f\u00fcr Gegenargumente.",
   "rule":"adversativ (Gegensatz): im Gegensatz dazu, w\u00e4hrend, andererseits, jedoch"},
],
"module-b2-8-wissenschaftlich.html": [
  {"q":"Welche Anrede ist korrekt in einer formellen E-Mail?",
   "opts":["Hey!","Hallo du!","Sehr geehrte Damen und Herren,","Liebe Firma,"],
   "ans":2,
   "hint":"Formell = kein Vorname, kein 'Hey', korrekte Anrede.",
   "exp":"'Sehr geehrte Damen und Herren' ist die standardm\u00e4\u00dfige formelle Anrede f\u00fcr unbekannte Empf\u00e4nger.",
   "rule":"Formell (unbekannt): Sehr geehrte/r | Halbformell (bekannt): Guten Tag Herr/Frau"},
  {"q":"Akademischer Stil vermeidet:",
   "opts":["Lange S\u00e4tze","Fachbegriffe","Umgangssprache und Ich-Perspektive","Passivkonstruktionen"],
   "ans":2,
   "hint":"Wissenschaftliches Schreiben ist objektiv \u2014 was geh\u00f6rt nicht dazu?",
   "exp":"Akademisches Schreiben ist objektiv: kein 'ich finde', keine Umgangssprache, kein 'mega'.",
   "rule":"Akademisch: Passiv bevorzugt, keine Ich-Form, Fachbegriffe, keine Umgangssprache"},
  {"q":"Ein Bewerbungsschreiben beginnt mit:",
   "opts":["Meinem Lebenslauf","Einer Betreffzeile und formeller Anrede","Meinen Hobbys","Meinem Gehaltswunsch"],
   "ans":1,
   "hint":"Betreff \u2192 Anrede \u2192 Einleitung \u2192 K\u00f6rper \u2192 Abschluss",
   "exp":"Bewerbungsschreiben: Betreff \u2192 formelle Anrede \u2192 Einleitung \u2192 Erfahrungen \u2192 Abschluss.",
   "rule":"Bewerbung: Betreff, Anrede, Motivation, Qualifikationen, Abschluss, Gruss"},
  {"q":"\"Mit freundlichen Gr\u00fc\u00dfen\" verwendet man:",
   "opts":["In informellen E-Mails","An Freunde","Am Ende formeller Korrespondenz","Nur in Briefen"],
   "ans":2,
   "hint":"Der formelle Abschluss \u2014 nicht nur Briefe, auch E-Mails!",
   "exp":"'Mit freundlichen Gr\u00fc\u00dfen' ist der formelle Abschluss von E-Mails UND Briefen.",
   "rule":"Formell: Mit freundlichen Gr\u00fc\u00dfen | Halbformell: Viele Gr\u00fc\u00dfe | Informell: Liebe Gr\u00fc\u00dfe"},
  {"q":"Was geh\u00f6rt NICHT in ein Bewerbungsschreiben?",
   "opts":["Motivation f\u00fcr die Stelle","Relevante Erfahrungen","Pers\u00f6nliche Probleme","Kontaktdaten"],
   "ans":2,
   "hint":"Was w\u00fcrde einen Arbeitgeber abschrecken oder ist irrelevant?",
   "exp":"Pers\u00f6nliche Probleme sind f\u00fcr eine Bewerbung unangemessen und irrelevant.",
   "rule":"Bewerbung: NUR Relevantes! Keine Probleme, keine Privatinformationen"},
],
"module-b2-9-diskussion.html": [
  {"q":"Wie widerspricht man h\u00f6flich?",
   "opts":["Das ist falsch!","Ich sehe das etwas anders, weil...","Nein!","Du hast keine Ahnung."],
   "ans":1,
   "hint":"H\u00f6flicher Widerspruch beginnt mit einer Abschwächung.",
   "exp":"'Ich sehe das etwas anders' signalisiert H\u00f6flichkeit und l\u00e4dt zur Diskussion ein.",
   "rule":"H\u00f6flicher Widerspruch: Ich sehe das anders / Da m\u00f6chte ich widersprechen..."},
  {"q":"\"Ich bin der Meinung, dass...\" ist ein Ausdruck f\u00fcr:",
   "opts":["Zustimmung","Meinungs\u00e4u\u00dferung","Widerspruch","Zusammenfassung"],
   "ans":1,
   "hint":"Der Satz beginnt mit 'Ich bin...' \u2014 was teilt man damit mit?",
   "exp":"'Ich bin der Meinung...' ist eine typische Formel zur Meinungs\u00e4u\u00dferung im B2-Sprechen.",
   "rule":"Meinungs\u00e4u\u00dferung: Ich bin der Meinung / Ich finde / Meiner Ansicht nach..."},
  {"q":"Bei einer B2-Diskussion sollte man:",
   "opts":["Nur die eigene Meinung sagen","Argumente mit Beispielen belegen","Sehr schnell sprechen","Keine Fragen stellen"],
   "ans":1,
   "hint":"Was macht ein Argument \u00fcberzeugend?",
   "exp":"Argumente mit Beispielen zu belegen macht sie \u00fcberzeugender und zeigt Sprachkompetenz.",
   "rule":"Diskussion B2: These + Argument + Beispiel (TAES-Struktur auch im Sprechen)"},
  {"q":"\"Einerseits... andererseits...\" zeigt:",
   "opts":["Chronologie","Zwei Perspektiven/Gegen\u00fcberstellung","Ursache und Wirkung","Zusammenfassung"],
   "ans":1,
   "hint":"Zwei Seiten einer Sache \u2014 welche Beziehung ist das?",
   "exp":"'Einerseits... andererseits...' stellt zwei Perspektiven oder Argumente gegenüber.",
   "rule":"einerseits...andererseits = Gegen\u00fcberstellung (balanced argument)"},
  {"q":"Um Zeit beim Sprechen zu gewinnen, sagt man:",
   "opts":["Nichts \u2014 einfach schweigen","Das ist eine gute Frage, ich \u00fcberlege kurz...","Ich wei\u00df es nicht.","N\u00e4chste Frage bitte."],
   "ans":1,
   "hint":"Zeitgewinner klingen nat\u00fcrlich und zeigen Sprachkompetenz.",
   "exp":"Solche Phrasen geben Zeit zum Nachdenken ohne unangenehme Pausen.",
   "rule":"Zeitgewinner: Das ist eine interessante Frage / Ich m\u00f6chte kurz \u00fcberlegen..."},
],
"module-b2-10-hoeren-lesen-b2.html": [
  {"q":"Was ist \"Skimming\"?",
   "opts":["Jedes Wort genau lesen","Schnelles \u00dcberfliegen zum Hauptthema verstehen","Nur die \u00dcberschriften lesen","R\u00fcckw\u00e4rts lesen"],
   "ans":1,
   "hint":"Wie liest man eine Zeitung in 2 Minuten?",
   "exp":"Skimming = globales Lesen: schnell \u00fcberfliegen, um das Hauptthema zu erfassen.",
   "rule":"Skimming = globales Lesen (Hauptthema) | Scanning = selektives Lesen (Details)"},
  {"q":"Bei H\u00f6raufgaben sollte man:",
   "opts":["Alles w\u00f6rtlich aufschreiben","Schl\u00fcsselw\u00f6rter und Hauptideen notieren","Die Augen schlie\u00dfen","Nichts aufschreiben"],
   "ans":1,
   "hint":"Was ist wichtiger: jedes Wort oder die Hauptaussage?",
   "exp":"Schl\u00fcsselw\u00f6rter und Hauptideen notieren ist effizienter als alles aufschreiben.",
   "rule":"H\u00f6rstrategie: VOR dem H\u00f6ren Fragen lesen, W\u00e4HREND des H\u00f6rens Schl\u00fcsselbegriffe notieren"},
  {"q":"\"Selektives Lesen\" bedeutet:",
   "opts":["Alles lesen","Nur interessante Teile lesen","Gezielt nach bestimmten Informationen suchen","Sehr langsam lesen"],
   "ans":2,
   "hint":"Stell dir vor: du suchst in einem Text nach einer Jahreszahl.",
   "exp":"Selektives Lesen (Scanning) = gezielt nach spezifischen Informationen suchen.",
   "rule":"Scanning = selektives Lesen (Zahlen, Namen, Details suchen)"},
  {"q":"Was macht man bei einem unbekannten Wort im Text?",
   "opts":["Sofort aufh\u00f6ren","Kontext nutzen um Bedeutung zu erschlie\u00dfen","Das W\u00f6rterbuch nehmen","Den Text neu beginnen"],
   "ans":1,
   "hint":"In der Pr\u00fcfung gibt es kein W\u00f6rterbuch \u2014 was jetzt?",
   "exp":"Den Kontext nutzen spart Zeit und ist die wichtigste Lesestrategie in der Pr\u00fcfung.",
   "rule":"Unbekannte W\u00f6rter: Kontext, Wortbildung (Pr\u00e4fixe/Suffixe) nutzen"},
  {"q":"Globalverstehen bedeutet:",
   "opts":["Den ganzen Text \u00fcbersetzen","Jedes Detail verstehen","Den allgemeinen Inhalt und die Hauptideen verstehen","Nur den Anfang lesen"],
   "ans":2,
   "hint":"Global = das Gro\u00dfe Bild. Was versteht man dabei?",
   "exp":"Globalverstehen = das Hauptthema und die Hauptideen eines Textes erfassen.",
   "rule":"Globalverstehen: Thema + Hauptideen | Detailverstehen: spezifische Fakten"},
],
"module-b2-11-wortschatz-b2.html": [
  {"q":"\"Die Nachhaltigkeit\" bedeutet:",
   "opts":["Schnelles Wachstum","Langfristig umweltvertr\u00e4gliches Handeln","Wirtschaftlicher Gewinn","Technologischer Fortschritt"],
   "ans":1,
   "hint":"'Nachhalt-' \u2192 nachhalten = langfristig bestehen bleiben",
   "exp":"Nachhaltigkeit = Ressourcen so nutzen, dass sie f\u00fcr k\u00fcnftige Generationen erhalten bleiben.",
   "rule":"Nachhaltigkeit: langfristig, umweltfreundlich, zukunftsorientiert"},
  {"q":"\"Integration\" im gesellschaftlichen Kontext bedeutet:",
   "opts":["Mathematische Berechnung","Eingliederung in die Gesellschaft","Computerprogrammierung","Sprachkurs besuchen"],
   "ans":1,
   "hint":"'Integrieren' = eingliedern. In welchen Kontext?",
   "exp":"Gesellschaftliche Integration = Menschen werden gleichberechtigter Teil der Gesellschaft.",
   "rule":"Integration (gesellschaftlich): Eingliederung, Teilhabe, Chancengleichheit"},
  {"q":"\"Die Fachkraft\" bedeutet:",
   "opts":["Ein Werkzeug","Eine qualifizierte Person in einem Berufsfeld","Ein Unternehmen","Eine Beh\u00f6rde"],
   "ans":1,
   "hint":"Fach = Bereich, Kraft = Person. Was ergibt das zusammen?",
   "exp":"Fachkraft = eine Person mit spezifischer Berufsausbildung (z.B. IT-Fachkraft).",
   "rule":"Fachkraft = qualifizierter Berufst\u00e4tiger | Fachmann/-frau = \u00e4hnlich, gender-spezifisch"},
  {"q":"\"Globalisierung\" beschreibt:",
   "opts":["Lokale Entwicklungen","Weltweite Vernetzung von Wirtschaft und Gesellschaft","Einen Computerbegriff","Einen geografischen Begriff"],
   "ans":1,
   "hint":"Global = weltweit. -isierung = Prozess. Also?",
   "exp":"Globalisierung = weltweite wirtschaftliche, kulturelle und politische Vernetzung.",
   "rule":"Globalisierung: Vernetzung, Welthandel, Migration, kultureller Austausch"},
  {"q":"\"Die Beh\u00f6rde\" ist:",
   "opts":["Ein privates Unternehmen","Eine staatliche Verwaltungseinrichtung","Eine Schule","Ein Krankenhaus"],
   "ans":1,
   "hint":"'Beh\u00f6rde' kommt von 'geh\u00f6ren' (dem Staat). Was ist das?",
   "exp":"Beh\u00f6rde = staatliche/\u00f6ffentliche Verwaltungsstelle, z.B. Ausl\u00e4nderamt, Finanzamt.",
   "rule":"Beh\u00f6rde = \u00f6ffentliche Verwaltung (nicht privat!): Amt, Beh\u00f6rde, Ministerium"},
],
"module-b2-12-schreiben-b2.html": [
  {"q":"Eine Er\u00f6rterung hat folgende Struktur:",
   "opts":["Begr\u00fc\u00dfung, Hauptteil, Abschied","Einleitung, Hauptteil (Pro/Kontra), Schluss","These, Antithese","Nur Argumente"],
   "ans":1,
   "hint":"Wie jeder argumentative Text: Anfang, Mitte, Ende",
   "exp":"Er\u00f6rterung: Einleitung (Thema) \u2192 Hauptteil (Pro/Kontra) \u2192 Schluss (Fazit).",
   "rule":"Er\u00f6rterung: Einleitung (These) | Hauptteil (Arg. + Gegenarg.) | Schluss (Fazit)"},
  {"q":"Ein Leserbrief beginnt mit:",
   "opts":["Hallo Redaktion!","Einer formellen Anrede und Bezug auf den Artikel","Einer Zusammenfassung","Pers\u00f6nlichen Daten"],
   "ans":1,
   "hint":"Wie jeder formelle Brief: Anrede zuerst, dann Bezug herstellen.",
   "exp":"Leserbrief: formelle Anrede \u2192 Bezug auf den Artikel \u2192 eigene Meinung mit Begr\u00fcndung.",
   "rule":"Leserbrief: Anrede, Bezug auf Artikel, Meinung + Argumente, Abschluss"},
  {"q":"Was geh\u00f6rt in die Einleitung einer Er\u00f6rterung?",
   "opts":["Alle Argumente","Das Thema vorstellen und Interesse wecken","Die Schlussfolgerung","Pers\u00f6nliche Daten"],
   "ans":1,
   "hint":"Die Einleitung ist wie eine T\u00fcr \u2014 sie l\u00e4dt ein, weiterzulesen.",
   "exp":"Die Einleitung f\u00fchrt in das Thema ein und weckt das Interesse des Lesers.",
   "rule":"Einleitung: Aufh\u00e4nger + Thema vorstellen + \u00dcberleitung zum Hauptteil"},
  {"q":"Beim Zusammenfassen:",
   "opts":["Kopiert man den Text","Gibt man alle Details wieder","Fasst man Hauptpunkte in eigenen Worten zusammen","Schreibt man seine Meinung"],
   "ans":2,
   "hint":"Zusammenfassen \u2260 kopieren. Was ist der Kernpunkt?",
   "exp":"Zusammenfassen = Hauptpunkte in eigenen Worten, k\u00fcrzer als das Original.",
   "rule":"Zusammenfassung: eigene Worte, kurz, nur Hauptpunkte, keine eigene Meinung"},
  {"q":"\"Dar\u00fcber hinaus\" dient als:",
   "opts":["Schlussfolgerung","Widerspruch","Zus\u00e4tzliches Argument","Einleitung"],
   "ans":2,
   "hint":"'Hinaus' = weiter, mehr. Was f\u00fcgt man damit ein?",
   "exp":"'Dar\u00fcber hinaus' ist additiv: es f\u00fcgt ein weiteres Argument zum vorherigen hinzu.",
   "rule":"additiv (mehr): dar\u00fcber hinaus, au\u00dferdem, zus\u00e4tzlich, ferner, nicht zuletzt"},
],
"module-b2-13-sprechen-b2.html": [
  {"q":"Eine B2-Pr\u00e4sentation dauert ca.:",
   "opts":["1 Minute","3\u20135 Minuten","10 Minuten","30 Minuten"],
   "ans":1,
   "hint":"Weder zu kurz noch zu lang \u2014 professioneller Vortrag.",
   "exp":"Die B2-Pr\u00e4sentation (Monolog) dauert ca. 3\u20135 Minuten.",
   "rule":"B2 Sprechteil: Monolog (3\u20135 Min.) | Diskussion | Bildbeschreibung"},
  {"q":"Wie beginnt man eine Pr\u00e4sentation?",
   "opts":["Sofort mit Details","Mit Begr\u00fc\u00dfung, Thema vorstellen und Gliederung","Mit einer langen Geschichte","Mit Fragen ans Publikum"],
   "ans":1,
   "hint":"Begrüßung → Thema → Was kommt? (Gliederung) → Inhalt",
   "exp":"Gute Struktur: Begr\u00fc\u00dfung \u2192 Thema nennen \u2192 kurze Gliederung \u2192 Inhalt.",
   "rule":"Pr\u00e4sentation: Einleitung (Guten Tag, ich m\u00f6chte \u00fcber X sprechen, ich werde...)"},
  {"q":"Bei der Bildbeschreibung B2:",
   "opts":["Nur beschreiben was man sieht","Beschreiben, interpretieren und Meinung \u00e4u\u00dfern","Nur die Farben nennen","Das Bild \u00fcbersetzen"],
   "ans":1,
   "hint":"B2 = mehr als nur beschreiben. Was kommt noch?",
   "exp":"B2-Bildbeschreibung = beschreiben + interpretieren + eigene Meinung \u00e4u\u00dfern.",
   "rule":"Bildbeschreibung B2: Was sehe ich? Was bedeutet das? Was denke ich dar\u00fcber?"},
  {"q":"Wenn man ein Wort vergisst:",
   "opts":["Aufh\u00f6ren zu sprechen","Ich wei\u00df nicht sagen","Umschreiben und weitersprechen","Auf Englisch sagen"],
   "ans":2,
   "hint":"Umschreiben zeigt Sprachkompetenz \u2014 kein Grund zur Panik!",
   "exp":"Umschreiben zeigt Sprachkompetenz: 'das Ding, mit dem man schreibt' = Stift.",
   "rule":"Vergessen? Umschreiben! Ein Wort vergessen \u2260 Fehler \u2014 es zeigt Strategiekompetenz"},
  {"q":"Pr\u00fcfungsangst bek\u00e4mpft man durch:",
   "opts":["Gar nicht \u00fcben","Regelm\u00e4\u00dfiges \u00dcben und positive Selbstgespr\u00e4che","Viel Kaffee trinken","Die Pr\u00fcfung vermeiden"],
   "ans":1,
   "hint":"Was hat nachweislich Erfolg bei Pr\u00fcfungsangst?",
   "exp":"Regelm\u00e4\u00dfiges \u00dcben und positive Gedanken reduzieren Pr\u00fcfungsangst nachweislich.",
   "rule":"Anti-Angst: \u00fcben, vorbereiten, Atemtechniken, positive Visualisierung"},
],
"module-b2-14-pruefungsvorbereitung.html": [
  {"q":"Wie viel sollte man vor der Pr\u00fcfung schlafen?",
   "opts":["Die ganze Nacht lernen","Mindestens 7\u20138 Stunden gut schlafen","4 Stunden reichen","Schlafen ist unwichtig"],
   "ans":1,
   "hint":"Das Gehirn braucht Schlaf zum Konsolidieren von Gelerntem.",
   "exp":"Schlaf ist entscheidend f\u00fcr Konzentration und Ged\u00e4chtnis am Pr\u00fcfungstag.",
   "rule":"Pr\u00fcfungstag: gut schlafen, fr\u00fch\u00fcbst\u00fccken, fr\u00fchzeitig ankommen"},
  {"q":"Was macht man, wenn man eine Aufgabe nicht versteht?",
   "opts":["Die Pr\u00fcfung abgeben","Leer lassen und weitermachen, am Ende zur\u00fcckkommen","Raten ohne nachzudenken","Den Pr\u00fcfer fragen"],
   "ans":1,
   "hint":"Keine Zeit verschwenden bei schwierigen Aufgaben!",
   "exp":"Weitermachen und zur\u00fcckkommen spart Zeit und reduziert Stress in der Pr\u00fcfung.",
   "rule":"Zeitmanagement: \u00dcberspringen ist erlaubt! Am Ende zur\u00fcckkommen."},
  {"q":"Gutes Zeitmanagement in der Pr\u00fcfung bedeutet:",
   "opts":["So schnell wie m\u00f6glich fertig sein","Zeit pro Aufgabe einteilen und einhalten","Beim ersten Fehler aufh\u00f6ren","Alles zweimal schreiben"],
   "ans":1,
   "hint":"Wie plant man 90 Minuten f\u00fcr 4 Teile?",
   "exp":"Zeitplan: z.B. Lesen 30 Min, H\u00f6ren 30 Min, Schreiben 40 Min einhalten.",
   "rule":"Zeitplan erstellen und einhalten! Nicht zu lang bei einem Teil bleiben."},
  {"q":"Kurz vor der Pr\u00fcfung sollte man:",
   "opts":["Neue Grammatik lernen","Bekannte Themen wiederholen und sich ausruhen","Die ganze Nacht lernen","Nichts tun"],
   "ans":1,
   "hint":"Was bringt mehr: Neues oder Bekanntes? Kurz vor der Pr\u00fcfung?",
   "exp":"Bekanntes wiederholen ist effektiver als kurz vor der Pr\u00fcfung Neues zu lernen.",
   "rule":"Letzte Tage: Wiederholung + ausruhen, kein neuer Stoff mehr!"},
  {"q":"Nach einer nicht bestandenen Pr\u00fcfung sollte man:",
   "opts":["Nie wieder versuchen","Analysieren was falsch war und nochmal anmelden","Aufgeben","Sich sch\u00e4men"],
   "ans":1,
   "hint":"Misserfolg ist Teil des Lernprozesses. Was macht man damit?",
   "exp":"Jede Pr\u00fcfung ist eine Lernm\u00f6glichkeit. Analysieren, verbessern, nochmal versuchen!",
   "rule":"Nicht bestanden? Feedback holen, Schw\u00e4chen analysieren, erneut anmelden!"},
],
}

NEXT_MOD = {
  "module-b2-1-konjunktiv1.html":            "module-b2-2-passiv-erweitert.html",
  "module-b2-2-passiv-erweitert.html":        "module-b2-3-nominalisierung.html",
  "module-b2-3-nominalisierung.html":         "module-b2-4-konzessivsaetze.html",
  "module-b2-4-konzessivsaetze.html":         "module-b2-5-partizipialkonstruktionen.html",
  "module-b2-5-partizipialkonstruktionen.html":"module-b2-6-modalpartikeln.html",
  "module-b2-6-modalpartikeln.html":          "module-b2-7-textanalyse.html",
  "module-b2-7-textanalyse.html":             "module-b2-8-wissenschaftlich.html",
  "module-b2-8-wissenschaftlich.html":        "module-b2-9-diskussion.html",
  "module-b2-9-diskussion.html":              "module-b2-10-hoeren-lesen-b2.html",
  "module-b2-10-hoeren-lesen-b2.html":        "module-b2-11-wortschatz-b2.html",
  "module-b2-11-wortschatz-b2.html":          "module-b2-12-schreiben-b2.html",
  "module-b2-12-schreiben-b2.html":           "module-b2-13-sprechen-b2.html",
  "module-b2-13-sprechen-b2.html":            "module-b2-14-pruefungsvorbereitung.html",
  "module-b2-14-pruefungsvorbereitung.html":  "deutschweg-prototype.html",
}


def remove_old_ubq(html):
    """Remove previous ubq- CSS, HTML, and JS blocks."""
    # Remove ubq CSS block
    html = re.sub(r'\n  /\* ===== UEBUNGSAUFGABEN ===== \*/.*?(?=\n</style>)', '', html, flags=re.DOTALL)
    # Remove ubq HTML block (from UEBUNGSAUFGABEN comment to ubqWrap closing </div>)
    html = re.sub(r'\n    <!-- UEBUNGSAUFGABEN -->.*?</div>\n', '\n', html, flags=re.DOTALL)
    # Remove ubq JS block
    html = re.sub(r'\n  // ===== UEBUNGSAUFGABEN =====.*?(?=\n</script>)', '', html, flags=re.DOTALL)
    # Remove UBQ light theme overrides
    html = re.sub(r'\n  \.ubq-opt\{.*?(?=\n  \.ubq-letter)', '', html, flags=re.DOTALL)
    html = re.sub(r'\n  \.ubq-letter\{[^\n]*\}\n', '\n', html)
    return html


def process(fname):
    path = os.path.join(BASE, fname)
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Remove old ubq quiz
    html = remove_old_ubq(html)

    # 2. Skip if already has obq quiz
    if 'obqWrap' in html:
        print("  SKIP %s (already has obq quiz)" % fname)
        return

    # 3. Add minimal OBQ CSS before first </style>
    html = html.replace('</style>', OBQ_CSS + '\n</style>', 1)

    # 4. Add HTML after start button
    marker = u'Lektion 1 beginnen \u2192</button>'
    if marker not in html:
        print("  WARN %s: start button not found" % fname)
        return
    html = html.replace(marker, marker + OBQ_HTML, 1)

    # 5. Build and inject JS before last </script>
    quiz_data_json = json.dumps(QUIZ[fname], ensure_ascii=True)
    next_href = NEXT_MOD.get(fname, 'deutschweg-prototype.html')
    quiz_js = OBQ_JS_TPL % (quiz_data_json, next_href)
    last_script = html.rfind('</script>')
    if last_script == -1:
        print("  WARN %s: no </script>" % fname)
        return
    html = html[:last_script] + quiz_js + '\n</script>' + html[last_script+9:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("  OK   %s" % fname)


print("Replacing ubq- quiz with obq- (B1-style) in 14 B2 modules...")
for fname in sorted(QUIZ.keys()):
    process(fname)
print("Done!")
