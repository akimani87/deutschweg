#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Restructure B2 modules to match module5-akkusativ.html pattern:
  Lesson content (step 0) -> Quiz green card (step 1) -> repeat for each lesson
Removes overview quiz, converts quiz steps to module5 style, rebuilds JS.
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
B2_FILES = sorted([f for f in os.listdir(BASE) if f.startswith('module-b2-') and f.endswith('.html')])

# ── Green quiz step HTML (module5 pattern) ────────────────────────────────────
def make_quiz_step(n):
    return (
        '\n      <div class="step" id="l{n}-s1">\n'
        '        <div class="card" style="border-color:var(--green);background:rgba(39,174,96,0.04);">\n'
        '          <div class="concept-tag" style="color:var(--green);">LEKTION {np1} \u2014 QUIZ</div>\n'
        '          <h2 class="lesson-h">\u00dcbungsaufgaben</h2>\n'
        '          <div id="qz-{n}"></div>\n'
        '        </div>\n'
        '        <div class="nav-row"><button class="btn btn-outline" onclick="prevStep({n},1)">\u2190 Zur\u00fcck</button></div>\n'
        '      </div>'
    ).format(n=n, np1=n+1)

# ── CSS additions ─────────────────────────────────────────────────────────────
EXTRA_CSS = '\n  /* module5 pattern */\n  .nav-row{display:flex;gap:12px;margin-top:20px;}\n'

# ── New JS (module5 pattern, German, 5 lessons) ───────────────────────────────
# Note: emoji used directly (UTF-8). JS escape sequences use double-backslash.
NEW_JS = (
    'var currentLesson=0,xp=0,TOTAL=5,qSt={};\n'
    'function initQuiz(li){\n'
    '  var el=document.getElementById(\'qz-\'+li);\n'
    '  if(!el||el.dataset.ready)return;\n'
    '  el.dataset.ready=\'1\';\n'
    '  qSt[li]={cur:0,correct:0};\n'
    '  renderQ(li);\n'
    '}\n'
    'function renderQ(li){\n'
    '  var el=document.getElementById(\'qz-\'+li);if(!el)return;\n'
    '  var s=qSt[li],qs=QD[li];if(!s||s.cur>=qs.length){showResult(li);return;}\n'
    '  var q=qs[s.cur];\n'
    '  el.innerHTML=\'<div class="quiz-qnum">FRAGE \'+(s.cur+1)+\' VON \'+qs.length+\'</div>\'+\n'
    '    \'<div class="quiz-q" style="white-space:pre-line;">\'+q.q+\'</div>\'+\n'
    '    \'<div class="quiz-hint">\'+q.hint+\'</div>\'+\n'
    '    \'<div class="quiz-opts">\'+q.opts.map(function(o,i){\n'
    '      return \'<button class="qopt" id="qz\'+li+\'-o\'+i+\'" onclick="pickQ(\'+li+\',\'+i+\')"><span class="qletter">\'+(\'ABCD\'[i])+\'</span>\'+o+\'</button>\';\n'
    '    }).join(\'\')+\'</div>\'+\n'
    '    \'<div class="qfeedback" id="qz\'+li+\'-fb"><div class="qft" id="qz\'+li+\'-fbt"></div><div class="qfb" id="qz\'+li+\'-fbb"></div><div class="qfr" id="qz\'+li+\'-fbr"></div></div>\'+\n'
    '    \'<div class="qnext" id="qz\'+li+\'-nx"><button class="btn btn-primary" onclick="advQ(\'+li+\')">\'+(s.cur<qs.length-1?\'N\\u00e4chste Frage \\u2192\':\'Ergebnis anzeigen \\u2192\')+\'</button></div>\';\n'
    '}\n'
    'function pickQ(li,idx){\n'
    '  var s=qSt[li],q=QD[li][s.cur],ok=idx===q.ans;\n'
    '  if(ok){s.correct++;xp+=20;document.getElementById(\'xpDisp\').textContent=\'\\u26a1 \'+xp+\' XP\';}\n'
    '  document.querySelectorAll(\'#qz-\'+li+\' .qopt\').forEach(function(b,i){\n'
    '    b.disabled=true;\n'
    '    if(i===q.ans)b.classList.add(\'correct\');\n'
    '    if(i===idx&&!ok)b.classList.add(\'wrong\');\n'
    '  });\n'
    '  var fb=document.getElementById(\'qz\'+li+\'-fb\');\n'
    '  fb.classList.add(\'show\',ok?\'ok\':\'no\');\n'
    '  var fbt=document.getElementById(\'qz\'+li+\'-fbt\');\n'
    '  fbt.className=\'qft \'+(ok?\'ok\':\'no\');\n'
    '  fbt.textContent=ok?\'\\u2713 Richtig!\':\'\\u2717 Leider nicht\';\n'
    '  document.getElementById(\'qz\'+li+\'-fbb\').textContent=q.exp;\n'
    '  document.getElementById(\'qz\'+li+\'-fbr\').textContent=\'\\U0001F4CC \'+q.rule;\n'
    '  document.getElementById(\'qz\'+li+\'-nx\').classList.add(\'show\');\n'
    '}\n'
    'function advQ(li){qSt[li].cur++;renderQ(li);}\n'
    'function showResult(li){\n'
    '  var el=document.getElementById(\'qz-\'+li),s=qSt[li],total=QD[li].length;\n'
    '  var pct=Math.round(s.correct/total*100),isLast=(li===TOTAL-1);\n'
    '  el.innerHTML=\'<div style="text-align:center;padding:16px 0;">\'+\n'
    '    \'<div style="font-size:44px;margin-bottom:10px;">\'+(pct===100?\'\\U0001F31F\':pct>=60?\'\\U0001F44D\':\'\\U0001F4AA\')+\'</div>\'+\n'
    '    \'<div style="font-family:\\\'Playfair Display\\\',serif;font-size:24px;margin-bottom:6px;">\'+s.correct+\'/\'+total+\' richtig</div>\'+\n'
    '    \'<div style="color:var(--gray);font-size:13px;margin-bottom:18px;">\'+(pct===100?\'Perfekt!\':pct>=60?\'Sehr gut!\':\'Nochmal \\u00fcben.\')+\'</div>\'+\n'
    '    \'<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(52,152,219,0.12);border:1px solid var(--blue);border-radius:50px;padding:9px 22px;color:var(--blue);font-weight:700;margin-bottom:20px;">\\u26a1 +\'+(s.correct*20)+\' XP</div><br>\'+\n'
    '    (isLast?\n'
    '      \'<button class="btn btn-primary" style="max-width:340px;margin-top:8px;" onclick="goStep(4,2)">Modul abschlie\\u00dfen \\u2192</button>\':\n'
    '      \'<button class="btn btn-primary" style="max-width:340px;margin-top:8px;" onclick="goLesson(\'+(li+1)+\')">N\\u00e4chste Lektion \\u2192</button>\')+\n'
    '    \'</div>\';\n'
    '}\n'
    'function showOverview(){\n'
    '  document.getElementById(\'screen-overview\').classList.add(\'active\');\n'
    '  document.getElementById(\'screen-lesson\').classList.remove(\'active\');\n'
    '  window.scrollTo(0,0);\n'
    '}\n'
    'function goLesson(idx){\n'
    '  currentLesson=idx;\n'
    '  document.getElementById(\'screen-overview\').classList.remove(\'active\');\n'
    '  document.getElementById(\'screen-lesson\').classList.add(\'active\');\n'
    '  document.querySelectorAll(\'.lesson-pane\').forEach(function(p){p.style.display=\'none\';});\n'
    '  var pane=document.getElementById(\'lesson-\'+idx);\n'
    '  if(pane){pane.style.display=\'block\';pane.querySelectorAll(\'.step\').forEach(function(s,i){s.classList.toggle(\'active\',i===0);});}\n'
    '  renderDots();updateProg(idx,0);window.scrollTo(0,0);\n'
    '}\n'
    'function goStep(li,si){\n'
    '  var steps=document.querySelectorAll(\'#lesson-\'+li+\' .step\');\n'
    '  steps.forEach(function(s,i){s.classList.toggle(\'active\',i===si);});\n'
    '  document.querySelectorAll(\'#dotRow .dot\').forEach(function(d,i){d.classList.toggle(\'active\',i===si);d.classList.toggle(\'done\',i<si);});\n'
    '  if(si===2&&li===TOTAL-1){var stored=parseInt(localStorage.getItem(\'dw_xp\')||\'0\');localStorage.setItem(\'dw_xp\',stored+xp);}\n'
    '  updateProg(li,si);window.scrollTo(0,0);\n'
    '}\n'
    'function nextStep(li,si){\n'
    '  var steps=document.getElementById(\'lesson-\'+li).querySelectorAll(\'.step\'),nx=si+1;\n'
    '  if(nx<steps.length){steps[si].classList.remove(\'active\');steps[nx].classList.add(\'active\');updateProg(li,nx);window.scrollTo(0,0);if(nx===1)initQuiz(li);}\n'
    '  else{if(li+1<TOTAL)goLesson(li+1);else goStep(TOTAL-1,2);}\n'
    '}\n'
    'function prevStep(li,si){\n'
    '  if(si===0){showOverview();return;}\n'
    '  var steps=document.getElementById(\'lesson-\'+li).querySelectorAll(\'.step\');\n'
    '  steps[si].classList.remove(\'active\');steps[si-1].classList.add(\'active\');\n'
    '  updateProg(li,si-1);window.scrollTo(0,0);\n'
    '}\n'
    'function renderDots(){\n'
    '  var row=document.getElementById(\'dotRow\');row.innerHTML=\'\';\n'
    '  for(var i=0;i<TOTAL;i++){var d=document.createElement(\'div\');d.className=\'dot\'+(i<currentLesson?\' done\':i===currentLesson?\' active\':\'\');(function(x){d.onclick=function(){goLesson(x);};})(i);row.appendChild(d);}\n'
    '}\n'
    'function updateProg(li,si){document.getElementById(\'progFill\').style.width=((li*2+si)/(TOTAL*2)*100)+\'%\';}\n'
    'document.addEventListener(\'DOMContentLoaded\',function(){\n'
    '  document.body.classList.add(\'ready\');\n'
    '  xp=0;document.getElementById(\'xpDisp\').textContent=\'\\u26a1 0 XP\';\n'
    '});\n'
    'if(document.readyState===\'complete\'||document.readyState===\'interactive\'){document.body.classList.add(\'ready\');}\n'
)


def process(fname):
    path = os.path.join(BASE, fname)
    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()

    # ── 1. Remove OBQ HTML (overview quiz) ─────────────────────────────────
    html = re.sub(
        r'\n    <!-- OBQ: OVERVIEW QUIZ -->.*?\n    </div>\n',
        '\n',
        html, flags=re.DOTALL
    )

    # ── 2. Remove OBQ CSS block ─────────────────────────────────────────────
    html = re.sub(
        r'\n  /\* ===== OBQ: Overview Quiz ===== \*/.*?(?=\n  (?:\.|\*/|/\*))',
        '',
        html, flags=re.DOTALL
    )

    # ── 3. Replace quiz steps (l0-s1 through l4-s1) ─────────────────────────
    for n in range(5):
        pat = re.compile(
            r'\n      <div class="step" id="l' + str(n) + r'-s1">.*?\n      </div>',
            re.DOTALL
        )
        html = pat.sub(make_quiz_step(n), html, count=1)

    # ── 4. Add nav-row CSS if missing ───────────────────────────────────────
    if '.nav-row' not in html:
        # Insert before the first </style>
        html = html.replace('</style>', EXTRA_CSS + '</style>', 1)

    # ── 5. Rebuild script section ───────────────────────────────────────────
    # Extract QD block (from var QD to first line-start };)
    qd_match = re.search(r'(var QD\s*=\s*\{.*?\n\};\n)', html, re.DOTALL)
    if not qd_match:
        print('  WARN %s: QD not found, skipping JS rebuild' % fname)
        return

    qd_block = qd_match.group(1)

    # Extract speakSentence function
    speak_match = re.search(r'\nfunction speakSentence\([^)]*\)\s*\{.*?\n\}', html, re.DOTALL)
    speak_fn = speak_match.group(0) + '\n' if speak_match else '\n'

    # Find and replace entire <script>...</script> block
    script_start = html.find('<script>')
    script_end = html.find('</script>', script_start) + len('</script>')
    if script_start == -1 or script_end == -1:
        print('  WARN %s: no <script> block found' % fname)
        return

    new_script = '<script>\n' + qd_block + speak_fn + '\n' + NEW_JS + '</script>'
    html = html[:script_start] + new_script + html[script_end:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('  OK   ' + fname)


print('Restructuring B2 modules to module5 pattern...')
for fname in B2_FILES:
    print('     ' + fname)
    process(fname)
print('Done!')
