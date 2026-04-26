#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os, re, json

BASE = os.path.dirname(os.path.abspath(__file__))

QUIZ_CSS = """
  /* ===== STANDALONE QUIZ ===== */
  .sq-wrap{background:var(--card-bg);border:1px solid var(--border);border-radius:20px;padding:28px;margin-top:32px;}
  .sq-title{font-family:'Playfair Display',serif;font-size:20px;margin-bottom:6px;}
  .sq-sub{font-size:13px;color:var(--gray);margin-bottom:20px;}
  .sq-dots{display:flex;gap:8px;margin-bottom:20px;}
  .sq-dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.15);transition:all 0.3s;}
  .sq-dot.active{background:var(--blue);width:22px;border-radius:4px;}
  .sq-dot.done{background:var(--green);}
  .sq-dot.wrong{background:var(--red);}
  .sq-q{font-size:16px;font-weight:600;margin-bottom:16px;line-height:1.5;}
  .sq-opts{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;}
  .sq-opt{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;padding:12px 16px;cursor:pointer;font-size:14px;transition:all 0.2s;text-align:left;}
  .sq-opt:hover:not(.disabled){background:rgba(52,152,219,0.12);border-color:var(--blue);}
  .sq-opt.selected{background:rgba(52,152,219,0.15);border-color:var(--blue);}
  .sq-opt.correct{background:rgba(39,174,96,0.15);border-color:var(--green);color:var(--green);}
  .sq-opt.wrong{background:rgba(192,57,43,0.15);border-color:var(--red);color:var(--red);}
  .sq-opt.disabled{cursor:default;pointer-events:none;}
  .sq-fb{font-size:14px;padding:12px 16px;border-radius:10px;margin-bottom:16px;display:none;}
  .sq-fb.show{display:block;}
  .sq-fb.ok{background:rgba(39,174,96,0.12);border:1px solid rgba(39,174,96,0.3);color:var(--green);}
  .sq-fb.ko{background:rgba(192,57,43,0.12);border:1px solid rgba(192,57,43,0.3);color:#e07070;}
  .sq-next{display:none;}
  .sq-next.show{display:inline-block;}
  .sq-result{display:none;text-align:center;padding:20px 0;}
  .sq-result.show{display:block;}
  .sq-score-num{font-family:'Playfair Display',serif;font-size:48px;color:var(--blue);margin-bottom:8px;}
  .sq-score-msg{font-size:20px;margin-bottom:24px;}
  .sq-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
  .sq-btns .btn{width:auto;padding:12px 28px;}
"""

QUIZ_HTML = """
    <!-- STANDALONE QUIZ -->
    <div class="sq-wrap" id="sqWrap">
      <div id="sqQuestion">
        <div class="sq-title">Wissenstest</div>
        <div class="sq-sub">5 Fragen &mdash; teste dein Wissen!</div>
        <div class="sq-dots" id="sqDots"></div>
        <div class="sq-q" id="sqQText"></div>
        <div class="sq-opts" id="sqOpts"></div>
        <div class="sq-fb" id="sqFb"></div>
        <button class="btn btn-primary sq-next" id="sqNext" onclick="sqAdvance()">Weiter &#x2192;</button>
      </div>
      <div class="sq-result" id="sqResult">
        <div class="sq-score-num" id="sqScoreNum">0/5</div>
        <div class="sq-score-msg" id="sqScoreMsg"></div>
        <div class="sq-btns">
          <button class="btn btn-outline" onclick="sqReset()">Nochmal versuchen</button>
          <button class="btn btn-primary" id="sqNextMod">N&#xE4;chstes Modul &#x2192;</button>
        </div>
      </div>
    </div>
"""

QUIZ_JS_TPL = """
  // ===== STANDALONE QUIZ =====
  var SQ_DATA = %s;
  var sqIdx=0, sqScore=0, sqAnswered=false;
  var sqResults=[];
  function sqInit(){sqIdx=0;sqScore=0;sqAnswered=false;sqResults=[];sqRender();}
  function sqRender(){
    var d=SQ_DATA[sqIdx];
    document.getElementById('sqQuestion').style.display='block';
    document.getElementById('sqResult').classList.remove('show');
    document.getElementById('sqQText').textContent=(sqIdx+1)+'. '+d.q;
    var dots=document.getElementById('sqDots');
    dots.innerHTML='';
    for(var i=0;i<5;i++){
      var dot=document.createElement('div');
      var cls='sq-dot';
      if(i<sqIdx){ cls+= sqResults[i]?' done':' wrong'; }
      else if(i===sqIdx){ cls+=' active'; }
      dot.className=cls;
      dots.appendChild(dot);
    }
    var opts=document.getElementById('sqOpts');
    opts.innerHTML='';
    d.opts.forEach(function(o,i){
      var b=document.createElement('button');
      b.className='sq-opt';
      b.textContent=o;
      (function(idx){b.onclick=function(){sqPick(idx);};})(i);
      opts.appendChild(b);
    });
    var fb=document.getElementById('sqFb');
    fb.className='sq-fb';
    fb.textContent='';
    document.getElementById('sqNext').className='btn btn-primary sq-next';
    sqAnswered=false;
  }
  function sqPick(idx){
    if(sqAnswered)return;
    sqAnswered=true;
    var d=SQ_DATA[sqIdx];
    var opts=document.getElementById('sqOpts').querySelectorAll('.sq-opt');
    opts.forEach(function(b){b.classList.add('disabled');});
    var ok=(idx===d.ans);
    if(ok){sqScore++;sqResults[sqIdx]=true;}else{sqResults[sqIdx]=false;}
    opts[idx].classList.add(ok?'correct':'wrong');
    if(!ok) opts[d.ans].classList.add('correct');
    var fb=document.getElementById('sqFb');
    fb.textContent=ok?d.fb_ok:d.fb_ko;
    fb.className='sq-fb show '+(ok?'ok':'ko');
    document.getElementById('sqNext').className='btn btn-primary sq-next show';
  }
  function sqAdvance(){
    if(sqIdx<4){sqIdx++;sqRender();}else{sqShowResult();}
  }
  function sqShowResult(){
    document.getElementById('sqQuestion').style.display='none';
    var res=document.getElementById('sqResult');
    res.className='sq-result show';
    document.getElementById('sqScoreNum').textContent=sqScore+'/5';
    var msgs=['Nicht aufgeben! \\u{1F31F}','Nicht aufgeben! \\u{1F31F}','Weiter \u00fcben! \\u{1F4DA}','Gut gemacht! \\u{1F4AA}','Sehr gut! \\u{1F44F}','Ausgezeichnet! \\u{1F389}'];
    document.getElementById('sqScoreMsg').textContent=msgs[sqScore];
  }
  function sqReset(){
    sqIdx=0;sqScore=0;sqAnswered=false;sqResults=[];
    document.getElementById('sqResult').className='sq-result';
    document.getElementById('sqQuestion').style.display='block';
    sqRender();
  }
  document.addEventListener('DOMContentLoaded',function(){sqInit();});
"""

QUIZ_DATA = {
  "module-b2-1-konjunktiv1.html": [
    {"q":"Welche Funktion hat der Konjunktiv I hauptsaechlich?","opts":["Wunsch ausdruecken","Indirekte Rede wiedergeben","Vergangenheit beschreiben","Bedingungen formulieren"],"ans":1,"fb_ok":"Richtig! Konjunktiv I wird vor allem fuer indirekte Rede verwendet.","fb_ko":"Falsch. Der Konjunktiv I dient hauptsaechlich zur Wiedergabe indirekter Rede."},
    {"q":"Wie lautet die Konjunktiv-I-Form von 'er kommt'?","opts":["er kaeme","er komme","er kommen","er ist gekommen"],"ans":1,"fb_ok":"Richtig! 'er komme' ist die korrekte Konjunktiv-I-Form.","fb_ko":"Falsch. Die korrekte Form lautet 'er komme' (Stamm + -e)."},
    {"q":"Wann muss Konjunktiv II statt Konjunktiv I verwendet werden?","opts":["Bei Verben im Praeteritum","Wenn KI mit dem Indikativ identisch waere","Bei Modalverben immer","In der Zukunftsform immer"],"ans":1,"fb_ok":"Richtig! Wenn die KI-Form mit dem Indikativ uebereinstimmt, nimmt man KII.","fb_ko":"Falsch. Man nimmt KII, wenn die KI-Form nicht eindeutig vom Indikativ zu unterscheiden ist."},
    {"q":"Wie lautet die Konjunktiv-I-Form von 'sein' in der 3. Person Singular?","opts":["ist","waere","sei","seien"],"ans":2,"fb_ok":"Richtig! 'sei' ist die KI-Form von 'sein' (3. Pers. Sg.).","fb_ko":"Falsch. Die korrekte Form ist 'sei', z.B. 'Er sagte, er sei krank.'"},
    {"q":"In welchem Kontext wird Konjunktiv I besonders haeufig verwendet?","opts":["In alltaeglichen Gespraechen","In Zeitungsartikeln und Nachrichtenberichten","In Kochrezepten","In Wettervorsagen"],"ans":1,"fb_ok":"Richtig! Journalisten verwenden KI zur Distanzierung von Aussagen Dritter.","fb_ko":"Falsch. Konjunktiv I ist typisch fuer Zeitungsartikel und Nachrichtenberichte."},
  ],
  "module-b2-2-passiv-erweitert.html": [
    {"q":"Was drueckt das Zustandspassiv aus?","opts":["Eine laufende Handlung","Das Ergebnis einer abgeschlossenen Handlung","Eine zukuenftige Handlung","Eine Moeglichkeit"],"ans":1,"fb_ok":"Richtig! Das Zustandspassiv beschreibt den Zustand als Ergebnis einer Handlung.","fb_ko":"Falsch. Das Zustandspassiv beschreibt das Ergebnis, z.B. 'Die Tuer ist geoeffnet.'"},
    {"q":"Welche Konstruktion kann das Passiv ersetzen?","opts":["haben + Infinitiv","sein + zu + Infinitiv","werden + Partizip II","sein + worden"],"ans":1,"fb_ok":"Richtig! 'sein + zu + Infinitiv' ist eine haeufige Passiversatzform.","fb_ko":"Falsch. 'sein + zu + Infinitiv' ersetzt das Passiv mit Modalverbcharakter."},
    {"q":"Wie bildet man das Vorgangspassiv im Perfekt?","opts":["wurde + Partizip II","ist + Partizip II + worden","war + Partizip II","werden + Partizip II + worden"],"ans":1,"fb_ok":"Richtig! Das Passivperfekt: 'ist/sind + Partizip II + worden.'","fb_ko":"Falsch. Das Vorgangspassiv im Perfekt: 'ist + Partizip II + worden'."},
    {"q":"Was bedeutet 'Das Paket laesst sich leicht oeffnen'?","opts":["Das Paket wird geoeffnet","Das Paket kann leicht geoeffnet werden","Das Paket hat sich geoeffnet","Das Paket oeffnet sich selber"],"ans":1,"fb_ok":"Richtig! 'lassen + sich + Infinitiv' drueckt eine Moeglichkeit aus.","fb_ko":"Falsch. Diese Konstruktion bedeutet 'Das Paket kann leicht geoeffnet werden.'"},
    {"q":"Welcher Satz enthaelt ein unpersoenlisches Passiv?","opts":["Das Buch wird gelesen.","Es wird hier nicht geraucht.","Der Brief wurde geschrieben.","Die Aufgabe ist erledigt."],"ans":1,"fb_ok":"Richtig! Das unpersoenlische Passiv hat kein Subjekt und beginnt oft mit 'Es'.","fb_ko":"Falsch. 'Es wird hier nicht geraucht' ist ein unpersoenlisches Passiv ohne Subjekt."},
  ],
  "module-b2-3-nominalisierung.html": [
    {"q":"Was ist Nominalisierung?","opts":["Ein Verb in eine Frage umwandeln","Ein Verb oder Adjektiv in ein Substantiv umwandeln","Ein Substantiv durch ein Pronomen ersetzen","Einen Satz kuerzen"],"ans":1,"fb_ok":"Richtig! Nominalisierung wandelt Verben oder Adjektive in Substantive um.","fb_ko":"Falsch. Bei der Nominalisierung wird z.B. ein Verb in ein Substantiv umgewandelt."},
    {"q":"Welches Suffix bildet haeufig Nominalisierungen aus Adjektiven?","opts":["-lich","-heit / -keit","-isch","-bar"],"ans":1,"fb_ok":"Richtig! Suffixe wie -heit und -keit bilden Substantive aus Adjektiven.","fb_ko":"Falsch. -heit und -keit sind typische Suffixe fuer Nominalisierungen aus Adjektiven."},
    {"q":"Was ist die nominalisierte Form von 'verhandeln'?","opts":["die Verhandlung","das Verhandeln","der Verhandler","die Verhandlerei"],"ans":0,"fb_ok":"Richtig! 'Die Verhandlung' ist die uebliche nominalisierte Form.","fb_ko":"Falsch. Die gebraeuchliche Nominalisierung von 'verhandeln' ist 'die Verhandlung'."},
    {"q":"Warum wird Nominalisierung im deutschen akademischen Stil bevorzugt?","opts":["Sie macht Texte kuerzer","Sie klingt formeller und verdichtet Information","Sie ist leichter zu verstehen","Sie vermeidet Passivformen"],"ans":1,"fb_ok":"Richtig! Nominalisierung verleiht Texten Formalikaet und Informationsdichte.","fb_ko":"Falsch. Im akademischen Stil verdichtet Nominalisierung Informationen und klingt formeller."},
    {"q":"Welches Wort ist KEIN nominalisierter Infinitiv?","opts":["das Lesen","das Schreiben","die Schrift","das Lernen"],"ans":2,"fb_ok":"Richtig! 'die Schrift' ist kein nominalisierter Infinitiv, sondern ein eigenes Substantiv.","fb_ko":"Falsch. 'die Schrift' ist ein eigenstaendiges Substantiv, kein nominalisierter Infinitiv."},
  ],
  "module-b2-4-konzessivsaetze.html": [
    {"q":"Welche Konjunktion leitet einen Konzessivsatz ein?","opts":["weil","obwohl","damit","falls"],"ans":1,"fb_ok":"Richtig! 'Obwohl' leitet konzessive Nebensaetze ein.","fb_ko":"Falsch. 'Obwohl' ist die typische konzessive Konjunktion."},
    {"q":"Was drueckt ein Konzessivsatz aus?","opts":["Einen Grund","Einen Gegensatz trotz einer Bedingung","Eine Absicht","Eine Folge"],"ans":1,"fb_ok":"Richtig! Ein Konzessivsatz drueckt einen Widerspruch oder Gegensatz aus.","fb_ko":"Falsch. Konzessivsaetze druecken aus, dass etwas trotz eines Hindernisses gilt."},
    {"q":"Welche Konstruktion ist konzessiv?","opts":["Er kommt, weil er Zeit hat.","Er kommt, obwohl er muede ist.","Er kommt, damit er lernt.","Er kommt, wenn er Zeit hat."],"ans":1,"fb_ok":"Richtig! 'obwohl er muede ist' ist ein Konzessivsatz.","fb_ko":"Falsch. Die Konstruktion mit 'obwohl' ist konzessiv."},
    {"q":"Welches Adverb kann 'obwohl' als Satzverknuepfer ersetzen?","opts":["deshalb","trotzdem","naemlich","also"],"ans":1,"fb_ok":"Richtig! 'Trotzdem' drueckt dieselbe konzessive Bedeutung als Adverb aus.","fb_ko":"Falsch. 'Trotzdem' ist das adverbiale Aequivalent zu 'obwohl'."},
    {"q":"Wie unterscheidet sich 'obwohl' von 'obgleich'?","opts":["'Obgleich' ist umgangssprachlicher","'Obgleich' ist formeller, bedeutet aber dasselbe","'Obgleich' drueckt eine Bedingung aus","'Obgleich' steht nur im Hauptsatz"],"ans":1,"fb_ok":"Richtig! 'Obgleich' ist ein gehobenes Synonym fuer 'obwohl'.","fb_ko":"Falsch. 'Obgleich' ist eine formellere Variante von 'obwohl' mit gleicher Bedeutung."},
  ],
  "module-b2-5-partizipialkonstruktionen.html": [
    {"q":"Was ersetzt eine Partizipialkonstruktion?","opts":["Ein Substantiv","Einen Relativsatz oder Adverbialsatz","Einen Hauptsatz","Ein Adverb"],"ans":1,"fb_ok":"Richtig! Partizipialkonstruktionen koennen Relativ- oder Adverbialsaetze ersetzen.","fb_ko":"Falsch. Sie ersetzen haeufig Relativ- oder Adverbialsaetze."},
    {"q":"Welches Partizip beschreibt eine aktive, laufende Handlung?","opts":["Partizip II","Partizip I","Infinitiv mit zu","Partizip III"],"ans":1,"fb_ok":"Richtig! Das Partizip I (Praesenspatizip) beschreibt gleichzeitige aktive Handlungen.","fb_ko":"Falsch. Das Partizip I, z.B. 'lesend', drueckt eine aktive, gleichzeitige Handlung aus."},
    {"q":"Was bedeutet 'die renovierte Wohnung'?","opts":["die Wohnung, die renoviert wird","die Wohnung, die renoviert wurde","die Wohnung, die renoviert werden soll","die Wohnung, die man renoviert"],"ans":1,"fb_ok":"Richtig! 'Renoviert' (Partizip II) drueckt eine abgeschlossene passive Handlung aus.","fb_ko":"Falsch. Das Partizip II 'renoviert' beschreibt eine abgeschlossene Handlung."},
    {"q":"Welcher Satz enthaelt eine erweiterte Partizipialkonstruktion?","opts":["Das laufende Kind","Der im letzten Jahr neu gebaute Bahnhof","Die singenden Voegel","Das gelesene Buch"],"ans":1,"fb_ok":"Richtig! 'Der im letzten Jahr neu gebaute Bahnhof' ist eine erweiterte Partizipialkonstruktion.","fb_ko":"Falsch. Eine erweiterte Konstruktion enthaelt zusaetzliche Angaben wie 'im letzten Jahr'."},
    {"q":"In welchem Stil werden Partizipialkonstruktionen besonders haeufig verwendet?","opts":["In der Umgangssprache","In formellen und schriftlichen Texten","In der gesprochenen Alltagssprache","In Kinderbuechern"],"ans":1,"fb_ok":"Richtig! Partizipialkonstruktionen sind typisch fuer formelle Schriftsprache.","fb_ko":"Falsch. Sie sind vor allem in formellen und schriftlichen Kontexten ueblich."},
  ],
  "module-b2-6-modalpartikeln.html": [
    {"q":"Was ist die Hauptfunktion von Modalpartikeln?","opts":["Verben konjugieren","Den Ton und die Einstellung des Sprechers ausdruecken","Saetze verneinern","Adjektive steigern"],"ans":1,"fb_ok":"Richtig! Modalpartikeln druecken die Einstellung oder den Ton des Sprechers aus.","fb_ko":"Falsch. Modalpartikeln signalisieren die Einstellung oder Haltung des Sprechers."},
    {"q":"Welche Partikel drueckt Ungeduld oder Vorwurf aus?","opts":["doch","mal","ja","eben"],"ans":0,"fb_ok":"Richtig! 'Doch' kann Ungeduld oder Widerspruch ausdruecken.","fb_ko":"Falsch. 'Doch' drueckt haeufig Ungeduld oder einen leichten Vorwurf aus."},
    {"q":"Was bedeutet die Partikel 'mal' in 'Komm mal her!'?","opts":["Eine direkte Forderung","Eine hoefliche, abgeschwaechte Aufforderung","Eine Ablehnung","Eine Zustimmung"],"ans":1,"fb_ok":"Richtig! 'Mal' mildert die Aufforderung und macht sie freundlicher.","fb_ko":"Falsch. 'Mal' macht die Aufforderung weicher und weniger direkt."},
    {"q":"In welchem Register werden Modalpartikeln hauptsaechlich verwendet?","opts":["In formellen Schrifttexten","In der gesprochenen Umgangssprache","In wissenschaftlichen Artikeln","In Gesetzestexten"],"ans":1,"fb_ok":"Richtig! Modalpartikeln sind typisch fuer die gesprochene Alltagssprache.","fb_ko":"Falsch. Modalpartikeln gehoeren hauptsaechlich zur gesprochenen Umgangssprache."},
    {"q":"Welche Partikel drueckt Selbstverstaendlichkeit aus ('wie erwartet')?","opts":["eigentlich","halt/eben","wohl","bloss"],"ans":1,"fb_ok":"Richtig! 'Halt' und 'eben' druecken aus, dass etwas unvermeidlich oder selbstverstaendlich ist.","fb_ko":"Falsch. 'Halt' und 'eben' signalisieren, dass eine Situation unvermeidlich ist."},
  ],
  "module-b2-7-textanalyse.html": [
    {"q":"Was ist das Hauptziel einer Textanalyse?","opts":["Einen Text abzuschreiben","Inhalt, Struktur und sprachliche Mittel eines Textes zu untersuchen","Einen neuen Text zu verfassen","Den Wortschatz zu erweitern"],"ans":1,"fb_ok":"Richtig! Eine Textanalyse untersucht Inhalt, Struktur und Sprachmittel systematisch.","fb_ko":"Falsch. Bei der Textanalyse werden Inhalt, Struktur und sprachliche Mittel untersucht."},
    {"q":"Was ist Kohaerenz in einem Text?","opts":["Die Laenge des Textes","Der inhaltliche Zusammenhang und logische Aufbau","Die Verwendung von Fremdwoertern","Die Anzahl der Absaetze"],"ans":1,"fb_ok":"Richtig! Kohaerenz bezeichnet den inhaltlich-logischen Zusammenhang eines Textes.","fb_ko":"Falsch. Kohaerenz bezeichnet den inhaltlichen und logischen Zusammenhang der Textteile."},
    {"q":"Welches sprachliche Mittel liegt vor, wenn etwas mit einem Bild verglichen wird?","opts":["Metapher","Ironie","Antithese","Ellipse"],"ans":0,"fb_ok":"Richtig! Eine Metapher ist ein bildhafter Vergleich ohne 'wie'.","fb_ko":"Falsch. Eine Metapher ist ein uebertragener Ausdruck, der etwas bildlich beschreibt."},
    {"q":"Wie beginnt man typischerweise eine Textanalyse?","opts":["Mit der eigenen Meinung","Mit einer Einleitung, die Text, Autor, Datum und Thema nennt","Mit dem Schluss des Textes","Mit einem langen Zitat"],"ans":1,"fb_ok":"Richtig! Die Einleitung nennt Textsorte, Autor, Erscheinungsdatum und Thema.","fb_ko":"Falsch. Die Textanalyse beginnt mit einer Einleitung, die Text, Autor, Datum und Thema vorstellt."},
    {"q":"Was untersucht man bei der Stilanalyse?","opts":["Nur die Grammatikfehler","Satzbau, Wortschatz, Ton und rhetorische Mittel","Die Biografie des Autors","Die Druckfehler im Text"],"ans":1,"fb_ok":"Richtig! Die Stilanalyse betrachtet Satzbau, Wortschatz, Ton und rhetorische Mittel.","fb_ko":"Falsch. Die Stilanalyse untersucht Satzbau, Wortschatz, Ton und rhetorische Mittel."},
  ],
  "module-b2-8-wissenschaftlich.html": [
    {"q":"Was charakterisiert wissenschaftliches Schreiben?","opts":["Persoenliche Meinungen und Emotionen","Objektiver Ton, Praezision und belegte Aussagen","Umgangssprachliche Ausdruecke","Kurze, einfache Saetze"],"ans":1,"fb_ok":"Richtig! Wissenschaftliche Texte sind objektiv, praezise und belegen Aussagen.","fb_ko":"Falsch. Wissenschaftliches Schreiben zeichnet sich durch Objektivitaet, Praezision und Belege aus."},
    {"q":"Welche Form wird im wissenschaftlichen Schreiben bevorzugt, um Objektivitaet zu signalisieren?","opts":["Die Ich-Form","Das Passiv oder unpersoenlische Konstruktionen","Direkte Anrede","Befehlsform"],"ans":1,"fb_ok":"Richtig! Das Passiv und unpersoenlische Konstruktionen schaffen Distanz und Objektivitaet.","fb_ko":"Falsch. Passiv und unpersoenlische Konstruktionen signalisieren Objektivitaet."},
    {"q":"Was ist eine Hedging-Formulierung?","opts":["Eine direkte Behauptung","Eine vorsichtige Aussage, die Unsicherheit ausdrueckt","Ein Zitat aus einer Quelle","Eine Definition"],"ans":1,"fb_ok":"Richtig! Hedging drueckt Vorsicht und Unsicherheit aus, z.B. 'Es scheint, dass...'","fb_ko":"Falsch. Hedging ist eine abschwaechende Formulierung, die Unsicherheit signalisiert."},
    {"q":"Wie zitiert man im deutschen akademischen Stil korrekt?","opts":["Ohne Quellenangabe","Mit Autor, Jahr und Seitenzahl","Nur mit dem Buchtitel","Mit der ISBN-Nummer"],"ans":1,"fb_ok":"Richtig! Zitate benoetigen Autor, Erscheinungsjahr und Seitenzahl.","fb_ko":"Falsch. Im akademischen Zitieren gibt man Autor, Erscheinungsjahr und Seitenzahl an."},
    {"q":"Welches Konnektiv leitet einen Schlussfolgerungssatz ein?","opts":["obwohl","somit / daher / folglich","weil","damit"],"ans":1,"fb_ok":"Richtig! 'Somit', 'daher' und 'folglich' leiten Schlussfolgerungen ein.","fb_ko":"Falsch. 'Somit', 'daher' und 'folglich' sind typische Konnektive fuer Schlussfolgerungen."},
  ],
  "module-b2-9-diskussion.html": [
    {"q":"Wie beginnt man hoeflich eine Widerspruch-Aeusserung in einer Diskussion?","opts":["Das ist total falsch!","Ich sehe das etwas anders, weil...","Nein, du hast Unrecht.","Das stimmt ueberhaupt nicht."],"ans":1,"fb_ok":"Richtig! Hoeflicher Widerspruch beginnt mit einer abschwaechenden Formulierung.","fb_ko":"Falsch. Eine hoefliche Formulierung wie 'Ich sehe das etwas anders' ist angemessener."},
    {"q":"Was bedeutet 'einen Kompromiss finden' in einer Diskussion?","opts":["Den anderen ueberzeugen","Eine Loesung finden, die beide Seiten akzeptieren koennen","Die eigene Meinung durchsetzen","Das Thema wechseln"],"ans":1,"fb_ok":"Richtig! Ein Kompromiss ist eine gegenseitig akzeptable Loesung.","fb_ko":"Falsch. Ein Kompromiss ist eine Loesung, mit der alle Beteiligten einverstanden sein koennen."},
    {"q":"Welche Funktion hat ein Gegenargument in einer Diskussion?","opts":["Das eigene Argument zu schwaerchen","Eine entgegengesetzte Position zu widerlegen oder zu relativieren","Dem Gespraechspartner zuzustimmen","Das Thema zu beenden"],"ans":1,"fb_ok":"Richtig! Gegenargumente widerlegen oder relativieren die Gegenposition.","fb_ko":"Falsch. Gegenargumente dienen dazu, eine andere Position zu widerlegen."},
    {"q":"Wie kann man in einer Diskussion das Wort ergreifen?","opts":["Den anderen einfach unterbrechen","'Darf ich kurz etwas ergaenzen?' oder 'Ich moechte dazu sagen...'","Laut sprechen","Schweigen und warten"],"ans":1,"fb_ok":"Richtig! Hoefliche Einstiegsformeln helfen, das Wort zu ergreifen.","fb_ko":"Falsch. Hoefliche Einleitungen wie 'Darf ich ergaenzen?' sind die bessere Wahl."},
    {"q":"Was ist bei der B2-Pruefung im Sprechteil Teil 3 (Diskussion) zu tun?","opts":["Einen Monolog halten","Gemeinsam mit einem Partner eine Loesung aushandeln","Einen Text vorlesen","Fragen beantworten"],"ans":1,"fb_ok":"Richtig! In Teil 3 handeln zwei Kandidaten gemeinsam eine Loesung aus.","fb_ko":"Falsch. In der Diskussion im B2-Sprechen handeln die Kandidaten gemeinsam eine Loesung aus."},
  ],
  "module-b2-10-hoeren-lesen-b2.html": [
    {"q":"Was ist globales Lesen?","opts":["Jeden Satz genau lesen","Einen Text ueberfliegen, um den Gesamtinhalt zu erfassen","Woerterbuecher benutzen","Notizen zu jedem Absatz machen"],"ans":1,"fb_ok":"Richtig! Globales Lesen (Skimming) erfasst schnell den Gesamtinhalt.","fb_ko":"Falsch. Globales Lesen bedeutet, einen Text schnell zu ueberfliegen, um das Thema zu verstehen."},
    {"q":"Welche Strategie hilft beim Hoerverstehen, wenn man ein Wort nicht versteht?","opts":["Sofort aufhoeren zu hoeren","Am Kontext weiterarbeiten und das Gesamte verstehen","Den Text neu beginnen","Jedes Wort nachschlagen"],"ans":1,"fb_ok":"Richtig! Kontextstrategien helfen, Unbekanntes aus dem Zusammenhang zu erschliessen.","fb_ko":"Falsch. Man sollte den Kontext nutzen und das Gesamtbild im Blick behalten."},
    {"q":"Was bedeutet selektives Lesen?","opts":["Nur die Ueberschriften lesen","Gezielt nach bestimmten Informationen suchen","Den Text laut vorlesen","Jeden Abschnitt dreimal lesen"],"ans":1,"fb_ok":"Richtig! Selektives Lesen (Scanning) sucht gezielt nach bestimmten Informationen.","fb_ko":"Falsch. Selektives Lesen bedeutet, gezielt nach spezifischen Informationen zu suchen."},
    {"q":"Welche Aufgabe gibt es beim B2-Leseverstehen Aufgabe 1 (Goethe)?","opts":["Luecken in einem Text fuellen","Kurztexte passenden Ueberschriften zuordnen","Einen Essay schreiben","Woerter definieren"],"ans":1,"fb_ok":"Richtig! Bei Aufgabe 1 werden Kurztexte Ueberschriften zugeordnet.","fb_ko":"Falsch. Bei Aufgabe 1 des B2-Leseverstehens werden Texte und Ueberschriften zugeordnet."},
    {"q":"Wie bereitet man sich effektiv auf das B2-Hoerverstehen vor?","opts":["Nur Musik hoeren","Vor dem Hoeren die Fragen lesen und Schluesselbegriffe markieren","Den Hoertext abschreiben","Nichts vorbereiten"],"ans":1,"fb_ok":"Richtig! Die Fragen vorab lesen und Schluesselbegriffe markieren ist eine effektive Strategie.","fb_ko":"Falsch. Man sollte die Fragen vor dem Hoeren lesen und Schluesselbegriffe identifizieren."},
  ],
  "module-b2-11-wortschatz-b2.html": [
    {"q":"Was ist eine Kollokation?","opts":["Ein Fremdwort","Eine typische Wortkombination, die haeufig zusammen vorkommt","Eine Abkuerzung","Ein veraltetes Wort"],"ans":1,"fb_ok":"Richtig! Kollokationen sind feste Wortkombinationen, z.B. 'eine Entscheidung treffen'.","fb_ko":"Falsch. Kollokationen sind feste, typische Wortverbindungen wie 'eine Rolle spielen'."},
    {"q":"Welches Wort gehoert zum Themenfeld Umwelt?","opts":["der Vertrag","die Nachhaltigkeit","das Formular","die Bewerbung"],"ans":1,"fb_ok":"Richtig! 'Nachhaltigkeit' ist ein zentraler Begriff im Umweltbereich.","fb_ko":"Falsch. 'Nachhaltigkeit' gehoert zum Themenfeld Umwelt."},
    {"q":"Was bezeichnet das Praefix 'miss-' in 'missverstehen'?","opts":["Eine Wiederholung","Eine negative oder falsche Handlung","Eine Verstaerkung","Eine Moeglichkeit"],"ans":1,"fb_ok":"Richtig! Das Praefix 'miss-' drueckt etwas Falsches oder Negatives aus.","fb_ko":"Falsch. 'Miss-' signalisiert eine negative oder fehlerhafte Handlung."},
    {"q":"Welcher Ausdruck ist formeller: 'kaufen' oder 'erwerben'?","opts":["kaufen","erwerben","beide gleich","keiner ist formell"],"ans":1,"fb_ok":"Richtig! 'Erwerben' ist formeller und typisch fuer schriftliche Kontexte.","fb_ko":"Falsch. 'Erwerben' ist die formellere Variante von 'kaufen'."},
    {"q":"Was ist ein Synonym fuer 'global'?","opts":["regional","weltweit","lokal","national"],"ans":1,"fb_ok":"Richtig! 'Weltweit' ist ein deutsches Synonym fuer 'global'.","fb_ko":"Falsch. 'Weltweit' bedeutet dasselbe wie 'global'."},
  ],
  "module-b2-12-schreiben-b2.html": [
    {"q":"Was ist eine Eroerterung?","opts":["Eine Geschichte erzaehlen","Eine Frage aus verschiedenen Perspektiven argumentativ beleuchten","Einen Bericht schreiben","Einen Brief beschreiben"],"ans":1,"fb_ok":"Richtig! Eine Eroerterung beleuchtet eine Frage oder These mit Argumenten und Gegenargumenten.","fb_ko":"Falsch. Eine Eroerterung ist ein argumentativer Text, der eine Frage beleuchtet."},
    {"q":"Wie beginnt man die Einleitung einer Eroerterung?","opts":["Mit der eigenen Schlussfolgerung","Mit einem Aufhaenger, der das Thema einfuehrt","Mit einem langen Zitat","Mit einer Liste der Argumente"],"ans":1,"fb_ok":"Richtig! Die Einleitung beginnt mit einem Aufhaenger und stellt das Thema vor.","fb_ko":"Falsch. Die Einleitung fuehrt das Thema mit einem interessanten Einstieg ein."},
    {"q":"Welche Struktur hat ein gut formuliertes Argument im Hauptteil?","opts":["Nur die Behauptung","These - Begruendung - Beispiel (TBB)","Einleitung - Meinung - Schluss","Nur ein Beispiel"],"ans":1,"fb_ok":"Richtig! Die TBB-Struktur: These, Begruendung, Beispiel macht Argumente ueberzeugend.","fb_ko":"Falsch. Ein ueberzeugendes Argument folgt der TBB-Struktur: These, Begruendung, Beispiel."},
    {"q":"Was gehoert in den Schluss einer Eroerterung?","opts":["Neue Argumente einfuehren","Ein persoenliches Fazit und Ausblick oder Appell","Eine Zusammenfassung der Einleitung","Eine lange Aufzaehlung"],"ans":1,"fb_ok":"Richtig! Der Schluss enthaelt ein Fazit, oft mit Ausblick oder Appell.","fb_ko":"Falsch. Im Schluss steht ein Fazit sowie ein Ausblick oder Appell."},
    {"q":"Welches Konnektiv drueckt einen Gegensatz aus?","opts":["ausserdem","jedoch","deshalb","denn"],"ans":1,"fb_ok":"Richtig! 'Jedoch' leitet einen Gegensatz oder Widerspruch ein.","fb_ko":"Falsch. 'Jedoch' ist ein adversatives Konnektiv und drueckt einen Gegensatz aus."},
  ],
  "module-b2-13-sprechen-b2.html": [
    {"q":"Wie ist der B2-Sprechteil der Goethe-Pruefung aufgebaut?","opts":["Ein langer Monolog","Drei Teile: Vortrag, Diskussion und Einigung","Nur Fragen beantworten","Ein Rollenspiel"],"ans":1,"fb_ok":"Richtig! Der B2-Sprechteil besteht aus Vortrag, Diskussion und Einigung.","fb_ko":"Falsch. Der B2-Sprechteil umfasst drei Teile: Vortrag, Diskussion und Einigung."},
    {"q":"Was ist wichtig bei der Bildbeschreibung?","opts":["Nur die Farben nennen","Systematisch beschreiben: Was? Wo? Welche Stimmung? Interpretation","Das Bild ignorieren","Den Hintergrund weglassen"],"ans":1,"fb_ok":"Richtig! Eine systematische Beschreibung umfasst Inhalt, Lage, Stimmung und Interpretation.","fb_ko":"Falsch. Eine gute Bildbeschreibung ist systematisch: Was, Wo, Stimmung, Interpretation."},
    {"q":"Welcher Ausdruck ist ein hilfreicher Zeitfueller?","opts":["Ich weiss nicht.","Das ist eine interessante Frage, ich ueberlege kurz...","Keine Antwort","Ich habe das nicht verstanden."],"ans":1,"fb_ok":"Richtig! Zeitfueller geben einem Zeit zum Nachdenken und klingen natuerlich.","fb_ko":"Falsch. Saetze wie 'Das ist eine interessante Frage...' geben Zeit zum Nachdenken."},
    {"q":"Was ist der Unterschied zwischen einem Monolog und einer Diskussion in der Pruefung?","opts":["Kein Unterschied","Im Monolog spricht man allein; in der Diskussion interagiert man mit dem Partner","Im Monolog darf man nicht sprechen","In der Diskussion spricht nur der Pruefer"],"ans":1,"fb_ok":"Richtig! Im Monolog spricht man allein, in der Diskussion interagiert man mit dem Partner.","fb_ko":"Falsch. Der Monolog ist ein Einzelvortrag; die Diskussion ist eine Partnerinteraktion."},
    {"q":"Wie leitet man einen Monolog am besten ein?","opts":["Sofort mit Details beginnen","Das Thema nennen, eine Gliederung ankuendigen und dann beginnen","Nur die Bilder zeigen","Mit einem Witz beginnen"],"ans":1,"fb_ok":"Richtig! Eine gute Einleitung nennt das Thema und gibt eine kurze Gliederung.","fb_ko":"Falsch. Man nennt das Thema und kuendigt die Gliederung an, bevor man beginnt."},
  ],
  "module-b2-14-pruefungsvorbereitung.html": [
    {"q":"Aus wie vielen Teilen besteht die Goethe B2-Pruefung?","opts":["Zwei Teile","Vier Teile: Lesen, Hoeren, Schreiben, Sprechen","Drei Teile","Fuenf Teile"],"ans":1,"fb_ok":"Richtig! Die Goethe B2-Pruefung besteht aus Lesen, Hoeren, Schreiben und Sprechen.","fb_ko":"Falsch. Die Goethe B2-Pruefung hat vier Teile: Lesen, Hoeren, Schreiben, Sprechen."},
    {"q":"Welches Grammatikthema ist typisch fuer B2?","opts":["Der bestimmte Artikel","Konjunktiv I, Partizipialkonstruktionen, Nominalisierung","Die Grundzahlen","Das Praesens von 'sein'"],"ans":1,"fb_ok":"Richtig! Diese komplexen Strukturen sind typisch fuer das B2-Niveau.","fb_ko":"Falsch. Konjunktiv I, Partizipialkonstruktionen und Nominalisierung sind typische B2-Themen."},
    {"q":"Was ist einer der haeufigsten Fehler im B2-Schreiben?","opts":["Zu viele Argumente","Kein kohaerenter Aufbau und fehlende Konnektive","Zu langer Text","Zu einfacher Wortschatz"],"ans":1,"fb_ok":"Richtig! Fehlender Aufbau und mangelnde Konnektive sind typische Fehler.","fb_ko":"Falsch. Fehlende Kohaerenz und mangelnde Konnektive gehoeren zu den haeufigsten Fehlern."},
    {"q":"Was sollte man am Pruefungstag NICHT tun?","opts":["Frueh schlafen gehen","In letzter Minute neuen Stoff lernen","Ausreichend trinken","Rechtzeitig ankommen"],"ans":1,"fb_ok":"Richtig! Kurz vor der Pruefung neuen Stoff zu lernen erhoeht Stress und hilft nicht.","fb_ko":"Falsch. Man sollte kurz vor der Pruefung keinen neuen Stoff mehr lernen."},
    {"q":"Wie viel Prozent sind fuer das Bestehen der B2-Pruefung in jedem Teil erforderlich?","opts":["40%","60%","75%","90%"],"ans":1,"fb_ok":"Richtig! Man braucht mindestens 60% in jedem Pruefungsteil zum Bestehen.","fb_ko":"Falsch. Zum Bestehen der B2-Pruefung benoetigt man mindestens 60% in jedem Teil."},
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

def build_quiz_js(fname):
    data = QUIZ_DATA[fname]
    next_href = NEXT_MOD.get(fname, "dashboard.html")
    js_data = json.dumps(data, ensure_ascii=False, indent=2)
    js = QUIZ_JS_TPL % js_data
    js += """
  document.addEventListener('DOMContentLoaded',function(){
    var nb=document.getElementById('sqNextMod');
    if(nb){ nb.onclick=function(){ window.location.href='""" + next_href + """'; }; }
  });
"""
    return js

def inject(fname):
    path = os.path.join(BASE, fname)
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    if 'sq-wrap' in html:
        print("  SKIP %s (already has quiz)" % fname)
        return

    # 1. Inject CSS before </style>
    html = html.replace('</style>', QUIZ_CSS + '\n</style>', 1)

    # 2. Inject HTML after start button
    marker = u'Lektion 1 beginnen \u2192</button>'
    if marker not in html:
        print("  WARN %s: start button not found" % fname)
    else:
        html = html.replace(marker, marker + QUIZ_HTML, 1)

    # 3. Inject JS before last </script>
    quiz_js = build_quiz_js(fname)
    last_script = html.rfind('</script>')
    if last_script == -1:
        print("  WARN %s: no </script> found" % fname)
    else:
        html = html[:last_script] + quiz_js + '\n</script>' + html[last_script+9:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("  OK   %s" % fname)

print("Injecting quizzes into B2 modules...")
for fname in sorted(QUIZ_DATA.keys()):
    inject(fname)
print("Done!")
