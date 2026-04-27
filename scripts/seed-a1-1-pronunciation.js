/**
 * One-off: backfill A1-1 (Pronunciation) content_json by hand.
 *
 * The source file module0-pronunciation.html uses a JS lessonData array of
 * arrow-function templates instead of the standard lesson-pane DOM, so the
 * generic migrate-content.js extractor can't parse it. The content below
 * mirrors lessonData[0..3] from that file faithfully — no invention.
 *
 * IS NULL guard preserves any future manual edits if I run this twice.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const lessons = {
  // ─────────────────────────────────────────────────────────────────────
  1: {
    title: 'German is Phonetic',
    blocks: [
      { type: 'intro',   content: 'German is phonetic — and that is the best news you will hear today. Think about English spelling: "tough" /tʌf/, "through" /θruː/, "thought" /θɔːt/ — three almost identical letter patterns, three completely different sounds.' },
      { type: 'text',    content: 'German does not do this. In German, every letter has one sound and that sound is always the same. Once you learn the system — which takes about two hours — you can read any German word correctly, even words you have never seen.' },
      { type: 'tip',     content: 'This is why Module 0 exists before grammar. A student who understands German sounds will recognise words in the Goethe Hören (listening) section even when spoken fast. A student who skipped this module will hear a blur.' },
      { type: 'text',    content: 'The 5 letters that sound different from English. Most German letters sound exactly like their English equivalents. These five do not.' },
      { type: 'table',
        headers: ['Letter', 'Sounds like', 'Example', 'Phonetic'],
        rows: [
          ['W',  'English V (not W)',  'Wasser',  'VAH-ser = water'],
          ['V',  'English F (not V)',  'Vater',   'FAH-ter = father'],
          ['Z',  'English TS in "bits"', 'Zeit',  'TSAIT = time'],
          ['J',  'English Y in "yes"', 'Jahr',    'YAHR = year'],
          ['S',  'English Z (before vowel)', 'See', 'ZEH = lake / sea'],
          ['ß',  'Double S (like "ss" in "boss")', 'Straße', 'SHTRAH-se = street']
        ]
      },
      { type: 'audio',   text: 'Wasser, Vater, Zeit, Jahr, See, Straße' },
      { type: 'infobox', content: 'Goethe tip: in the Hören section, words with W and V are often confused by learners because English trained your ear the opposite way. The German word "Wasser" sounds like "Vasser" — the examiner will use it. Your ear needs to know this.' },
      { type: 'text',    content: 'Read aloud — applying the 5 rules. Apply what you just learned. Read each word aloud using the phonetic guide. Accuracy before speed.' },
      { type: 'table',
        headers: ['German', 'Pronounce', 'Meaning', 'Rule'],
        rows: [
          ['Wohnung',  'VOH-nung',  'apartment', 'W → V'],
          ['Vater',    'FAH-ter',   'father',    'V → F'],
          ['Zeit',     'TSAIT',     'time',      'Z → TS'],
          ['ja',       'YAH',       'yes',       'J → Y'],
          ['Sommer',   'ZO-mer',    'summer',    'S before vowel → Z'],
          ['zwei',     'TSVAI',     'two',       'Z → TS, W → V'],
          ['Straße',   'SHTRAH-se', 'street',    'ß → SS'],
          ['Wasser',   'VAH-ser',   'water',     'W → V']
        ]
      },
      { type: 'audio',   text: 'Wohnung, Vater, Zeit, ja, Sommer, zwei, Straße, Wasser' }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  2: {
    title: 'Vowels, Length & Umlauts',
    blocks: [
      { type: 'intro',   content: 'German vowels have two versions: short and long. The difference is not just pronunciation — it changes the meaning of the word entirely. This is called a minimal pair: two words that sound almost identical but have one different sound and completely different meanings.' },
      { type: 'table',
        headers: ['Short', 'Pronunciation', 'Meaning', 'Long', 'Pronunciation', 'Meaning'],
        rows: [
          ['Bett',  'BET (short e)',     'bed',   'Beet',  'BEHT (long e)',     'flower bed'],
          ['Stadt', 'SHTAT (short a)',   'city',  'Staat', 'SHTAHT (long a)',   'state / country'],
          ['offen', 'OF-fen (short o)',  'open',  'Ofen',  'OH-fen (long o)',   'oven'],
          ['Kamm',  'KAM (short a)',     'comb',  'kam',   'KAHM (long a)',     'came (verb)']
        ]
      },
      { type: 'audio',   text: 'Bett, Beet, Stadt, Staat, offen, Ofen, Kamm, kam' },
      { type: 'infobox', content: 'How to know if a vowel is long or short: if the vowel is followed by a double consonant (nn, tt, mm, ff) it is almost always short. If it is followed by a single consonant or an H (Ofen, Jahr, Beet) it is usually long. This covers about 80% of cases.' },
      { type: 'text',    content: 'ä, ö, ü — the three sounds English doesn\'t have. These three letters — called Umlauts — are unique to German. Many learners replace them with the nearest English sound, which sounds non-native and costs marks in Sprechen.' },
      { type: 'text',    content: 'The Ä sound. Closest English equivalent: the "ai" in "air" — but without the R. Open your mouth as if to say English "A" (as in "cat"). Say "Männer" (men) = MEN-er, not MAHN-er.' },
      { type: 'example', german: 'Männer, Bäcker, Städte, spät', english: 'men, baker, cities, late' },
      { type: 'audio',   text: 'Männer, Bäcker, Städte, spät' },
      { type: 'text',    content: 'The Ö sound. No direct English equivalent — between "uh" and "er". Say English "E" (as in "see"), keep your tongue in that position, then round your lips as if about to whistle.' },
      { type: 'example', german: 'hören, schön, Öl, möchten', english: 'to hear, beautiful, oil, would like' },
      { type: 'audio',   text: 'hören, schön, Öl, möchten' },
      { type: 'text',    content: 'The Ü sound. Like the French "u". Say English "see" — lips spread wide. Keep your tongue there but round your lips forward as if blowing out a candle.' },
      { type: 'example', german: 'über, fünf, Tür, müde', english: 'above / over, five, door, tired' },
      { type: 'audio',   text: 'über, fünf, Tür, müde' },
      { type: 'text',    content: 'Practise the Umlauts. These sentences use all three umlauts — read them aloud slowly, focusing on the correct lip position.' },
      { type: 'example', german: 'Ich möchte fünf Türen öffnen.', english: 'I would like to open five doors.' },
      { type: 'audio',   text: 'Ich möchte fünf Türen öffnen.' },
      { type: 'example', german: 'Die Männer hören schöne Musik.', english: 'The men hear beautiful music.' },
      { type: 'audio',   text: 'Die Männer hören schöne Musik.' },
      { type: 'example', german: 'Ich bin müde, aber ich stehe früh auf.', english: 'I am tired but I get up early.' },
      { type: 'audio',   text: 'Ich bin müde, aber ich stehe früh auf.' },
      { type: 'example', german: 'Über dem Haus ist ein schöner Mond.', english: 'Above the house is a beautiful moon.' },
      { type: 'audio',   text: 'Über dem Haus ist ein schöner Mond.' }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  3: {
    title: 'Consonant Combinations',
    blocks: [
      { type: 'intro',   content: 'CH is the consonant that trips up almost every learner. It is not a sound that exists in English, so your mouth has no memory for it. CH has two different sounds depending on what comes before it.' },
      { type: 'text',    content: 'CH after A, O, U, AU → Hard CH. Made at the back of the throat — like clearing your throat softly, or the Scottish "loch", or the Arabic "kh" in "Khalid". Place the back of your tongue against your soft palate and push air through.' },
      { type: 'example', german: 'Bach, Buch, Nacht, auch', english: 'bah-CH = stream, boo-CH = book, nah-CHT = night, ou-CH = also' },
      { type: 'audio',   text: 'Bach, Buch, Nacht, auch' },
      { type: 'text',    content: 'CH after E, I, Ä, Ö, Ü, EI → Soft CH. Made further forward in the mouth — like an exaggerated English H, or a soft hiss. This is the "ich" sound: the word for "I" in every sentence you produce.' },
      { type: 'example', german: 'ich, nicht, Milch, Mädchen', english: 'iH-CH = I, niHt = not, mil-CH = milk, MEHT-chen = girl' },
      { type: 'audio',   text: 'ich, nicht, Milch, Mädchen' },
      { type: 'infobox', content: 'Why this matters for Goethe: the word "ich" (I) appears in nearly every sentence you produce in the Sprechen section. If you say it with a K sound ("ik") or an SH sound ("ish"), trained examiners notice immediately.' },
      { type: 'text',    content: 'SP, ST, SCH — the combinations that hide their sound.' },
      { type: 'text',    content: 'SP at the start of a word = SHP. The S becomes SH before P at the beginning.' },
      { type: 'example', german: 'sprechen, Spaß, Sport, spät', english: 'SHP-rechen = to speak, SHPASS = fun, SHPORT = sport, SHPAYT = late' },
      { type: 'audio',   text: 'sprechen, Spaß, Sport, spät' },
      { type: 'text',    content: 'ST at the start of a word = SHT. Same rule: S becomes SH before T.' },
      { type: 'example', german: 'Stadt, stehen, Straße, studieren', english: 'SHTAT = city, SHTE-hen = to stand, SHTRAH-se = street, shtu-DEE-ren = to study' },
      { type: 'audio',   text: 'Stadt, stehen, Straße, studieren' },
      { type: 'text',    content: 'SCH always = SH (as in "ship"). Consistent — no exceptions.' },
      { type: 'example', german: 'schön, Schule, schwer, schreiben', english: 'SHÖN = beautiful, SHOO-le = school, SHVAYR = difficult, SHRAI-ben = to write' },
      { type: 'audio',   text: 'schön, Schule, schwer, schreiben' },
      { type: 'text',    content: 'Read aloud — all consonant rules combined.' },
      { type: 'example', german: 'Ich spreche ein bisschen Deutsch.', english: 'I speak a little German. (CH × 2, SP)' },
      { type: 'audio',   text: 'Ich spreche ein bisschen Deutsch.' },
      { type: 'example', german: 'Die Schule ist in der Stadt.', english: 'The school is in the city. (SCH, ST)' },
      { type: 'audio',   text: 'Die Schule ist in der Stadt.' },
      { type: 'example', german: 'Das Buch ist nicht schwer.', english: 'The book is not difficult. (CH × 2, SCH)' },
      { type: 'audio',   text: 'Das Buch ist nicht schwer.' },
      { type: 'example', german: 'Ich studiere Sprachen in Köln.', english: 'I study languages in Cologne. (ST, SP, CH)' },
      { type: 'audio',   text: 'Ich studiere Sprachen in Köln.' },
      { type: 'example', german: 'Er spricht schön und deutlich.', english: 'He speaks beautifully and clearly. (SP, SCH, CH)' },
      { type: 'audio',   text: 'Er spricht schön und deutlich.' }
    ]
  },

  // ─────────────────────────────────────────────────────────────────────
  4: {
    title: 'Rhythm, Stress & Sounding Natural',
    blocks: [
      { type: 'intro',   content: 'Every language has a rhythm. German is a stress-timed language — like English. Some syllables are strong and long; others are weak and short. A student who speaks German with equal stress on every syllable sounds robotic. The examiner hears it immediately in the Sprechen section.' },
      { type: 'text',    content: 'Rule 1: Most German words — stress the first syllable.' },
      { type: 'example', german: 'KOM-men, AR-beit, WOH-nung, LER-nen', english: 'to come, work, apartment, to learn' },
      { type: 'audio',   text: 'kommen, Arbeit, Wohnung, lernen' },
      { type: 'text',    content: 'Rule 2: Compound nouns — stress the FIRST part, always. German loves combining words into long compound nouns. Always stress the first element.' },
      { type: 'example', german: 'KRANKEN-haus, HAUS-aufgabe, BAHN-hof, ARZT-praxis', english: 'hospital, homework, train station, doctor\'s practice' },
      { type: 'audio',   text: 'Krankenhaus, Hausaufgabe, Bahnhof, Arztpraxis' },
      { type: 'text',    content: 'Rule 3: Separable verbs — stress the PREFIX. Verbs like aufstehen, einkaufen, anrufen always stress the first part even when it splits to the end of the sentence.' },
      { type: 'example', german: 'AUF-stehen, EIN-kaufen, AN-rufen, MIT-kommen', english: 'to get up, to shop, to call, to come along' },
      { type: 'audio',   text: 'aufstehen, einkaufen, anrufen, mitkommen' },
      { type: 'text',    content: 'Function words — the quiet glue of German sentences. Content words (nouns, main verbs, adjectives) are stressed and clear. Function words (articles, prepositions, conjunctions) are spoken quickly and reduced. This rhythm is what separates natural German from robotic German.' },
      { type: 'example', german: 'Ich WOHN-e in NAI-ro-bi.', english: 'I live in Nairobi. (ich and in are reduced; wohne and Nairobi carry full stress)' },
      { type: 'example', german: 'Der MANN trinkt KAFFEE.', english: 'The man drinks coffee. (Der is reduced; Mann and Kaffee are stressed)' },
      { type: 'example', german: 'Ich MÖCHte nach DEUTSCH-land FAHR-en.', english: 'I would like to travel to Germany. (möchte, Deutschland, fahren get the stress)' },
      { type: 'infobox', content: 'Practical tip for Goethe listening: in the Hören section, audio is recorded with natural German rhythm. If you are listening for every word equally, you will miss things. Train yourself to listen for the stressed words — those carry the meaning.' },
      { type: 'text',    content: 'Your Goethe introduction — with stress and rhythm marked. Capitalised syllables are stressed; lower-case syllables are reduced. Read it aloud until the rhythm feels natural — not words, but music.' },
      { type: 'example', german: 'HAL-lo, ich HEI-ße [Ihr Name].', english: 'Hello, my name is [Your Name]. — Stress: Hallo, heißen. "ich" is quiet.' },
      { type: 'audio',   text: 'Hallo, ich heiße Amina.' },
      { type: 'example', german: 'Ich KOM-me aus KE-ni-a, aus NAI-ro-bi.', english: 'I come from Kenya, from Nairobi. — Stress: komme, Kenia, Nairobi. "aus" is quiet.' },
      { type: 'audio',   text: 'Ich komme aus Kenia, aus Nairobi.' },
      { type: 'example', german: 'Ich BIN KRAN-ken-schwes-ter von BE-ruf.', english: 'I am a nurse by profession. — Stress: bin, KRANKen-, Beruf.' },
      { type: 'audio',   text: 'Ich bin Krankenschwester von Beruf.' },
      { type: 'example', german: 'Ich LER-ne DEUTSCH, weil ich in DEUTSCH-land ar-BEI-ten MÖCH-te.', english: 'I am learning German because I want to work in Germany. — Stress: lerne, Deutsch, Deutschland, arbeiten, möchte.' },
      { type: 'audio',   text: 'Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.' },
      { type: 'example', german: 'Ich WOHN-e jetzt in NAI-ro-bi, aber ich MÖCH-te bald nach DEUTSCH-land ZIE-hen.', english: 'I currently live in Nairobi but I would like to move to Germany soon.' },
      { type: 'audio',   text: 'Ich wohne jetzt in Nairobi, aber ich möchte bald nach Deutschland ziehen.' }
    ]
  }
};

(async () => {
  const mod = await sb.from('modules').select('id, title').eq('level', 'A1').eq('order_index', 1).single();
  console.log('Module: ' + mod.data.title + ' (' + mod.data.id + ')');
  console.log('');

  for (const order of [1, 2, 3, 4]) {
    const { title, blocks } = lessons[order];
    const ls = await sb.from('lessons').select('id, title').eq('module_id', mod.data.id).eq('order_index', order).single();
    if (!ls.data) { console.error('  · Lesson ' + order + ' not found'); continue; }

    // IS NULL guard — preserve any future manual edits
    const upd = await sb.from('lessons')
      .update({ content_json: blocks, title: title })
      .eq('id', ls.data.id)
      .is('content_json', null)
      .select('id, content_json');
    if (upd.error) { console.error('  · UPDATE error: ' + upd.error.message); continue; }

    if (upd.data && upd.data.length > 0) {
      const counts = {};
      blocks.forEach((b) => { counts[b.type] = (counts[b.type] || 0) + 1; });
      const summary = Object.keys(counts).sort().map((k) => k + ':' + counts[k]).join(' · ');
      console.log('Lesson ' + order + ' "' + title + '": wrote ' + blocks.length + ' blocks (' + summary + ')');
    } else {
      console.log('Lesson ' + order + ' "' + title + '": already had content_json — skipped (IS NULL guard)');
    }
  }

  console.log('');
  const head = { count: 'exact', head: true };
  const { count: nul } = await sb.from('lessons').select('*', head).is('content_json', null);
  const { count: pop } = await sb.from('lessons').select('*', head).not('content_json', 'is', null);
  console.log('DB final state: ' + pop + ' populated · ' + nul + ' NULL');
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
