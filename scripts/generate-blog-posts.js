/**
 * One-shot generator: writes the 7 pathway blog posts to the project root.
 * Each post follows the same shell so styling stays consistent. Body copy
 * is copied verbatim from the source draft the user supplied — only the
 * surrounding chrome (header, navbar, footer, theme styling) is added.
 *
 * Re-running this script overwrites the 7 files. Safe to delete after the
 * initial generation, but keeping it makes future content updates easy.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const POSTS = [
  {
    slug:        'family-reunification',
    category:    'Family Reunification',
    levels:      [['a1', 'A1']],
    levelTag:    'Goethe A1 Required',
    h1:          'How to Come to Germany for Family Reunification — What German Level Do You Need?',
    metaDesc:    'Family reunification visa for Germany — Goethe A1 is the entry-level requirement. Here\'s what to expect, exceptions, and how to prepare.',
    lead:        'If your spouse, parent, or child lives in Germany, you may be eligible to join them through family reunification — one of the most common pathways to Germany from Africa.',
    sections: [
      { title: 'What is family reunification?', body:
        '<p>Family reunification (Familienzusammenführung) allows non-EU citizens to move to Germany to live with a close family member who has legal residence there. This applies to spouses, minor children, and in some cases parents of German citizens.</p>'
      },
      { title: 'What German level do you need?', body:
        '<p>For spousal reunification, you need to prove basic German language skills before arriving in Germany. The minimum requirement is <strong>Goethe A1</strong> — the entry level. You must pass the Goethe-Zertifikat A1: Start Deutsch 1 exam at a Goethe Institut in your home country.</p>' +
        '<p>The A1 exam tests simple everyday communication — greetings, numbers, basic questions. It is designed for complete beginners.</p>'
      },
      { title: 'Exceptions to the language requirement', body:
        '<ul>' +
        '<li>If your spouse is an EU Blue Card holder</li>' +
        '<li>If you hold a university degree from a German-speaking country</li>' +
        '<li>If you can prove it was impossible to learn German before arrival</li>' +
        '<li>Children under 16 joining parents do not need A1</li>' +
        '</ul>'
      },
      { title: 'Steps to apply', body:
        '<ul>' +
        '<li>Register at your local Goethe Institut for the A1 exam</li>' +
        '<li>Pass the exam and receive your certificate</li>' +
        '<li>Apply for a family reunification visa at the German embassy</li>' +
        '<li>Submit your Goethe certificate with your visa application</li>' +
        '<li>After arrival, enrol in an integration course to reach B1</li>' +
        '</ul>'
      },
      { title: 'How long does A1 take to prepare?', body:
        '<p>With focused daily practice, most people reach A1 level in 4 to 8 weeks. DeutschWeg\'s A1 modules cover exactly what the Goethe A1 exam tests — pronunciation, numbers, greetings, basic grammar, and simple conversations.</p>'
      }
    ],
    cta: 'Ready to start? DeutschWeg covers the complete Goethe A1 curriculum. Start free — no credit card needed.'
  },

  {
    slug:        'au-pair',
    category:    'Au-Pair Programme',
    levels:      [['a1', 'A1'], ['a2', 'A2']],
    levelTag:    'Goethe A1 minimum — A2 recommended',
    h1:          'Coming to Germany as an Au-Pair — Language Requirements and How to Prepare',
    metaDesc:    'The Au-Pair programme is an accessible route to Germany for young Africans. A1 is the minimum, A2 makes your application stronger.',
    lead:        'The Au-Pair programme is one of the most accessible ways for young Africans to live and work in Germany legally. But language preparation is essential — and starting early gives you a major advantage.',
    sections: [
      { title: 'What is an Au-Pair?', body:
        '<p>An Au-Pair lives with a German host family, helps with childcare and light household tasks, and in return receives accommodation, meals, pocket money, and time to attend German language classes. It is a cultural exchange programme, not employment.</p>'
      },
      { title: 'Who can apply?', body:
        '<ul>' +
        '<li>Age 18 to 26 (some agencies accept up to 27)</li>' +
        '<li>No criminal record</li>' +
        '<li>Basic German language skills</li>' +
        '<li>Interest in childcare and cultural exchange</li>' +
        '</ul>'
      },
      { title: 'What German level do you need?', body:
        '<p>There is no strict legal minimum, but most reputable Au-Pair agencies and host families require at least <strong>A1</strong>. Having <strong>A2</strong> makes your application significantly stronger and helps you settle in much faster.</p>' +
        '<p>You will also be required to attend German language classes during your stay — usually at a local Volkshochschule (VHS). Many Au-Pairs progress from A1 to B1 during their stay.</p>'
      },
      { title: 'How to find a host family', body:
        '<ul>' +
        '<li>Au-Pair agencies (AuPairWorld, Cultural Care, IJAB)</li>' +
        '<li>Direct applications through family networks</li>' +
        '<li>German embassy Au-Pair visa programme</li>' +
        '</ul>'
      },
      { title: 'How long does A1/A2 take to prepare?', body:
        '<p>A1 takes 4 to 8 weeks of daily practice. A2 takes an additional 6 to 10 weeks. Starting your German now — before you even find a host family — puts you ahead of most applicants.</p>'
      }
    ],
    cta: 'DeutschWeg covers A1 and A2 completely — built for the Goethe exam. Start free today.'
  },

  {
    slug:        'ausbildung',
    category:    'Vocational Training',
    levels:      [['b1', 'B1']],
    levelTag:    'Goethe B1 Required',
    h1:          'Ausbildung in Germany — How Africans Can Apply and What German Level is Required',
    metaDesc:    'Germany\'s Ausbildung (dual vocational training) is open to Africans. B1 German is the standard entry requirement — here\'s the full pathway.',
    lead:        'Germany\'s Ausbildung (dual vocational training) system is one of the best in the world — and it is now open to applicants from Africa. You work, earn a salary, and gain a recognised German qualification at the same time.',
    sections: [
      { title: 'What is Ausbildung?', body:
        '<p>Ausbildung is a vocational training programme lasting 2 to 3.5 years. You split your time between a company (where you work and earn) and a Berufsschule (vocational school). Popular fields include nursing, IT, logistics, hospitality, and engineering.</p>'
      },
      { title: 'What German level do you need?', body:
        '<p>Most Ausbildung programmes require <strong>Goethe B1</strong> minimum. Some competitive programmes or larger companies require B2. The language requirement exists because your training happens in German — classes, workplace communication, exams — all in German.</p>'
      },
      { title: 'The Western Balkans Regulation — and what it means for Africans', body:
        '<p>Germany introduced the Chancenkarte (Opportunity Card) in 2024, which makes it easier for skilled workers and Ausbildung applicants from non-EU countries to come to Germany. This includes African applicants with recognised qualifications.</p>'
      },
      { title: 'Steps to apply for Ausbildung', body:
        '<ul>' +
        '<li>Reach B1 German level and pass the Goethe B1 exam</li>' +
        '<li>Have your school certificates evaluated (anabin database)</li>' +
        '<li>Apply directly to companies in Germany or through the Bundesagentur für Arbeit</li>' +
        '<li>Get an Ausbildung contract before applying for the visa</li>' +
        '<li>Apply for an Ausbildungsvisum at the German embassy</li>' +
        '</ul>'
      },
      { title: 'Realistic timeline', body:
        '<p>From A1 to B1 takes most people 6 to 12 months of consistent daily study. Starting now means you could be applying for Ausbildung positions within a year.</p>'
      }
    ],
    cta: 'DeutschWeg prepares you for Goethe A1 through B1 — exactly what Ausbildung requires. Start free.'
  },

  {
    slug:        'university-studies',
    category:    'University Studies',
    levels:      [['b2', 'B2']],
    levelTag:    'Goethe B2 / C1 Required',
    h1:          'Studying at a German University — Language Requirements for African Students',
    metaDesc:    'German universities require B2 or C1 German for degree programmes taught in German. Here\'s the full pathway for African students.',
    lead:        'Germany has some of the best universities in the world — and many charge no tuition fees, even for international students. But getting in requires strong German language skills.',
    sections: [
      { title: 'What German level do universities require?', body:
        '<p>Most degree programmes taught in German require <strong>B2 or C1</strong>. The specific requirement depends on the university and programme. Engineering at TU Munich may require C1, while some applied sciences programmes accept B2.</p>' +
        '<p>For English-taught programmes, you do not need German — but German language skills will significantly improve your life in Germany.</p>'
      },
      { title: 'Which certificate is accepted?', body:
        '<ul>' +
        '<li>Goethe-Zertifikat B2 or C1</li>' +
        '<li>TestDaF (Test Deutsch als Fremdsprache) — TDN 4 equivalent to C1</li>' +
        '<li>DSH (Deutsche Sprachprüfung für den Hochschulzugang)</li>' +
        '<li>telc Deutsch B2/C1 Hochschule</li>' +
        '</ul>'
      },
      { title: 'Pathway for African students', body:
        '<ul>' +
        '<li>Complete your secondary school or university at home</li>' +
        '<li>Have your certificates evaluated by uni-assist or anabin</li>' +
        '<li>Reach B2/C1 German and pass the required exam</li>' +
        '<li>Apply through uni-assist or directly to the university</li>' +
        '<li>Apply for a student visa (Studentenvisum)</li>' +
        '<li>You may need to attend a Studienkolleg (foundation year) first</li>' +
        '</ul>'
      },
      { title: 'Realistic timeline', body:
        '<p>From zero to B2 takes 12 to 18 months of focused daily study. Start with A1, work through A2 and B1, then tackle B2. DeutschWeg covers A1 through B2 completely.</p>'
      }
    ],
    cta: 'Start your university journey today. DeutschWeg takes you from A1 to B2 — the complete Goethe curriculum.'
  },

  {
    slug:        'einbuergerung',
    category:    'German Citizenship',
    levels:      [['b1', 'B1']],
    levelTag:    'Goethe B1 Required',
    h1:          'Applying for German Citizenship (Einbürgerung) — Language Requirements Explained',
    metaDesc:    'Germany\'s 2024 citizenship reform made Einbürgerung faster. B1 German is required — here\'s what counts as proof and what else you need.',
    lead:        'Germany reformed its citizenship law in 2024, making Einbürgerung faster and more accessible. If you have been living in Germany legally, B1 German is one of the key requirements for your application.',
    sections: [
      { title: 'New citizenship rules from 2024', body:
        '<ul>' +
        '<li>Citizenship after 5 years of legal residence (reduced from 8)</li>' +
        '<li>Dual citizenship now allowed — you do not have to give up your Kenyan/Nigerian/Ghanaian passport</li>' +
        '<li>Special cases: 3 years for exceptional integration</li>' +
        '<li>B1 German language minimum — must be demonstrated</li>' +
        '</ul>'
      },
      { title: 'What counts as proof of B1?', body:
        '<ul>' +
        '<li>Goethe-Zertifikat B1</li>' +
        '<li>telc Deutsch B1</li>' +
        '<li>Completion of an integration course (reaches B1)</li>' +
        '<li>German secondary school certificate</li>' +
        '</ul>'
      },
      { title: 'Other Einbürgerung requirements', body:
        '<ul>' +
        '<li>5+ years of legal residence in Germany</li>' +
        '<li>Financial self-sufficiency (no Bürgergeld/social welfare)</li>' +
        '<li>No serious criminal record</li>' +
        '<li>Commitment to Germany\'s democratic values</li>' +
        '<li>Passing the Einbürgerungstest (citizenship knowledge test)</li>' +
        '</ul>'
      }
    ],
    cta: 'B1 is the gateway to German citizenship. DeutschWeg prepares you for the Goethe B1 exam. Start free.'
  },

  {
    slug:        'skilled-worker-visa',
    category:    'Skilled Worker Visa',
    levels:      [['b1', 'B1'], ['b2', 'B2']],
    levelTag:    'B1 minimum — B2 recommended',
    h1:          'Germany\'s Skilled Worker Visa (Fachkräfteeinwanderung) — What African Professionals Need to Know',
    metaDesc:    'Germany\'s skilled worker visa and Chancenkarte make moving easier than ever. B1 minimum, B2 recommended — here\'s the full picture.',
    lead:        'Germany is actively recruiting skilled workers from outside the EU — including from Africa. The Fachkräfteeinwanderungsgesetz (Skilled Immigration Act) and the new Chancenkarte (Opportunity Card) have made this easier than ever.',
    sections: [
      { title: 'Who qualifies?', body:
        '<ul>' +
        '<li>University graduates in shortage professions (IT, engineering, healthcare, trades)</li>' +
        '<li>Vocational workers with recognised qualifications</li>' +
        '<li>Experienced professionals even without formal degree recognition</li>' +
        '</ul>'
      },
      { title: 'Language requirements', body:
        '<p>For most skilled worker visas, <strong>B1</strong> is the minimum. Healthcare workers (nurses, doctors) typically need <strong>B2</strong> because patient communication is critical. IT workers in English-speaking companies sometimes get away with A2, but B1 is strongly recommended for daily life.</p>'
      },
      { title: 'The Chancenkarte (Opportunity Card)', body:
        '<p>Introduced in 2024, the Chancenkarte allows you to come to Germany for up to one year to look for work — without a job offer first. Requirements include a recognised qualification, language skills, and a points-based system. German language skills earn you extra points.</p>'
      },
      { title: 'Getting your qualification recognised', body:
        '<ul>' +
        '<li>Use the anabin database to check if your degree is recognised</li>' +
        '<li>Apply through the Recognition Advisory Centre (BQ Portal)</li>' +
        '<li>Healthcare workers need Berufsanerkennung from the relevant Landesbehörde</li>' +
        '</ul>'
      }
    ],
    cta: 'B1 opens Germany\'s job market to you. Start preparing for your Goethe exam on DeutschWeg.'
  },

  {
    slug:        'integration-course',
    category:    'Integration Course',
    levels:      [['b1', 'A1 → B1']],
    levelTag:    'Takes you from A1 to B1',
    h1:          'Germany\'s Integration Course — What It Is and How to Prepare Before You Arrive',
    metaDesc:    'The Integrationskurs takes you from A1 to B1 in Germany. Preparing before you arrive gives you a major advantage — here\'s how it works.',
    lead:        'If you are moving to Germany, you will likely be required — or strongly encouraged — to complete an integration course. Understanding what it involves helps you prepare before you even arrive.',
    sections: [
      { title: 'What is the integration course?', body:
        '<p>The Integrationskurs is a government-funded language and civics programme. It consists of two parts: a German language course (600 lessons from A1 to B1) and an orientation course (100 lessons covering German society, law, and history).</p>'
      },
      { title: 'Who must attend?', body:
        '<ul>' +
        '<li>New arrivals with a residence permit who cannot prove B1 German</li>' +
        '<li>Those who receive social welfare benefits</li>' +
        '<li>Anyone referred by the Ausländerbehörde (immigration office)</li>' +
        '</ul>'
      },
      { title: 'Who can attend voluntarily?', body:
        '<p>Even if not required, you can apply to attend the integration course. It is heavily subsidised — you pay only €1.20 per lesson, and the cost can be waived if you receive social support.</p>'
      },
      { title: 'The final exam — DTZ', body:
        '<p>The integration course ends with the Deutsch-Test für Zuwanderer (DTZ), which tests B1 level. Passing this exam is required to receive your Integrationskurs certificate — which is needed for many residence permits and Einbürgerung.</p>'
      },
      { title: 'Why prepare before you arrive?', body:
        '<p>Starting German before you arrive in Germany gives you a massive advantage. Students who arrive with A1 or A2 progress through the integration course faster, perform better in the DTZ, and settle into German life more quickly.</p>'
      }
    ],
    cta: 'Prepare for Germany before you arrive. DeutschWeg covers A1 through B1 — exactly the integration course curriculum. Start free.'
  }
];

// Render one post's level pills (e.g. A1, A1+A2)
function renderLevels(levels) {
  return levels.map(([k, label]) => `<span class="pw-pill ${k}">${label}</span>`).join(' ');
}

function renderSections(sections) {
  return sections.map(s =>
    `    <h2>${s.title}</h2>\n    ${s.body}`
  ).join('\n\n');
}

function renderPage(post) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${post.h1.replace(/—.*$/, '').trim()} — DeutschWeg</title>
<meta name="description" content="${post.metaDesc}">
<link rel="stylesheet" href="deutschweg-theme.css">
<style>
  body { background: var(--bg); }
  .post-header {
    background: #fff; border-bottom: 1px solid var(--border);
    padding: 14px 24px; display: flex; align-items: center; gap: 14px;
    position: sticky; top: 0; z-index: 50;
  }
  .post-back {
    color: var(--mid); font-size: 13px; font-weight: 600;
    text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 8px; transition: all .18s;
  }
  .post-back:hover { color: var(--blue); background: var(--blue-light); }
  .post-logo {
    display: flex; align-items: center; gap: 9px; text-decoration: none;
    margin-left: auto;
  }
  .post-logo-icon {
    width: 30px; height: 30px; background: var(--blue); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 15px; font-weight: 800;
  }
  .post-logo-text { font-size: 16px; font-weight: 800; color: var(--dark); letter-spacing: -0.3px; }
  .post-logo-text span { color: var(--blue); }

  .post-wrap { max-width: 760px; margin: 0 auto; padding: 36px 20px 80px; }
  .post-cat {
    font-size: 11px; font-weight: 700; letter-spacing: 2px;
    color: var(--blue); text-transform: uppercase; margin-bottom: 12px;
  }
  .post-title {
    font-size: 30px; font-weight: 800; color: var(--dark);
    letter-spacing: -0.5px; margin-bottom: 14px; line-height: 1.25;
  }
  .post-level-tag {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--blue-light); color: #1D4ED8;
    border: 1px solid var(--blue-mid);
    border-radius: 50px; padding: 5px 14px;
    font-size: 12.5px; font-weight: 700;
    margin-bottom: 22px;
  }
  .post-lead { font-size: 16px; color: var(--mid); line-height: 1.75; margin-bottom: 28px; }

  .post-card {
    background: #fff; border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 36px 32px;
    box-shadow: var(--shadow-sm);
  }
  .post-card h2 {
    font-size: 13px; font-weight: 800; letter-spacing: 1.2px;
    color: var(--blue); text-transform: uppercase;
    margin: 28px 0 10px;
  }
  .post-card h2:first-child { margin-top: 0; }
  .post-card p, .post-card li { font-size: 15px; color: var(--mid); line-height: 1.75; }
  .post-card p { margin-bottom: 12px; }
  .post-card ul, .post-card ol { margin: 0 0 14px 22px; }
  .post-card li { margin-bottom: 6px; }
  .post-card strong { color: var(--dark); font-weight: 700; }
  .post-card a { color: var(--blue); text-decoration: underline; }
  .post-card a:hover { color: var(--blue-dark); }

  .post-cta {
    background: var(--blue-light); border-left: 4px solid var(--blue);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    padding: 18px 22px; margin-top: 28px;
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    flex-wrap: wrap;
  }
  .post-cta-text { font-size: 14.5px; color: #1E3A5F; font-weight: 600; line-height: 1.55; flex: 1; min-width: 200px; }
  .post-cta-btn {
    background: var(--blue); color: #fff; padding: 10px 20px;
    border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 700;
    box-shadow: 0 2px 8px rgba(59,130,246,0.3); white-space: nowrap;
    transition: all .18s;
  }
  .post-cta-btn:hover { background: var(--blue-dark); transform: translateY(-1px); }

  .pw-pill {
    display: inline-flex; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
    padding: 2px 9px; border-radius: 50px;
  }
  .pw-pill.a1 { background: #ECFDF5; color: #059669; }
  .pw-pill.a2 { background: #EFF6FF; color: #1D4ED8; }
  .pw-pill.b1 { background: #FFFBEB; color: #92400E; }
  .pw-pill.b2 { background: #F5F3FF; color: #5B21B6; }

  .post-related { margin-top: 28px; font-size: 14px; color: var(--mid); text-align: center; }
  .post-related a { color: var(--blue); text-decoration: none; font-weight: 600; }
  .post-related a:hover { text-decoration: underline; }

  .post-footer {
    margin-top: 28px; text-align: center;
    font-size: 13px; color: var(--light);
  }
  .post-footer a { color: var(--mid); text-decoration: none; margin: 0 10px; }
  .post-footer a:hover { color: var(--blue); }

  @media (max-width: 600px) {
    .post-wrap { padding: 22px 14px 80px; }
    .post-card { padding: 24px 20px; }
    .post-title { font-size: 24px; }
    .post-cta { flex-direction: column; align-items: stretch; }
    .post-cta-btn { text-align: center; }
  }
</style>
</head>
<body>

<header class="post-header">
  <a href="blog.html" class="post-back">← All posts</a>
  <a href="index.html" class="post-logo">
    <div class="post-logo-icon">D</div>
    <span class="post-logo-text">Deutsch<span>Weg</span></span>
  </a>
</header>

<main class="post-wrap">
  <div class="post-cat">${post.category}</div>
  <h1 class="post-title">${post.h1}</h1>
  <div class="post-level-tag">${renderLevels(post.levels)} ${post.levelTag}</div>
  <p class="post-lead">${post.lead}</p>

  <article class="post-card">
${renderSections(post.sections)}

    <div class="post-cta">
      <div class="post-cta-text">${post.cta}</div>
      <a class="post-cta-btn" href="signup.html">Start free →</a>
    </div>
  </article>

  <div class="post-related">
    Read more pathway guides → <a href="blog.html">All seven posts</a>
  </div>

  <div class="post-footer">
    <a href="privacy-policy.html">Privacy</a> ·
    <a href="terms.html">Terms</a> ·
    <a href="impressum.html">Impressum</a>
  </div>
</main>

<script src="./cookie-banner.js"></script>
</body>
</html>
`;
}

let written = 0;
for (const post of POSTS) {
  const filename = `blog-${post.slug}.html`;
  const filepath = path.join(ROOT, filename);
  fs.writeFileSync(filepath, renderPage(post), 'utf8');
  written++;
  console.log('  + ' + filename);
}
console.log('\nWrote ' + written + ' blog post(s).');
