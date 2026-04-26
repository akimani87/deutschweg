#!/usr/bin/env python3
"""Generator for DeutschWeg mini-test HTML files."""
import os, json as _json

BASE = os.path.dirname(os.path.abspath(__file__))

def js(v):
    return _json.dumps(str(v), ensure_ascii=False)

def html_file(title, level, module_url, questions):
    accent = {'A1': '#3B82F6', 'A2': '#7C3AED', 'B1': '#059669'}.get(level, '#3B82F6')
    lang = 'de' if level in ('A2', 'B1') else 'en'

    qs_parts = []
    for q in questions:
        opts = ','.join(f'{{text:{js(o[0])},val:{js(o[1])}}}' for o in q['opts'])
        qs_parts.append(f'{{q:{js(q["q"])},opts:[{opts}],correct:{js(q["correct"])},exp:{js(q.get("exp",""))}}}')
    qs_block = ',\n  '.join(qs_parts)

    if lang == 'de':
        msgs_py = [[5,"Perfekt! 🎉 Du hast dieses Thema gemeistert!"],[4,"Sehr gut! 👏 Fast perfekt!"],[3,"Gut! 💪 Noch etwas Übung nötig."],[2,"Weiter üben! 📚 Schau dir die Lektion nochmal an."],[0,"Nicht aufgeben! 🌟 Versuche die Lektion erneut."]]
        btn_retry = "Nochmal versuchen"
        btn_dash = "Zum Dashboard →"
        lbl_back = "← Lektion"
        lbl_q = "Frage"
        lbl_of = "von"
        lbl_next = "Nächste Frage →"
        lbl_finish = "🏆 Ergebnis"
        lbl_result = "Dein Ergebnis"
        lbl_correct = "Richtig!"
        lbl_wrong = "Leider falsch."
        lbl_ans = "Richtige Antwort:"
        subtitle = f"5 Fragen · 3–5 Min"
    else:
        msgs_py = [[5,"Perfekt! 🎉 You've mastered this topic!"],[4,"Sehr gut! 👏 Almost perfect!"],[3,"Gut! 💪 A little more practice needed."],[2,"Weiter üben! 📚 Review the lesson again."],[0,"Nicht aufgeben! 🌟 Try the lesson again."]]
        btn_retry = "Try Again"
        btn_dash = "Back to Dashboard →"
        lbl_back = "← Lesson"
        lbl_q = "Question"
        lbl_of = "of"
        lbl_next = "Next Question →"
        lbl_finish = "🏆 Results"
        lbl_result = "Your Result"
        lbl_correct = "Correct!"
        lbl_wrong = "Not quite."
        lbl_ans = "Correct answer:"
        subtitle = f"5 Questions · 3–5 min"

    msgs_js = _json.dumps(msgs_py, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="{'de' if lang=='de' else 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — DeutschWeg</title>
<link rel="stylesheet" href="./deutschweg-theme.css">
<style>
body{{background:var(--bg);}}
.mt-wrap{{max-width:560px;margin:0 auto;padding:20px 16px 80px;}}
.mt-header{{text-align:center;margin-bottom:24px;}}
.mt-badge{{display:inline-block;background:{accent};color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 12px;border-radius:20px;margin-bottom:10px;}}
.mt-title{{font-size:21px;font-weight:800;color:var(--dark);margin-bottom:4px;}}
.mt-subtitle{{font-size:13px;color:var(--mid);}}
.mt-dots{{display:flex;justify-content:center;gap:10px;margin-bottom:20px;}}
.mt-dot{{width:11px;height:11px;border-radius:50%;background:var(--border);transition:all .3s;}}
.mt-dot.active{{background:{accent};transform:scale(1.2);}}
.mt-dot.correct{{background:var(--green);}}
.mt-dot.wrong{{background:var(--red);}}
.mt-dot.done{{background:{accent};opacity:.4;}}
.mt-card{{background:#fff;border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:28px 22px 22px;}}
.mt-qnum{{font-size:12px;font-weight:700;color:{accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}}
.mt-question{{font-size:17px;font-weight:700;color:var(--dark);line-height:1.5;margin-bottom:22px;}}
.mt-options{{display:flex;flex-direction:column;gap:9px;}}
.mt-opt{{display:flex;align-items:center;gap:12px;padding:12px 15px;border:2px solid var(--border);border-radius:12px;cursor:pointer;font-size:15px;font-weight:500;color:var(--dark);background:#fff;text-align:left;width:100%;transition:all .18s;}}
.mt-opt:hover:not(.disabled){{border-color:{accent};background:#f0f7ff;}}
.mt-opt.selected{{border-color:{accent};background:#eff6ff;color:{accent};}}
.mt-opt.correct{{border-color:var(--green)!important;background:var(--green-light)!important;color:#065f46!important;}}
.mt-opt.wrong{{border-color:var(--red)!important;background:var(--red-light)!important;color:#991b1b!important;}}
.mt-opt.disabled{{cursor:default;}}
.mt-opt-letter{{width:26px;height:26px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}}
.mt-feedback{{margin-top:14px;padding:11px 14px;border-radius:10px;font-size:13.5px;font-weight:600;display:none;line-height:1.5;}}
.mt-feedback.show{{display:block;}}
.mt-feedback.ok{{background:var(--green-light);color:#065f46;border:1px solid var(--green-border);}}
.mt-feedback.no{{background:var(--red-light);color:#991b1b;border:1px solid #fecaca;}}
.mt-next{{margin-top:16px;width:100%;padding:13px;background:{accent};color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:none;}}
.mt-next:hover{{opacity:.88;}}
.mt-next.show{{display:block;}}
.mt-results{{background:#fff;border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:36px 24px;text-align:center;display:none;}}
.mt-results.show{{display:block;}}
.mt-score-ring{{width:100px;height:100px;border-radius:50%;border:6px solid {accent};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 16px;}}
.mt-score-num{{font-size:34px;font-weight:800;color:{accent};line-height:1;}}
.mt-score-denom{{font-size:13px;color:var(--mid);font-weight:600;}}
.mt-result-label{{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--mid);margin-bottom:6px;}}
.mt-result-msg{{font-size:18px;font-weight:700;color:var(--dark);margin-bottom:20px;line-height:1.4;}}
.mt-rdots{{display:flex;justify-content:center;gap:8px;margin-bottom:20px;}}
.mt-rdot{{width:14px;height:14px;border-radius:50%;}}
.mt-actions{{display:flex;flex-direction:column;gap:10px;}}
.mt-btn-p{{padding:14px;background:{accent};color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;}}
.mt-btn-s{{padding:13px;background:#fff;color:{accent};border:2px solid {accent};border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;display:block;}}
.mt-btn-p:hover,.mt-btn-s:hover{{opacity:.88;}}
.slide-in{{animation:sIn .22s ease;}}
@keyframes sIn{{from{{opacity:0;transform:translateX(18px);}}to{{opacity:1;transform:translateX(0);}}}}
</style>
</head>
<body>
<nav class="dw-nav">
  <div class="dw-nav-inner" style="display:flex;align-items:center;justify-content:space-between;height:56px;">
    <a href="./dashboard.html" class="dw-logo">DeutschWeg</a>
    <a href="./{module_url}" class="dw-btn" style="font-size:13px;padding:7px 16px;">{lbl_back}</a>
  </div>
</nav>
<div class="mt-wrap">
  <div class="mt-header">
    <div class="mt-badge">{level} · Mini-Test</div>
    <div class="mt-title">{title}</div>
    <div class="mt-subtitle">{subtitle}</div>
  </div>
  <div class="mt-dots" id="dots"></div>
  <div class="mt-card" id="qcard">
    <div class="mt-qnum" id="qnum"></div>
    <div class="mt-question" id="qtext"></div>
    <div class="mt-options" id="opts"></div>
    <div class="mt-feedback" id="fb"></div>
    <button class="mt-next" id="nb" onclick="nextQ()"></button>
  </div>
  <div class="mt-results" id="results">
    <div class="mt-result-label">{lbl_result}</div>
    <div class="mt-score-ring"><div class="mt-score-num" id="rn">0</div><div class="mt-score-denom">{lbl_of} 5</div></div>
    <div class="mt-rdots" id="rd"></div>
    <div class="mt-result-msg" id="rm"></div>
    <div class="mt-actions">
      <button class="mt-btn-p" onclick="restart()">{btn_retry}</button>
      <a href="./dashboard.html" class="mt-btn-s">{btn_dash}</a>
    </div>
  </div>
</div>
<script>
const QS=[
  {qs_block}
];
const MSGS={msgs_js};
let cur=0,res=[],done=false;

function dots(a){{
  const el=document.getElementById('dots');
  el.innerHTML='';
  QS.forEach((_,i)=>{{
    const d=document.createElement('div');
    d.className='mt-dot'+(i<a?(res[i]?' correct':' wrong'):i===a?' active':'');
    el.appendChild(d);
  }});
}}

function renderQ(){{
  done=false;
  const q=QS[cur];
  document.getElementById('qnum').textContent='{lbl_q} '+(cur+1)+' {lbl_of} 5';
  document.getElementById('qtext').textContent=q.q;
  document.getElementById('fb').className='mt-feedback';
  document.getElementById('fb').textContent='';
  const nb=document.getElementById('nb');
  nb.className='mt-next';
  nb.textContent=cur<4?'{lbl_next}':'{lbl_finish}';
  const opts=document.getElementById('opts');
  opts.innerHTML='';
  q.opts.forEach(o=>{{
    const b=document.createElement('button');
    b.className='mt-opt';
    b.innerHTML=`<span class="mt-opt-letter">${{o.val.toUpperCase()}}</span><span>${{o.text}}</span>`;
    b.onclick=()=>pick(b,o.val,q.correct,q.exp);
    opts.appendChild(b);
  }});
  document.getElementById('qcard').classList.add('slide-in');
  setTimeout(()=>document.getElementById('qcard').classList.remove('slide-in'),300);
  dots(cur);
}}

function pick(btn,val,correct,exp){{
  if(done)return;
  done=true;
  const ok=val===correct;
  res[cur]=ok;
  document.querySelectorAll('.mt-opt').forEach(b=>{{
    b.classList.add('disabled');
    const v=b.querySelector('.mt-opt-letter').textContent.toLowerCase();
    if(v===correct)b.classList.add('correct');
    else if(b===btn&&!ok)b.classList.add('wrong');
  }});
  const fb=document.getElementById('fb');
  if(ok){{
    fb.className='mt-feedback show ok';
    fb.textContent='✓ '+(exp||'{lbl_correct}');
  }}else{{
    const ct=QS[cur].opts.find(o=>o.val===correct);
    fb.className='mt-feedback show no';
    fb.textContent='✗ '+(exp?exp:('{lbl_wrong} {lbl_ans} '+(ct?ct.text:correct)));
  }}
  document.getElementById('nb').classList.add('show');
  dots(cur);
}}

function nextQ(){{
  cur++;
  if(cur>=QS.length){{showResults();return;}}
  renderQ();
}}

function showResults(){{
  document.getElementById('qcard').style.display='none';
  document.getElementById('dots').style.display='none';
  const score=res.filter(Boolean).length;
  document.getElementById('results').classList.add('show');
  document.getElementById('rn').textContent=score;
  const rd=document.getElementById('rd');
  rd.innerHTML='';
  res.forEach(r=>{{
    const d=document.createElement('div');
    d.className='mt-rdot';
    d.style.background=r?'var(--green)':'var(--red)';
    rd.appendChild(d);
  }});
  let msg=MSGS[MSGS.length-1][1];
  for(const[min,m]of MSGS){{if(score>=min){{msg=m;break;}}}}
  document.getElementById('rm').textContent=msg;
}}

function restart(){{
  cur=0;res=[];done=false;
  document.getElementById('qcard').style.display='block';
  document.getElementById('dots').style.display='flex';
  document.getElementById('results').classList.remove('show');
  renderQ();
}}

renderQ();
</script>
</body>
</html>"""

# ============================================================
# ALL TEST DATA
# ============================================================
TESTS = [
# ━━━━━━━━━━━━━━━━━━━━━━ A1 ━━━━━━━━━━━━━━━━━━━━━━
dict(file='mini-test-a1-1.html', title='German Alphabet & Pronunciation', level='A1', module='module0-pronunciation.html', questions=[
  dict(q='Which letter makes the "ß" sound?', opts=[('ss','a'),('sz','b'),('both ss and sz','c'),('zz','d')], correct='c', exp='ß represents the "ss" or "sz" sound depending on the word.'),
  dict(q='How do you pronounce "ä"?', opts=[('like "a"','a'),('like "e"','b'),('like "ay"','c'),('like "i"','d')], correct='c', exp='ä sounds like the "ay" in "say" — an open e sound.'),
  dict(q='Which word has an Umlaut?', opts=[('Haus','a'),('Maus','b'),('Bäume','c'),('Baum','d')], correct='c', exp='Bäume has the Umlaut ä. It is the plural of Baum (tree).'),
  dict(q='How many letters are in the German alphabet including Umlauts and ß?', opts=[('26','a'),('29','b'),('30','c'),('32','d')], correct='c', exp='26 standard + ä, ö, ü, ß = 30 letters total.'),
  dict(q='How do you pronounce "ch" in "ich"?', opts=[('like English "k"','a'),('soft sound from front of throat','b'),('like English "sh"','c'),('silent','d')], correct='b', exp='In "ich", ch is a soft palatal sound — like a gentle hiss made at the front of the mouth.'),
]),
dict(file='mini-test-a1-2.html', title='Numbers & Dates', level='A1', module='module1-numbers.html', questions=[
  dict(q='What is "fünfzehn" in numbers?', opts=[('5','a'),('15','b'),('50','c'),('55','d')], correct='b', exp='fünf = 5, zehn = 10, fünfzehn = 15.'),
  dict(q='How do you say "Monday" in German?', opts=[('Dienstag','a'),('Mittwoch','b'),('Montag','c'),('Donnerstag','d')], correct='c', exp='Montag = Monday. The week: Mo, Di, Mi, Do, Fr, Sa, So.'),
  dict(q='What time is "halb drei"?', opts=[('3:00','a'),('3:30','b'),('2:30','c'),('2:00','d')], correct='c', exp='"halb" always refers to the NEXT hour. halb drei = half past two = 2:30.'),
  dict(q='How do you write March 15th in German?', opts=[('15. März','a'),('März 15','b'),('15/März','c'),('März/15','d')], correct='a', exp='German dates: day. Month — so 15. März is correct.'),
  dict(q='What is "zwanzig plus dreißig"?', opts=[('40','a'),('50','b'),('60','c'),('70','d')], correct='b', exp='zwanzig = 20, dreißig = 30, 20 + 30 = 50 = fünfzig.'),
]),
dict(file='mini-test-a1-3.html', title='Greetings & Introductions', level='A1', module='module2-greetings.html', questions=[
  dict(q='Which greeting is formal?', opts=[('Hallo','a'),('Hi','b'),('Guten Tag','c'),('Hey','d')], correct='c', exp='Guten Tag is the standard formal daytime greeting in German.'),
  dict(q='How do you formally ask "How are you?" in German?', opts=[("Wie geht's?",'a'),('Wie geht es Ihnen?','b'),('Alles gut?','c'),('Was ist los?','d')], correct='b', exp='"Wie geht es Ihnen?" uses the formal Sie — required with strangers and authority figures.'),
  dict(q='Kwame meets his professor. Which greeting is correct?', opts=[('Hey Professor!','a'),('Hallo du!','b'),('Guten Tag, Herr Professor.','c'),("Hi, wie geht's?",'d')], correct='c', exp='With professors and superiors, always use formal greetings and titles.'),
  dict(q='Which options correctly mean "My name is Amina"?', opts=[('Ich bin Amina.','a'),('Mein Name ist Amina.','b'),('Man nennt mich Amina.','c'),('Both a and b','d')], correct='d', exp='Both "Ich bin..." and "Mein Name ist..." are correct and common ways to introduce yourself.'),
  dict(q='Which farewell works at ANY time of day?', opts=[('Guten Morgen','a'),('Guten Tag','b'),('Guten Abend','c'),('Auf Wiedersehen','d')], correct='d', exp='"Auf Wiedersehen" means "until we meet again" and works at any time. Guten Abend is a greeting, not a farewell.'),
]),
dict(file='mini-test-a1-4.html', title='haben & sein', level='A1', module='module3-haben-sein.html', questions=[
  dict(q='Which verb means "to have"?', opts=[('sein','a'),('haben','b'),('werden','c'),('machen','d')], correct='b', exp='haben = to have. sein = to be. These are the two most essential German verbs.'),
  dict(q='Complete: "Ich ___ Lehrerin."', opts=[('habe','a'),('bist','b'),('bin','c'),('ist','d')], correct='c', exp='ich + sein = ich bin. "I am a teacher."'),
  dict(q='Complete: "Amina ___ einen Bruder."', opts=[('hat','a'),('ist','b'),('bin','c'),('haben','d')], correct='a', exp='er/sie/es + haben = hat. Amina has a brother.'),
  dict(q='Complete: "Wir ___ aus Kenia."', opts=[('sind','a'),('haben','b'),('ist','c'),('bin','d')], correct='a', exp='wir + sein = sind. We are from Kenya.'),
  dict(q='Which sentence uses "haben" correctly?', opts=[('Ich bin Hunger.','a'),('Ich habe Hunger.','b'),('Ich bin hungrig haben.','c'),('Ich ist Hunger.','d')], correct='b', exp='"Hunger haben" (to have hunger = to be hungry) uses haben. A common trap!'),
]),
dict(file='mini-test-a1-5.html', title='Noun Gender (der/die/das)', level='A1', module='module4-nouns-gender.html', questions=[
  dict(q='What is the article for "Mann" (man)?', opts=[('die','a'),('das','b'),('der','c'),('den','d')], correct='c', exp='der Mann — masculine. Male people are usually masculine.'),
  dict(q='What is the article for "Frau" (woman)?', opts=[('der','a'),('die','b'),('das','c'),('dem','d')], correct='b', exp='die Frau — feminine. Female people are usually feminine.'),
  dict(q='What is the article for "Kind" (child)?', opts=[('der','a'),('die','b'),('das','c'),('dem','d')], correct='c', exp='das Kind — neuter. Importantly, "Kind" is neuter even though children are people.'),
  dict(q='Which nouns are ALWAYS feminine in German?', opts=[('Nouns ending in -ung','a'),('Nouns ending in -er','b'),('Nouns ending in -chen','c'),('All compound nouns','d')], correct='a', exp='Nouns ending in -ung are always feminine: die Wohnung, die Zeitung, die Übung.'),
  dict(q='Amina buys "___ Buch". What article fits?', opts=[('der','a'),('die','b'),('das','c'),('dem','d')], correct='c', exp='das Buch — Buch is neuter. In nominative/basic context: das Buch.'),
]),
dict(file='mini-test-a1-6.html', title='Akkusativ', level='A1', module='module5-akkusativ.html', questions=[
  dict(q='Which article changes in the Akkusativ (accusative case)?', opts=[('Feminine','a'),('Neuter','b'),('Masculine','c'),('Plural','d')], correct='c', exp='Only the masculine article changes: der → den in the accusative case.'),
  dict(q='Complete: "Ich sehe ___ Mann."', opts=[('der','a'),('die','b'),('das','c'),('den','d')], correct='d', exp='"sehen" takes an accusative object. Masculine: der → den. Ich sehe den Mann.'),
  dict(q='Complete: "Kwame kauft ___ Buch."', opts=[('den','a'),('die','b'),('das','c'),('dem','d')], correct='c', exp='Buch is neuter (das Buch). Neuter does not change in accusative.'),
  dict(q='"Ich liebe ___ Musik."', opts=[('den','a'),('die','b'),('das','c'),('dem','d')], correct='b', exp='Musik is feminine (die Musik). Feminine does not change in accusative.'),
  dict(q='Which sentence uses Akkusativ correctly?', opts=[('Ich sehe der Mann.','a'),('Ich sehe den Mann.','b'),('Ich sehe dem Mann.','c'),('Ich sehe die Mann.','d')], correct='b', exp='Masculine accusative: der → den. "Ich sehe den Mann" is correct.'),
]),
dict(file='mini-test-a1-7.html', title='Dativ', level='A1', module='module6-dativ.html', questions=[
  dict(q='"mit" always requires which case?', opts=[('Nominativ','a'),('Akkusativ','b'),('Dativ','c'),('Genitiv','d')], correct='c', exp='"mit" is a dative preposition. Always use dative after: mit, bei, nach, seit, von, zu, aus.'),
  dict(q='The dative feminine article is?', opts=[('die','a'),('der','b'),('dem','c'),('den','d')], correct='b', exp='Feminine dative = der. Example: Ich gebe der Frau das Buch.'),
  dict(q='"Ich gebe ___ Frau das Buch."', opts=[('die','a'),('der','b'),('dem','c'),('den','d')], correct='b', exp='Frau is feminine. Dative feminine = der. The woman receives the book.'),
  dict(q='"Kofi fährt mit ___ Bus."', opts=[('der','a'),('die','b'),('dem','c'),('den','d')], correct='c', exp='"mit" requires dative. Bus is masculine (der Bus). Dative masculine = dem.'),
  dict(q='Which preposition ALWAYS takes Dativ?', opts=[('durch','a'),('für','b'),('bei','c'),('gegen','d')], correct='c', exp='"bei" is a dative preposition. durch, für, gegen take accusative.'),
]),
dict(file='mini-test-a1-8.html', title='Word Order (Wortstellung)', level='A1', module='module7-word-order.html', questions=[
  dict(q='Where does the verb go in a normal German sentence?', opts=[('Position 1','a'),('Position 2','b'),('Position 3','c'),('At the end','d')], correct='b', exp='The verb ALWAYS goes in position 2 in a main clause. This is the most important rule!'),
  dict(q='Which sentence(s) have correct word order?', opts=[('Ich lerne heute Deutsch.','a'),('Ich heute lerne Deutsch.','b'),('Heute lerne ich Deutsch.','c'),('Both a and c','d')], correct='d', exp='Both are correct! When a time word starts (c), verb stays in position 2, subject moves to 3.'),
  dict(q='After "weil" the verb goes where?', opts=[('Position 2','a'),('Position 1','b'),('At the end','c'),('After subject','d')], correct='c', exp='"weil" sends the verb to the END of the clause.'),
  dict(q='"Morgen ___ Amina nach Berlin." What fits?', opts=[('Amina fährt','a'),('fährt Amina','b'),('fahren Amina','c'),('Amina fahren','d')], correct='b', exp='"Morgen" in position 1. Verb in position 2 = fährt. Subject Amina moves to position 3.'),
  dict(q='Which is correct?', opts=[('Ich weiß nicht, wann er kommt.','a'),('Ich weiß nicht, wann kommt er.','b'),('Ich weiß nicht, er wann kommt.','c'),('Ich weiß nicht, kommt er wann.','d')], correct='a', exp='"wann" introduces a subordinate clause — verb goes to the end: "wann er kommt".'),
]),
dict(file='mini-test-a1-9.html', title='Present Tense Conjugation', level='A1', module='module8-present-tense.html', questions=[
  dict(q='"lernen" — what is the ich form?', opts=[('lernst','a'),('lernt','b'),('lerne','c'),('lernen','d')], correct='c', exp='Regular verbs: ich = stem + e → lern + e = lerne.'),
  dict(q='"sprechen" — what is the er/sie form?', opts=[('spricht','a'),('spreche','b'),('sprechst','c'),('sprechen','d')], correct='a', exp='"sprechen" is irregular — e→i vowel change: er spricht.'),
  dict(q='Which verb is irregular?', opts=[('machen','a'),('lernen','b'),('sein','c'),('kaufen','d')], correct='c', exp='"sein" is highly irregular: ich bin, du bist, er ist, wir sind — must be memorised.'),
  dict(q='"wir ___ aus Ghana." (kommen)', opts=[('kommt','a'),('kommen','b'),('kommst','c'),('komme','d')], correct='b', exp='wir = stem + en → komm + en = kommen. wir/sie/Sie always end in -en.'),
  dict(q='Correct conjugation of "haben" for "ihr"?', opts=[('hat','a'),('haben','b'),('habt','c'),('habe','d')], correct='c', exp='ihr form of haben = habt. ihr habt = you all have.'),
]),
dict(file='mini-test-a1-10.html', title='Personal Pronouns', level='A1', module='module9-personal-pronouns.html', questions=[
  dict(q='What is the formal "you" in German?', opts=[('du','a'),('ihr','b'),('Sie','c'),('er','d')], correct='c', exp='"Sie" (capital S) is the formal singular and plural "you". Use with strangers, officials, and examiners.'),
  dict(q='"sie" can mean?', opts=[('she only','a'),('they only','b'),('she, they, or formal Sie','c'),('it only','d')], correct='c', exp='"sie" = she OR they (lowercase). "Sie" capitalised = formal you. Context tells you which!'),
  dict(q='Which pronoun replaces "Amina"?', opts=[('er','a'),('sie','b'),('es','c'),('ihr','d')], correct='b', exp='Amina is female → she → sie. er = he, es = it.'),
  dict(q='You address a Goethe examiner with?', opts=[('du','a'),('ihr','b'),('Sie','c'),('sie','d')], correct='c', exp='Always use formal Sie with examiners, professors, and strangers in formal contexts.'),
  dict(q='"Kwame und Kofi" = which pronoun?', opts=[('er','a'),('sie','b'),('wir','c'),('ihr','d')], correct='b', exp='Two or more people (not including yourself) = sie (they).'),
]),
dict(file='mini-test-a1-11.html', title='Plural Forms', level='A1', module='module10-plural-nouns.html', questions=[
  dict(q='Plural of "Kind" (child) is?', opts=[('Kinds','a'),('Kinder','b'),('Kinde','c'),('Kindern','d')], correct='b', exp='Kind → Kinder. An -er plural.'),
  dict(q='Which noun forms its plural with "-en"?', opts=[('Mann','a'),('Kind','b'),('Frau','c'),('Auto','d')], correct='c', exp='Frau → Frauen. Many feminine nouns take -en or -n in the plural.'),
  dict(q='Plural of "Auto" is?', opts=[('Autos','a'),('Autoen','b'),('Autöer','c'),('Autoes','d')], correct='a', exp='Auto → Autos. Foreign loan words often take -s in the plural.'),
  dict(q='African learners often make this plural mistake:', opts=[('Adding -s to everything','a'),('Adding -en to everything','b'),('Not changing the noun','c'),('Removing the article','d')], correct='a', exp='English influence: adding -s to everything. German has 8+ plural patterns — each noun must be learned.'),
  dict(q='Plural of "Mann" (man) is?', opts=[('Männer','a'),('Mannen','b'),('Mans','c'),('Männen','d')], correct='a', exp='Mann → Männer. Umlaut + -er ending.'),
]),
dict(file='mini-test-a1-12.html', title='Negation (nicht/kein)', level='A1', module='module11-negation.html', questions=[
  dict(q='"kein" negates what?', opts=[('Verbs','a'),('Adjectives','b'),('Nouns (replaces the article)','c'),('Adverbs','d')], correct='c', exp='"kein" replaces the article before a noun. Ich habe ein Auto → Ich habe kein Auto.'),
  dict(q='"Ich habe ___ Auto."', opts=[('nicht','a'),('kein','b'),('keine','c'),('keinen','d')], correct='b', exp='Auto is neuter (das Auto). kein follows ein-word endings: kein Auto.'),
  dict(q='"Ich bin ___ müde." (I am not tired)', opts=[('kein','a'),('keine','b'),('nicht','c'),('keinen','d')], correct='c', exp='"müde" is an adjective. Negate adjectives with "nicht".'),
  dict(q='"Amina hat ___ Schwester."', opts=[('kein','a'),('keine','b'),('nicht','c'),('keinen','d')], correct='b', exp='Schwester is feminine (die Schwester). keine → feminine ein-word ending.'),
  dict(q='Correct negation: "Er kommt ___ heute."', opts=[('kein','a'),('keine','b'),('nicht','c'),('keinen','d')], correct='c', exp='"heute" is an adverb. Adverbs are negated with "nicht". "kein" is only for nouns.'),
]),
dict(file='mini-test-a1-13.html', title='Modal Verbs', level='A1', module='module12-modal-verbs.html', questions=[
  dict(q='"möchten" means?', opts=[('must','a'),('can','b'),('would like to','c'),('should','d')], correct='c', exp='"möchten" = would like to. It is the polite form of "wollen".'),
  dict(q='Where does the modal verb go in a sentence?', opts=[('Position 1','a'),('Position 2','b'),('At the end','c'),('Before subject','d')], correct='b', exp='Modal verbs follow the same rule as all verbs: position 2.'),
  dict(q='Where does the infinitive go with a modal verb?', opts=[('Position 2','a'),('Position 1','b'),('At the end','c'),('After subject','d')], correct='c', exp='"Ich möchte Deutsch lernen." — modal (möchte) = position 2, infinitive (lernen) = end.'),
  dict(q='"Ich ___ Deutsch lernen." (I want to learn German — politely)', opts=[('muss','a'),('kann','b'),('will','c'),('möchte','d')], correct='d', exp='"möchte" is the polite "want to". Always use this for requests and orders.'),
  dict(q='Which is most polite for ordering in a restaurant?', opts=[('Ich will einen Kaffee.','a'),('Ich muss einen Kaffee.','b'),('Ich möchte einen Kaffee.','c'),('Ich kann einen Kaffee.','d')], correct='c', exp='"Ich möchte..." = "I would like..." — always use this in shops and restaurants.'),
]),

# ━━━━━━━━━━━━━━━━━━━━━━ A2 ━━━━━━━━━━━━━━━━━━━━━━
dict(file='mini-test-a2-1.html', title='Perfekt (Vergangenheit)', level='A2', module='module13-perfekt.html', questions=[
  dict(q='Wie bildet man das Perfekt?', opts=[('haben/sein + Infinitiv','a'),('haben/sein + Partizip II','b'),('werden + Partizip II','c'),('haben + Infinitiv am Ende','d')], correct='b', exp='Perfekt = haben/sein (Position 2) + Partizip II (am Ende). Beispiel: Ich habe gegessen.'),
  dict(q='Amina ___ gestern ins Kino ___. (gehen)', opts=[('hat … gegangen','a'),('ist … gegangen','b'),('hat … gegangt','c'),('ist … gehen','d')], correct='b', exp='"gehen" ist ein Bewegungsverb → Perfekt mit "sein". Partizip II = gegangen.'),
  dict(q='Partizip II von "kaufen" ist?', opts=[('kauft','a'),('gekauft','b'),('gekaught','c'),('kaufend','d')], correct='b', exp='Regelmäßige Verben: ge- + Stamm + -t → gekauft.'),
  dict(q='Kofi ___ das Buch ___. (lesen — unregelmäßig)', opts=[('hat … gelest','a'),('ist … gelesen','b'),('hat … gelesen','c'),('hat … gelesst','d')], correct='c', exp='"lesen" ist unregelmäßig. Partizip II = gelesen. Mit "haben".'),
  dict(q='Welcher Satz ist richtig im Perfekt?', opts=[('Ich bin Deutsch gelernt.','a'),('Ich habe Deutsch gelernt.','b'),('Ich habe Deutsch lernte.','c'),('Ich bin Deutsch lernen.','d')], correct='b', exp='"lernen" ist kein Bewegungsverb → mit "haben". Partizip II = gelernt.'),
]),
dict(file='mini-test-a2-2.html', title='Trennbare Verben', level='A2', module='module14-separable-verbs.html', questions=[
  dict(q='Was passiert mit dem Präfix bei trennbaren Verben im Hauptsatz?', opts=[('Es bleibt am Verb.','a'),('Es geht ans Ende.','b'),('Es geht an den Anfang.','c'),('Es fällt weg.','d')], correct='b', exp='Trennbare Verben: Präfix geht ans Ende. Beispiel: aufmachen → Ich mache die Tür auf.'),
  dict(q='Welches Verb ist trennbar?', opts=[('verstehen','a'),('beginnen','b'),('ankommen','c'),('vergessen','d')], correct='c', exp='"ankommen" ist trennbar: an|kommen. Ich komme um 8 Uhr an.'),
  dict(q='Kwame ___ das Licht ___. (anmachen)', opts=[('anmacht … –','a'),('macht … an','b'),('machen … an','c'),('macht an … –','d')], correct='b', exp='"anmachen" → Kwame macht das Licht an. Präfix "an" geht ans Ende.'),
  dict(q='Partizip II von "aufstehen" ist?', opts=[('aufgestanden','a'),('geaufstanden','b'),('aufstehte','c'),('gestanden auf','d')], correct='a', exp='Trennbare Verben: Präfix + ge + Stamm + en/t → aufgestanden.'),
  dict(q='Amina ruft ihre Mutter ___. (anrufen)', opts=[('an','a'),('auf','b'),('ab','c'),('aus','d')], correct='a', exp='"anrufen" = to call. Das Präfix ist "an". Amina ruft ihre Mutter an.'),
]),
dict(file='mini-test-a2-3.html', title='Adjektivendungen', level='A2', module='module15-adjective-endings.html', questions=[
  dict(q='Nach dem bestimmten Artikel — welche Endungen sind möglich?', opts=[('+e oder +en','a'),('+er, +es, +em','b'),('+st','c'),('keine Endung','d')], correct='a', exp='Nach bestimmtem Artikel: Adjektiv + -e (Nom. sg.) oder -en (alle anderen). Beispiel: der große Mann.'),
  dict(q='Kofi kauft ein ___ Auto. (neu)', opts=[('neue','a'),('neues','b'),('neuer','c'),('neuem','d')], correct='b', exp='Unbestimmter Artikel + Neutrum + Akkusativ → -es. Ein neues Auto.'),
  dict(q='Amina trägt die ___ Jacke. (rot)', opts=[('roter','a'),('roten','b'),('rote','c'),('rotem','d')], correct='c', exp='Bestimmter Artikel + Femininum + Akkusativ → -e. Amina trägt die rote Jacke.'),
  dict(q='Das ist ein ___ Mann. (alt)', opts=[('alte','a'),('altem','b'),('alter','c'),('altes','d')], correct='c', exp='Unbestimmter Artikel + Maskulinum + Nominativ → -er. Ein alter Mann.'),
  dict(q='Ich wohne in einer ___ Stadt. (groß)', opts=[('großer','a'),('großen','b'),('große','c'),('großem','d')], correct='b', exp='Unbestimmter Artikel + Femininum + Dativ (in einer) → -en. In einer großen Stadt.'),
]),
dict(file='mini-test-a2-4.html', title='Nebensätze (Konjunktionen)', level='A2', module='module16-subordinate-clauses.html', questions=[
  dict(q='Was passiert mit dem Verb im Nebensatz?', opts=[('Es bleibt in Position 2.','a'),('Es geht ans Ende.','b'),('Es geht an den Anfang.','c'),('Es wird weggelassen.','d')], correct='b', exp='Im Nebensatz geht das Verb ans Ende: Ich komme, weil ich Zeit habe.'),
  dict(q='Amina lernt Deutsch, ___ sie in Deutschland studieren möchte.', opts=[('aber','a'),('weil','b'),('und','c'),('oder','d')], correct='b', exp='"weil" = because — leitet einen Nebensatz ein. Verb (möchte) geht ans Ende.'),
  dict(q='Ich weiß, ___ der Zug um 8 Uhr abfährt.', opts=[('dass','a'),('ob','b'),('weil','c'),('wenn','d')], correct='a', exp='"dass" verbindet einen Aussagesatz als Nebensatz. Verb (abfährt) geht ans Ende.'),
  dict(q='Kofi fragt, ___ das Kino offen ist.', opts=[('dass','a'),('weil','b'),('ob','c'),('wenn','d')], correct='c', exp='"ob" = whether — für indirekte Ja/Nein-Fragen. Verb geht ans Ende.'),
  dict(q='Welcher Satz ist grammatisch richtig?', opts=[('Ich lerne Deutsch, weil ich arbeiten will in Deutschland.','a'),('Ich lerne Deutsch, weil ich in Deutschland arbeiten will.','b'),('Ich lerne Deutsch, weil will ich in Deutschland arbeiten.','c'),('Ich lerne Deutsch, weil in Deutschland ich arbeiten will.','d')], correct='b', exp='Nebensatz: Verb ans Ende. Modalverb (will) kommt ganz am Ende.'),
]),
dict(file='mini-test-a2-5.html', title='Komparativ & Superlativ', level='A2', module='module17-comparative-superlative.html', questions=[
  dict(q='Komparativ von "groß" ist?', opts=[('größer','a'),('am größten','b'),('mehr groß','c'),('gröster','d')], correct='a', exp='Komparativ: Adjektiv + -er → groß + er = größer (mit Umlaut!).'),
  dict(q='Superlativ von "schnell" ist?', opts=[('schneller','a'),('am schnellsten','b'),('schnellst','c'),('am schneller','d')], correct='b', exp='Superlativ: am + Adjektiv + -sten → am schnellsten.'),
  dict(q='Berlin ist ___ München. (groß — Ungleichheit)', opts=[('so groß wie','a'),('größer als','b'),('am größten als','c'),('mehr groß als','d')], correct='b', exp='Komparativ + "als" für Ungleichheit. Berlin ist größer als München.'),
  dict(q='Amina und Fatima sind gleich alt. Wähle den richtigen Satz:', opts=[('Amina ist älter als Fatima.','a'),('Amina ist so alt wie Fatima.','b'),('Amina ist am ältesten.','c'),('Amina ist alt als Fatima.','d')], correct='b', exp='Gleichheit: so + Adjektiv + wie. Amina ist so alt wie Fatima.'),
  dict(q='Was ist der Superlativ von "gut"?', opts=[('guter','a'),('güter','b'),('am besten','c'),('am gutsten','d')], correct='c', exp='"gut" ist unregelmäßig: gut → besser → am besten. Auswendig lernen!'),
]),
dict(file='mini-test-a2-6.html', title='Reflexive Verben', level='A2', module='module18-reflexive-verbs.html', questions=[
  dict(q='Was ist ein reflexives Verb?', opts=[('Ein Verb, das immer mit "sein" geht','a'),('Ein Verb, dessen Aktion auf das Subjekt zurückfällt','b'),('Ein Verb ohne Akkusativobjekt','c'),('Ein trennbares Verb','d')], correct='b', exp='Reflexive Verben: Subjekt = Objekt. Ich wasche mich = I wash myself.'),
  dict(q='Reflexivpronomen für "ich" (Akkusativ) ist?', opts=[('sich','a'),('mich','b'),('dich','c'),('uns','d')], correct='b', exp='"ich" → mich (Akkusativ). Ich freue mich. ich → mir (Dativ): Ich kaufe mir etwas.'),
  dict(q='Kofi ___ für die Prüfung. (sich vorbereiten)', opts=[('vorbereitet sich','a'),('bereitet sich … vor','b'),('bereitet … sich vor','c'),('sich bereitet … vor','d')], correct='b', exp='Kofi bereitet sich für die Prüfung vor. Trennbar + reflexiv: Präfix ans Ende.'),
  dict(q='Amina ___ über die gute Note. (sich freuen)', opts=[('freut sich','a'),('sich freut','b'),('freut mich','c'),('freuen sich','d')], correct='a', exp='"sich freuen": er/sie → freut. Reflexivpronomen für sie (3. Sg.) = sich.'),
  dict(q='Welcher Satz ist richtig?', opts=[('Ich erinnere mir an den Urlaub.','a'),('Ich erinnere mich an den Urlaub.','b'),('Ich erinnere sich an den Urlaub.','c'),('Ich erinnere dich an den Urlaub.','d')], correct='b', exp='"sich erinnern": ich → mich (Akkusativ). Ich erinnere mich.'),
]),
dict(file='mini-test-a2-7.html', title='Wechselpräpositionen', level='A2', module='module19-two-way-prepositions.html', questions=[
  dict(q='Wann steht nach einer Wechselpräposition der Akkusativ?', opts=[('Bei Ort (Wo?)','a'),('Bei Bewegung/Richtung (Wohin?)','b'),('Immer','c'),('Nie','d')], correct='b', exp='Wohin? (Richtung) → Akkusativ. Wo? (Ort) → Dativ.'),
  dict(q='"Das Buch liegt ___ dem Tisch." (Wo?)', opts=[('auf','a'),('in','b'),('an','c'),('über','d')], correct='a', exp='"auf dem Tisch" = on the table (Wo? → Dativ → dem). Das Buch liegt auf dem Tisch.'),
  dict(q='"Amina legt das Buch ___ den Tisch." (Wohin?)', opts=[('auf den','a'),('auf dem','b'),('in den','c'),('an den','d')], correct='a', exp='"legen" = Bewegung → Akkusativ → den Tisch (mask. Akk.). Auf den Tisch.'),
  dict(q='"Kofi hängt das Bild ___ Wand." (an, Wohin?)', opts=[('an der','a'),('an die','b'),('an dem','c'),('an das','d')], correct='b', exp='"hängen" (aktiv) → Wohin? → Akkusativ. Wand ist feminin → die Wand → an die Wand.'),
  dict(q='Was ist der Unterschied zwischen "liegen" und "legen"?', opts=[('Kein Unterschied','a'),('liegen = Position (Dativ), legen = Bewegung (Akkusativ)','b'),('liegen = Bewegung, legen = Position','c'),('Beide brauchen Akkusativ','d')], correct='b', exp='"liegen" = to be lying (Wo? → Dativ). "legen" = to lay/place (Wohin? → Akkusativ).'),
]),
dict(file='mini-test-a2-8.html', title='Reisen & Transport', level='A2', module='module20-travel-transport.html', questions=[
  dict(q='Wo kauft man eine Fahrkarte?', opts=[('Am Bahnsteig','a'),('Am Schalter oder Automaten','b'),('Im Zug beim Fahrer','c'),('Im Hotel','d')], correct='b', exp='Fahrkarten kauft man am Schalter (counter) oder am Fahrkartenautomaten.'),
  dict(q='Amina fährt von Berlin ___ München.', opts=[('nach','a'),('in','b'),('zu','c'),('an','d')], correct='a', exp='"nach" verwendet man mit Städten und Ländern ohne Artikel.'),
  dict(q='Welches Wort bedeutet "platform" auf Deutsch?', opts=[('Bahnhof','a'),('Gleis / Bahnsteig','b'),('Abfahrt','c'),('Ankunft','d')], correct='b', exp='Gleis = track, Bahnsteig = platform. Bahnhof = train station.'),
  dict(q='Der Zug hat 15 Minuten ___. (delay)', opts=[('Verspätung','a'),('Abfahrt','b'),('Umstieg','c'),('Reservierung','d')], correct='a', exp='"Verspätung haben" = to be delayed. Der Zug hat 15 Minuten Verspätung.'),
  dict(q='Kofi muss in Frankfurt ___. (change trains)', opts=[('einsteigen','a'),('aussteigen','b'),('umsteigen','c'),('abfahren','d')], correct='c', exp='"umsteigen" = to change transport. einsteigen = get on, aussteigen = get off.'),
]),
dict(file='mini-test-a2-9.html', title='Gesundheit & Körper', level='A2', module='module21-health-body.html', questions=[
  dict(q='Was sagt man beim Arzt, wenn man Schmerzen hat?', opts=[('Ich habe Hunger.','a'),('Mir tut der Kopf weh.','b'),('Ich bin müde.','c'),('Ich habe Durst.','d')], correct='b', exp='"wehtun" = to hurt/ache. "Mir tut ... weh" beim Arzt verwenden.'),
  dict(q='Welches Wort bedeutet "fever"?', opts=[('Husten','a'),('Schnupfen','b'),('Fieber','c'),('Ausschlag','d')], correct='c', exp='Fieber = fever. Husten = cough. Schnupfen = runny nose. Ausschlag = rash.'),
  dict(q='Amina geht zur ___. (pharmacy)', opts=[('Klinik','a'),('Apotheke','b'),('Praxis','c'),('Krankenhaus','d')], correct='b', exp='Apotheke = pharmacy. Praxis = doctor\'s practice. Krankenhaus = hospital.'),
  dict(q='Was schreibt der Arzt aus?', opts=[('Eine Quittung','a'),('Ein Rezept','b'),('Eine Rechnung','c'),('Ein Zeugnis','d')], correct='b', exp='Ein Rezept = prescription. Dann geht man zur Apotheke.'),
  dict(q='Kofi hat sich den Arm ___. (broken)', opts=[('verbrannt','a'),('verletzt','b'),('gebrochen','c'),('gestreckt','d')], correct='c', exp='"brechen" → Perfekt: gebrochen. Sich den Arm brechen = to break one\'s arm.'),
]),
dict(file='mini-test-a2-10.html', title='Arbeit & Beruf', level='A2', module='module22-work-professions.html', questions=[
  dict(q='Was ist eine "Bewerbung"?', opts=[('Eine Arbeitsstelle','a'),('Ein Arbeitsvertrag','b'),('Eine Stellenbewerbung (job application)','c'),('Ein Arbeitszeugnis','d')], correct='c', exp='"Bewerbung" = job application. "sich bewerben" = to apply for a job.'),
  dict(q='Amina arbeitet als Ärztin. Sie ist ___?', opts=[('arbeitslos','a'),('in Rente','b'),('berufstätig','c'),('im Urlaub','d')], correct='c', exp='"berufstätig" = employed/working. arbeitslos = unemployed. in Rente = retired.'),
  dict(q='Welches Wort bedeutet "salary"?', opts=[('Stelle','a'),('Gehalt','b'),('Vertrag','c'),('Kündigung','d')], correct='b', exp='"Gehalt" = salary (monthly). "Lohn" = wage (hourly). Kündigung = termination.'),
  dict(q='Kofi bewirbt sich ___ eine Stelle als Ingenieur.', opts=[('für','a'),('um','b'),('an','c'),('auf','d')], correct='b', exp='"sich bewerben um" = to apply for. Kofi bewirbt sich um eine Stelle.'),
  dict(q='Was ist ein "Lebenslauf"?', opts=[('Ein Motivationsschreiben','a'),('Eine Gehaltsvorstellung','b'),('Ein CV / Résumé','c'),('Ein Arbeitszeugnis','d')], correct='c', exp='"Lebenslauf" = CV. Gehört zu jeder deutschen Bewerbung.'),
]),
dict(file='mini-test-a2-11.html', title='Wohnen & Haushalt', level='A2', module='module23-housing-living.html', questions=[
  dict(q='Was ist eine "Kaltmiete"?', opts=[('Miete inkl. Heizung','a'),('Grundmiete ohne Nebenkosten','b'),('Miete im Winter','c'),('Günstige Miete','d')], correct='b', exp='"Kaltmiete" = basic rent without additional costs. "Warmmiete" = all-inclusive rent.'),
  dict(q='Amina sucht eine neue Wohnung. Sie liest die ___?', opts=[('Speisekarte','a'),('Fahrpläne','b'),('Wohnungsanzeigen','c'),('Stellenangebote','d')], correct='c', exp='"Wohnungsanzeigen" = apartment listings/ads.'),
  dict(q='Was macht der "Vermieter"?', opts=[('Er mietet eine Wohnung.','a'),('Er vermietet eine Wohnung.','b'),('Er renoviert Wohnungen.','c'),('Er kauft Wohnungen.','d')], correct='b', exp='"Vermieter" = landlord (who rents OUT). "Mieter" = tenant (who rents).'),
  dict(q='Kofi zahlt ___ für die neue Wohnung. (deposit)', opts=[('Nebenkosten','a'),('Kaution','b'),('Mietzuschuss','c'),('Provision','d')], correct='b', exp='"Kaution" = security deposit. In Deutschland oft 3 Monatsmieten.'),
  dict(q='Was ist im Mietvertrag geregelt?', opts=[('Nur die Miethöhe','a'),('Nur die Kündigungsfrist','b'),('Alle Bedingungen des Mietverhältnisses','c'),('Nur die Wohnungsgröße','d')], correct='c', exp='"Mietvertrag" = rental contract. Enthält: Miete, Nebenkosten, Laufzeit, Kündigungsfrist etc.'),
]),
dict(file='mini-test-a2-12.html', title='A2 Grammatik-Wiederholung', level='A2', module='module24-mock-exam.html', questions=[
  dict(q='Welche Zeitform wird im Deutschen für Vergangenes im Gespräch verwendet?', opts=[('Präteritum','a'),('Perfekt','b'),('Plusquamperfekt','c'),('Futur','d')], correct='b', exp='Im gesprochenen Deutsch benutzt man meist das Perfekt. Präteritum eher in Texten.'),
  dict(q='Amina hat gestern ihre Freundin ___. (anrufen)', opts=[('angeruft','a'),('angerufen','b'),('gerufan','c'),('aufgerufen','d')], correct='b', exp='Trennbares Verb: an + ge + ruf + en = angerufen.'),
  dict(q='Er ist ___ als seine Schwester. (jung — Komparativ)', opts=[('jünger','a'),('jungerer','b'),('am jüngsten','c'),('mehr jung','d')], correct='a', exp='jung → jünger (Umlaut!). Komparativ.'),
  dict(q='Ich freue ___ auf das Wochenende.', opts=[('mir','a'),('mich','b'),('sich','c'),('dich','d')], correct='b', exp='"sich freuen auf" = to look forward to. ich → mich (Akkusativ-Reflexivpronomen).'),
  dict(q='Die Bücher liegen ___ Regal. (in, Wo?)', opts=[('in dem / im','a'),('in das','b'),('auf dem','c'),('auf das','d')], correct='a', exp='"liegen" = Wo? → Dativ. "in dem" = im (Kontraktion). Die Bücher liegen im Regal.'),
]),

# ━━━━━━━━━━━━━━━━━━━━━━ B1 ━━━━━━━━━━━━━━━━━━━━━━
dict(file='mini-test-b1-1.html', title='Konjunktiv II', level='B1', module='module25-konjunktiv2.html', questions=[
  dict(q='Wofür verwendet man den Konjunktiv II?', opts=[('Für Tatsachen und Fakten','a'),('Für Wünsche, Hypothesen und höfliche Bitten','b'),('Nur für die Vergangenheit','c'),('Nur in Fragesätzen','d')], correct='b', exp='Konjunktiv II: Wünsche (Ich wäre gern…), Hypothesen (Wenn ich Zeit hätte…), höfliche Bitten (Könnten Sie…?).'),
  dict(q='Konjunktiv II von "haben" (ich/er/sie) ist?', opts=[('haben','a'),('hatte','b'),('hätte','c'),('gehabt','d')], correct='c', exp='"hätte" ist der Konjunktiv II von "haben". Bildung: Präteritum-Stamm + Umlaut + -e.'),
  dict(q='Höfliche Bitte: "___ Sie mir bitte helfen?" (können)', opts=[('Können','a'),('Könnten','b'),('Konnten','c'),('Könnte','d')], correct='b', exp='"Könnten" ist Konjunktiv II von "können" → höflicher als "Können". Könnten Sie mir helfen?'),
  dict(q='Amina sagt: "Ich ___ gern mehr Freizeit." (Wunsch, haben)', opts=[('habe','a'),('hatte','b'),('hätte','c'),('wäre','d')], correct='c', exp='"hätte gern" drückt einen Wunsch aus. Ich hätte gern mehr Freizeit = I wish I had more free time.'),
  dict(q='Welcher Satz drückt eine irreale Hypothese aus?', opts=[('Wenn ich Zeit habe, komme ich.','a'),('Wenn ich Zeit hätte, käme ich.','b'),('Weil ich Zeit habe, komme ich.','c'),('Obwohl ich Zeit habe, komme ich.','d')], correct='b', exp='"Wenn ich Zeit hätte, käme ich." — beide Verben im Konjunktiv II → irreal (Ich habe keine Zeit).'),
]),
dict(file='mini-test-b1-2.html', title='Passiv', level='B1', module='module26-passiv.html', questions=[
  dict(q='Wie bildet man das Präsens Passiv?', opts=[('haben + Partizip II','a'),('werden + Partizip II','b'),('sein + Infinitiv','c'),('werden + Infinitiv','d')], correct='b', exp='Passiv Präsens: werden (konjugiert) + Partizip II. Beispiel: Das Buch wird gelesen.'),
  dict(q='Der Brief ___ von Amina geschrieben. (Passiv Präsens)', opts=[('ist','a'),('wird','b'),('wurde','c'),('worden','d')], correct='b', exp='Passiv Präsens: wird. Der Brief wird von Amina geschrieben.'),
  dict(q='Das Auto ___ gestern repariert. (Passiv Präteritum)', opts=[('wird','a'),('wurde','b'),('ist geworden','c'),('war','d')], correct='b', exp='Passiv Präteritum: wurde + Partizip II. Das Auto wurde repariert.'),
  dict(q='Das Essen ___ bereits ___. (Passiv Perfekt, kochen)', opts=[('ist … gekocht worden','a'),('wurde … gekocht','b'),('hat … gekocht','c'),('ist … worden kochen','d')], correct='a', exp='Passiv Perfekt: sein + Partizip II + "worden". Das Essen ist gekocht worden.'),
  dict(q='Wie wird der Handelnde im Passivsatz eingeführt?', opts=[('Mit "durch" + Dativ','a'),('Mit "von" + Dativ','b'),('Mit "für" + Akkusativ','c'),('Mit "zu" + Infinitiv','d')], correct='b', exp='Agens im Passiv: "von + Dativ". Das Buch wurde von Amina geschrieben.'),
]),
dict(file='mini-test-b1-3.html', title='Relativsätze', level='B1', module='module27-relativsaetze.html', questions=[
  dict(q='Womit beginnt ein Relativsatz?', opts=[('Einer Konjunktion (weil, dass)','a'),('Einem Relativpronomen (der, die, das, den…)','b'),('Einem Modalverb','c'),('Dem Subjekt','d')], correct='b', exp='Relativsätze beginnen mit Relativpronomen: der, die, das (Nom.); den, die, das (Akk.); dem, der, dem (Dat.).'),
  dict(q='Das ist der Mann, ___ ich gestern gesehen habe. (Akk.)', opts=[('der','a'),('die','b'),('den','c'),('dem','d')], correct='c', exp='"Mann" ist maskulin. Im Akkusativ: den. "den ich gesehen habe."'),
  dict(q='Das ist die Frau, ___ in Berlin wohnt. (Nom.)', opts=[('der','a'),('die','b'),('das','c'),('den','d')], correct='b', exp='"Frau" ist feminin. Nominativ feminin = die. "die in Berlin wohnt."'),
  dict(q='Kofi zeigt uns das Haus, ___ er kaufen möchte.', opts=[('das','a'),('den','b'),('die','c'),('dem','d')], correct='a', exp='"Haus" ist neutrum. Im Akkusativ: das. "das er kaufen möchte."'),
  dict(q='Wo steht das Verb im Relativsatz?', opts=[('Position 2','a'),('Position 1','b'),('Am Ende','c'),('Direkt nach dem Relativpronomen','d')], correct='c', exp='Relativsatz = Nebensatz → Verb geht ans Ende. Das ist die Stadt, in der ich geboren bin.'),
]),
dict(file='mini-test-b1-4.html', title='Indirekte Rede', level='B1', module='module-b1-4-indirekte-rede.html', questions=[
  dict(q='Welche Verbform wird in der indirekten Rede verwendet?', opts=[('Präsens','a'),('Konjunktiv I (oder II)','b'),('Präteritum','c'),('Perfekt','d')], correct='b', exp='Indirekte Rede: Konjunktiv I. Wenn KI = Indikativ, nimmt man Konjunktiv II.'),
  dict(q='Direkt: "Ich bin müde." → Indirekt: "Er sagt, er ___ müde."', opts=[('ist','a'),('war','b'),('sei','c'),('wäre','d')], correct='c', exp='KI von "sein" für er/sie/es = sei. Er sagt, er sei müde.'),
  dict(q='Direkt: "Ich habe Hunger." → Indirekt: "Sie sagt, sie ___ Hunger."', opts=[('hat','a'),('habe','b'),('hätte','c'),('haben','d')], correct='b', exp='KI von "haben" für sie = habe. Sie sagt, sie habe Hunger.'),
  dict(q='Wann verwendet man Konjunktiv II statt Konjunktiv I?', opts=[('Immer','a'),('Wenn KI = Indikativ (nicht erkennbar als KI)','b'),('Bei Fragen','c'),('Bei negativen Aussagen','d')], correct='b', exp='Wenn KI identisch mit Indikativ ist, weicht man auf KII aus, damit klar ist, dass es indirekte Rede ist.'),
  dict(q='Direkte Frage: "Kommt er morgen?" → Indirekte Frage:', opts=[('Sie fragt, kommt er morgen.','a'),('Sie fragt, ob er morgen komme/käme.','b'),('Sie fragt, dass er morgen kommt.','c'),('Sie fragt, er kommt morgen.','d')], correct='b', exp='Indirekte Ja/Nein-Fragen mit "ob". Verb ans Ende. KI: komme oder KII: käme.'),
]),
dict(file='mini-test-b1-5.html', title='Konnektoren & Satzverbindungen', level='B1', module='module-b1-5-konnektoren.html', questions=[
  dict(q='Welcher Konnektor drückt einen Gegensatz aus?', opts=[('deshalb','a'),('außerdem','b'),('trotzdem','c'),('nämlich','d')], correct='c', exp='"trotzdem" = nevertheless — drückt Konzessivität aus. deshalb = therefore.'),
  dict(q='Amina lernt viel, ___ besteht sie die Prüfung. (Folge)', opts=[('aber','a'),('deshalb','b'),('obwohl','c'),('damit','d')], correct='b', exp='"deshalb" = therefore — drückt Folge aus. Achtung: Verb-Zweitstellung nach deshalb!'),
  dict(q='"___ er krank ist, geht er zur Arbeit." (Konzessiv)', opts=[('Weil','a'),('Wenn','b'),('Obwohl','c'),('Da','d')], correct='c', exp='"obwohl" = although — drückt einen unerwarteten Gegensatz aus.'),
  dict(q='Welcher Konnektor verknüpft Hauptsätze OHNE die Wortstellung zu ändern?', opts=[('weil','a'),('aber','b'),('dass','c'),('obwohl','d')], correct='b', exp='Koordinierende Konjunktionen (aber, und, oder, denn) lassen Verb in Pos. 2.'),
  dict(q='"Ich lerne Deutsch, ___ ich in Deutschland studieren kann." (Zweck)', opts=[('weil','a'),('damit','b'),('obwohl','c'),('als','d')], correct='b', exp='"damit" = so that — drückt einen Zweck aus. Verb ans Ende.'),
]),
dict(file='mini-test-b1-6.html', title='Genitiv', level='B1', module='module-b1-6-genitiv.html', questions=[
  dict(q='Wofür wird der Genitiv hauptsächlich verwendet?', opts=[('Für das direkte Objekt','a'),('Für das indirekte Objekt','b'),('Zum Ausdrücken von Zugehörigkeit/Besitz','c'),('Für Ortsangaben','d')], correct='c', exp='Genitiv drückt Besitz/Zugehörigkeit aus: das Buch des Mannes = the man\'s book.'),
  dict(q='Maskuliner Genitiv-Artikel ist?', opts=[('dem','a'),('den','b'),('des','c'),('der','d')], correct='c', exp='Genitiv: mask./neutr. = des (+s am Nomen), feminin = der, Plural = der.'),
  dict(q='Das Haus ___ Lehrerin ist groß. (feminin, Genitiv)', opts=[('des','a'),('der','b'),('dem','c'),('die','d')], correct='b', exp='Genitiv feminin = der. Das Haus der Lehrerin = the teacher\'s house.'),
  dict(q='Welche Präposition verlangt den Genitiv?', opts=[('mit','a'),('für','b'),('wegen','c'),('nach','d')], correct='c', exp='"wegen" + Genitiv = because of. Wegen des Wetters. Auch: trotz, während, statt.'),
  dict(q='Im Alltag wird Genitiv oft ersetzt durch:', opts=[('"von" + Dativ','a'),('Akkusativ','b'),('Nominativ','c'),('Konjunktiv','d')], correct='a', exp='Umgangssprache: "Das Haus von meinem Vater" statt "das Haus meines Vaters". Beide korrekt.'),
]),
dict(file='mini-test-b1-7.html', title='Futur I & II', level='B1', module='module-b1-7-futur.html', questions=[
  dict(q='Wie bildet man Futur I?', opts=[('sein + Infinitiv','a'),('werden + Infinitiv','b'),('haben + Partizip II','c'),('werden + Partizip II','d')], correct='b', exp='Futur I: werden (konjugiert, Pos. 2) + Infinitiv am Ende.'),
  dict(q='Amina ___ morgen nach Berlin ___. (fahren — Futur I)', opts=[('fährt … werden','a'),('wird … fahren','b'),('ist … gefahren','c'),('wird … gefahren','d')], correct='b', exp='Futur I: wird (Pos. 2) + fahren (Ende). Amina wird morgen nach Berlin fahren.'),
  dict(q='Wofür wird Futur I auch verwendet?', opts=[('Für vergangene Ereignisse','a'),('Für Vermutungen über die Gegenwart','b'),('Nur für die ferne Zukunft','c'),('Für Wünsche','d')], correct='b', exp='Futur I = Vermutung: Er wird krank sein. (He\'s probably sick.) Nicht nur für Zukunft!'),
  dict(q='Was drückt Futur II aus?', opts=[('Einen Plan','a'),('Eine vollendete Handlung in der Zukunft und Vermutungen über die Vergangenheit','b'),('Nur Vermutungen','c'),('Höfliche Bitten','d')], correct='b', exp='Futur II: werden + Partizip II + haben/sein. Bis morgen werde ich fertig sein.'),
  dict(q='Im Deutschen wird die Zukunft oft ausgedrückt durch:', opts=[('Nur Futur I','a'),('Präsens + Zeitangabe','b'),('Nur Futur II','c'),('Konjunktiv II','d')], correct='b', exp='Im Alltag: Präsens + Zeitangabe. "Ich fahre morgen nach Berlin." ist genauso korrekt.'),
]),
dict(file='mini-test-b1-8.html', title='Wortstellung (B1)', level='B1', module='module-b1-8-wortstellung.html', questions=[
  dict(q='In welcher Reihenfolge erscheinen Angaben? (TeKaMoLo)', opts=[('Lokal – Modal – Kausal – Temporal','a'),('Temporal – Kausal – Modal – Lokal','b'),('Modal – Temporal – Lokal – Kausal','c'),('Kausal – Lokal – Temporal – Modal','d')], correct='b', exp='TeKaMoLo: Temporal (wann?) – Kausal (warum?) – Modal (wie?) – Lokal (wo?). "Ich fahre heute wegen der Prüfung mit dem Zug nach Berlin."'),
  dict(q='Bei Modalverb + Infinitiv im Nebensatz, was gilt?', opts=[('Infinitiv vor Modalverb','a'),('Modalverb vor Infinitiv','b'),('Infinitiv am Ende, Modalverb direkt davor','c'),('Modalverb ans Ende allein','d')], correct='c', exp='Im Nebensatz: Infinitiv + Modalverb am Ende. "weil er kommen muss" — nicht "muss kommen".'),
  dict(q='Welcher Satz ist stilistisch am stärksten für B1-Schreiben?', opts=[('Ich bin Student. Ich lerne Deutsch. Ich will in Deutschland studieren.','a'),('Als Student lerne ich Deutsch, um in Deutschland zu studieren.','b'),('Ich bin Student und ich lerne und ich will studieren.','c'),('Student ich bin und lerne Deutsch.','d')], correct='b', exp='Satzverbindungen (um zu, als) machen den Text flüssig und zeigen grammatisches Niveau.'),
  dict(q='"dass"-Satz: "Ich hoffe, ___ Amina bald kommt."', opts=[('Ich hoffe, dass Amina bald kommt.','a'),('Ich hoffe, dass kommt Amina bald.','b'),('Ich hoffe, Amina dass bald kommt.','c'),('Ich hoffe, dass bald Amina kommt.','d')], correct='a', exp='"dass" leitet einen Nebensatz ein → Verb (kommt) ans Ende.'),
  dict(q='Infinitivkette im Nebensatz: "weil er das Buch lesen können wollte."', opts=[('lesen können wollte','a'),('wollte können lesen','b'),('können lesen wollte','c'),('wollte lesen können','d')], correct='a', exp='Infinitivkette: längster Infinitiv zuerst → lesen können wollte.'),
]),
dict(file='mini-test-b1-9.html', title='Lesen-Strategie (B1)', level='B1', module='module-b1-9-lesen-strategie.html', questions=[
  dict(q='Was bedeutet "globales Lesen"?', opts=[('Jeden Satz genau lesen','a'),('Den Text schnell überblicken, um das Hauptthema zu verstehen','b'),('Unbekannte Wörter nachschlagen','c'),('Den Text laut lesen','d')], correct='b', exp='Globales Lesen = Überblick lesen (skimming). Ziel: Was ist das Hauptthema?'),
  dict(q='Bei "Richtig/Falsch/Nicht im Text"-Aufgaben: Was tun, wenn die Info fehlt?', opts=[('"Falsch" wählen','a'),('"Richtig" wählen','b'),('"Nicht im Text" wählen','c'),('Raten','d')], correct='c', exp='"Nicht im Text" = die Information wird im Text weder bestätigt noch widerlegt. NiT ≠ Falsch!'),
  dict(q='Ein Text sagt: "Das Konzert beginnt um 20:00 Uhr." Frage: "Wann beginnt die Veranstaltung?" → Richtig, Falsch oder NiT?', opts=[('Falsch (Konzert ≠ Veranstaltung)','a'),('Richtig (Konzert = Veranstaltung, sinngemäß)','b'),('Nicht im Text','c'),('Kann nicht beantwortet werden','d')], correct='b', exp='Synonyme erkennen ist entscheidend: Konzert = Veranstaltung. Die Information ist im Text → Richtig.'),
  dict(q='Was ist die beste Strategie bei einem unbekannten Wort?', opts=[('Den Text stoppen und das Wort nachschlagen','a'),('Den Kontext nutzen, um die Bedeutung zu erschließen','b'),('Die Frage überspringen','c'),('Immer "Falsch" ankreuzen','d')], correct='b', exp='Kontexterschließung: Vor- und Nachsätze, Wortbausteine, Kognaten nutzen.'),
  dict(q='Schlüsselwörter in der Aufgabe helfen dabei:', opts=[('Den Text zu übersetzen','a'),('Die relevante Textstelle gezielt zu finden','b'),('Unbekannte Grammatik zu verstehen','c'),('Die Antwort zu erraten','d')], correct='b', exp='Schlüsselwörter markieren, dann im Text gezielt suchen. Spart Zeit bei der Prüfung.'),
]),
dict(file='mini-test-b1-10.html', title='Hören-Strategie (B1)', level='B1', module='module-b1-10-hoeren-strategie.html', questions=[
  dict(q='Was sollte man VOR dem Hören machen?', opts=[('Entspannen und nichts tun','a'),('Die Fragen und Antwortoptionen durchlesen','b'),('Den Text lesen','c'),('Stichwörter übersetzen','d')], correct='b', exp='Vor dem Hören: Fragen lesen, Schlüsselwörter markieren. So weiß man, worauf man achten muss.'),
  dict(q='Im Hörtext werden oft ___ statt der genauen Wörter aus der Aufgabe verwendet.', opts=[('Antonyme','a'),('Synonyme und Umschreibungen','b'),('Direkte Zitate','c'),('Fremdwörter','d')], correct='b', exp='Goethe-Hörtexte verwenden Synonyme. "Arbeit" in Frage → "Beruf" oder "Job" im Text. Flexibel denken!'),
  dict(q='Du hörst einen Satz nicht vollständig. Was tun?', opts=[('Aufgeben','a'),('Aus Kontext und bisherigen Infos schließen','b'),('Aufgabe leer lassen','c'),('Beim zweiten Hören nichts notieren','d')], correct='b', exp='Kontext nutzen, Notizen machen. Beim zweiten Durchgang Lücken füllen. Nie leer lassen!'),
  dict(q='Was ist eine typische Falle in Goethe-Höraufgaben?', opts=[('Zu langsames Sprechen','a'),('Ablenkende Details, die nicht gefragt werden','b'),('Unbekannte Akzente','c'),('Zu viele Sprecher','d')], correct='b', exp='Häufige Falle: Der Text erwähnt Zahlen/Details, die NICHT gefragt werden. Fokus auf die Frage!'),
  dict(q='Amina hört zweimal. Beim ersten Durchgang sollte sie:', opts=[('Alle Details notieren','a'),('Das Hauptthema und die Hauptinformationen erfassen','b'),('Nur auf unbekannte Wörter achten','c'),('Alle Antworten endgültig festlegen','d')], correct='b', exp='1. Durchgang: Gesamtverständnis. 2. Durchgang: Details prüfen, Antworten bestätigen.'),
]),
dict(file='mini-test-b1-11.html', title='Schreiben-Strategie (B1)', level='B1', module='module-b1-11-schreiben-strategie.html', questions=[
  dict(q='Was ist die Mindestwortzahl für einen B1-Schreibtext?', opts=[('50 Wörter','a'),('80 Wörter','b'),('100+ Wörter','c'),('150 Wörter','d')], correct='c', exp='B1-Schreiben: mindestens 100 Wörter. Zu kurze Texte → Punktabzug. Besser 110–130 Wörter.'),
  dict(q='Welche Anrede ist korrekt für eine formelle E-Mail?', opts=[('Hallo Herr Müller,','a'),('Sehr geehrter Herr Müller,','b'),('Lieber Müller,','c'),('Hey Herr Müller,','d')], correct='b', exp='"Sehr geehrter/geehrte" ist die formelle Anrede. Nach dem Komma beginnt der Text kleingeschrieben.'),
  dict(q='Was gehört NICHT in eine formelle E-Mail?', opts=[('Anrede','a'),('Abschlussformel','b'),('Umgangssprache und Abkürzungen','c'),('Bezug auf den Anlass','d')], correct='c', exp='Formelle E-Mails: kein Slang, keine Abkürzungen. Vollständige Sätze, höflicher Ton.'),
  dict(q='Gute Konnektoren für B1-Schreiben sind?', opts=[('und, und, und…','a'),('deshalb, obwohl, außerdem, trotzdem','b'),('aber, aber, aber…','c'),('weil, weil, weil…','d')], correct='b', exp='Variation ist wichtig! deshalb, obwohl, außerdem, trotzdem — zeigen Sprachkompetenz.'),
  dict(q='Zum Abschluss einer formellen E-Mail schreibt man:', opts=[('Tschüss!','a'),('Viele Grüße','b'),('Mit freundlichen Grüßen','c'),('Bis bald!','d')], correct='c', exp='"Mit freundlichen Grüßen" ist die standardisierte formelle Grußformel. Immer mit vollem Namen.'),
]),
dict(file='mini-test-b1-12.html', title='Sprechen-Strategie (B1)', level='B1', module='module-b1-12-sprechen-strategie.html', questions=[
  dict(q='Was zeigt man bei der B1-Kurzpräsentation besonders?', opts=[('Auswendiglernen eines Textes','a'),('Strukturiertes Sprechen mit Einleitung, Hauptteil, Schluss','b'),('Nur Vokabular zum Thema','c'),('Grammatikregeln erklären','d')], correct='b', exp='Kurzpräsentation: Struktur zeigen! Einleitung (Thema), Hauptteil (Argumente), Schluss (Fazit).'),
  dict(q='Welcher Ausdruck hilft, Zeit beim Sprechen zu gewinnen?', opts=[('Ich weiß nicht.','a'),('Das ist eine interessante Frage. Also…','b'),('Ich verstehe nicht.','c'),('Moment.','d')], correct='b', exp='"Das ist eine interessante Frage. Also..." — Zeit kaufen ohne aufzugeben!'),
  dict(q='Beim gemeinsamen Planen (Teil 2) ist es wichtig:', opts=[('Nur die eigene Meinung zu vertreten','a'),('Auf den Partner einzugehen und gemeinsam zu entscheiden','b'),('Alle Punkte schnell abzuarbeiten','c'),('Perfekte Grammatik zu zeigen','d')], correct='b', exp='Teil 2 = Interaktion! Zuhören, reagieren, fragen, Kompromisse finden. Kommunikation > Perfektion.'),
  dict(q='Wenn man ein Wort nicht kennt, sollte man:', opts=[('Schweigen','a'),('Auf Englisch wechseln','b'),('Das Wort umschreiben oder erklären','c'),('Das Gespräch beenden','d')], correct='c', exp='Umschreiben = wichtige B1-Kompetenz. "Das Ding, womit man… / Eine Art von… / Das bedeutet so etwas wie…"'),
  dict(q='Eine Meinung auf B1-Niveau ausdrücken:', opts=[('Ja. / Nein. / Vielleicht.','a'),('Ich denke/meine/glaube, dass… + Begründung','b'),('Das ist gut. Das ist schlecht.','c'),('Ich mag das.','d')], correct='b', exp='"Ich denke, dass…" + Begründung (weil/denn) zeigt Argumentationsfähigkeit auf B1-Niveau.'),
]),
]

def main():
    for t in TESTS:
        content = html_file(t['title'], t['level'], t['module'], t['questions'])
        path = os.path.join(BASE, t['file'])
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("OK " + t['file'])
    print("Done! " + str(len(TESTS)) + " files created.")

if __name__ == '__main__':
    main()
