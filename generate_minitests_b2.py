#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate mini-test-b2-1.html through mini-test-b2-14.html
and patch deutschweg-prototype.html with Quick Test buttons.
Also adds .mt-quick-btn.b2 CSS to deutschweg-theme.css.
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

# ── Module metadata ────────────────────────────────────────────────────────────
MODULES = [
  (1,  "konjunktiv1",               "Konjunktiv I &amp; Indirekte Rede", "Konjunktiv I &amp; Indirekte Rede"),
  (2,  "passiv-erweitert",          "Passiv Erweitert",                  "Passiv Erweitert"),
  (3,  "nominalisierung",           "Nominalisierung",                   "Nominalisierung"),
  (4,  "konzessivsaetze",           "Konzessivsätze",                    "Konzessivsätze"),
  (5,  "partizipialkonstruktionen", "Partizipialkonstruktionen",         "Partizipialkonstruktionen"),
  (6,  "modalpartikeln",            "Modalpartikeln",                    "Modalpartikeln"),
  (7,  "textanalyse",               "Textanalyse &amp; Argumentation",   "Textanalyse &amp; Argumentation"),
  (8,  "wissenschaftlich",          "Wissenschaftliches Schreiben",      "Wissenschaftliches Schreiben"),
  (9,  "diskussion",                "Diskussion &amp; Sprechen",         "Diskussion &amp; Sprechen"),
  (10, "hoeren-lesen-b2",           "Hören und Lesen B2",                "Hören und Lesen B2"),
  (11, "wortschatz-b2",             "Wortschatz B2",                     "Wortschatz B2"),
  (12, "schreiben-b2",              "Schreiben B2",                      "Schreiben B2"),
  (13, "sprechen-b2",               "Sprechen B2",                       "Sprechen B2"),
  (14, "pruefungsvorbereitung",     "B2 Prüfungsvorbereitung",           "B2 Prüfungsvorbereitung"),
]

# ── Quiz data (from inject_ubq2.py QUIZ dict, converted to mini-test format) ──
# Format: list of {q, opts:[{text,val}], correct:"a/b/c/d", exp}
LETTERS = "abcd"

def js_str(s):
    """Escape a string for inline JS double-quoted string."""
    return s.replace('\\', '\\\\').replace('"', '\\"')

def format_qs(raw_list):
    """Format question list as B1-style inline JS object literals."""
    lines = []
    for item in raw_list:
        opts_js = ','.join(
            '{text:"' + js_str(item["opts"][i]) + '",val:"' + LETTERS[i] + '"}'
            for i in range(len(item["opts"]))
        )
        lines.append(
            '  {q:"' + js_str(item["q"]) + '",'
            'opts:[' + opts_js + '],'
            'correct:"' + LETTERS[item["ans"]] + '",'
            'exp:"' + js_str(item["exp"]) + '"}'
        )
    return 'const QS=[\n' + ',\n'.join(lines) + '\n];'

RAW = {
1: [
  {"q":"Was ist Konjunktiv I (KI) und wofür wird er verwendet?",
   "opts":["Für irreale Wünsche und Hypothesen","Für indirekte Rede und offizielle Berichte","Für Befehle und Aufforderungen","Für die Zukunft"],
   "ans":1,"exp":"KI dient der indirekten Rede: Er sagte, er sei krank. Typisch in Journalismus und offiziellen Texten."},
  {"q":"Wie bildet man KI von 'sein' (er/sie/es)?",
   "opts":["ist","war","sei","wäre"],
   "ans":2,"exp":"KI von 'sein' = sei. Unregelmäßig! Er sagte, er sei müde."},
  {"q":"Wann verwendet man KII statt KI in der indirekten Rede?",
   "opts":["Immer","Nur bei Modalverben","Wenn KI-Form mit Indikativ identisch ist","Niemals"],
   "ans":2,"exp":"Wenn KI-Form = Indikativ (z.B. 'kommen' → er komme ≠ er kommt ✓, aber 'sie kommen' = KI und Ind. → KII: kämen)."},
  {"q":"KI von 'kommen' (ich) ist:",
   "opts":["komme","käme","kam","bin gekommen"],
   "ans":0,"exp":"KI: Infinitivstamm + -e → ich komme (= Indikativ! Hier wäre KII nötig)."},
  {"q":"KI von 'haben' (er) ist:",
   "opts":["hat","hatte","hätte","habe"],
   "ans":3,"exp":"KI von 'haben' (er) = habe. Er sagte, er habe keine Zeit."},
],
2: [
  {"q":"Was ist der Unterschied zwischen Vorgangs- und Zustandspassiv?",
   "opts":["Es gibt keinen Unterschied","Vorgangspassiv: Prozess (werden+PP); Zustandspassiv: Ergebnis (sein+PP)","Vorgangspassiv: sein+PP; Zustandspassiv: werden+PP","Nur das Subjekt ändert sich"],
   "ans":1,"exp":"Vorgangspassiv: Das Fenster wird geöffnet (Prozess). Zustandspassiv: Das Fenster ist geöffnet (Resultat)."},
  {"q":"Wie wandelt man 'Man repariert das Auto' ins Passiv um?",
   "opts":["Das Auto repariert man","Das Auto wird repariert","Das Auto ist repariert","Man wird das Auto reparieren"],
   "ans":1,"exp":"Man → Passiv ohne Agens: Das Auto wird repariert."},
  {"q":"'Die Tür ist geschlossen.' ist ein:",
   "opts":["Vorgangspassiv","Zustandspassiv","Aktivsatz","Futur"],
   "ans":1,"exp":"sein + Partizip II = Zustandspassiv (beschreibt den Zustand nach dem Schließen)."},
  {"q":"Passiv mit Modalverb: 'Das muss gemacht werden.' Was ist die Infinitivform?",
   "opts":["gemacht haben","gemacht sein","gemacht werden","werden gemacht"],
   "ans":2,"exp":"Passiv-Infinitiv = Partizip II + werden: gemacht werden. Modal + Passiv-Infinitiv."},
  {"q":"Was ist 'unpersönliches Passiv'? Beispiel: 'Hier wird getanzt.'",
   "opts":["Passiv mit konkretem Subjekt","Passiv ohne Subjekt, betont die Handlung","Passiv in der Zukunft","Passiv mit Modalverb"],
   "ans":1,"exp":"Unpersönliches Passiv hat kein Subjekt (oder 'es' als Platzhalter). Betont die Aktivität."},
],
3: [
  {"q":"Wie nominalisiert man 'diskutieren'?",
   "opts":["die Diskutierung","die Diskussion","das Diskutieren","der Diskuss"],
   "ans":1,"exp":"Diskutieren → die Diskussion (-ion-Suffix). Häufige Nominalisierungsform für Verben auf -ieren."},
  {"q":"Nominalisierungen auf -ung sind:",
   "opts":["Maskulin","Feminin","Neutrum","Plural"],
   "ans":1,"exp":"Alle Nomen auf -ung sind feminin: die Lösung, die Meinung, die Entscheidung."},
  {"q":"Wie verbalisiert man 'die Entscheidung' zurück?",
   "opts":["entscheident","entscheidigen","entscheiden","entscheidung"],
   "ans":2,"exp":"die Entscheidung → entscheiden. Nominalisierungen können meist zurückverbalisiert werden."},
  {"q":"Warum bevorzugt man Nominalisierungen im formellen Schreiben?",
   "opts":["Sie sind kürzer","Sie klingen akademischer und präziser","Sie sind einfacher","Sie sind immer korrekt"],
   "ans":1,"exp":"Nominalisierungen verleihen Texten Objektivität und akademischen Stil: 'die Durchführung' statt 'durchführen'."},
  {"q":"Nominalisierung von 'freundlich' (Adjektiv)?",
   "opts":["die Freundlichkeit","die Freundlichung","der Freundlich","das Freundliche"],
   "ans":0,"exp":"Adjektiv + -keit/-heit → Nomen: freundlich → die Freundlichkeit (feminin)."},
],
4: [
  {"q":"Welcher Konnektor drückt einen Konzessivsatz aus?",
   "opts":["weil","damit","obwohl","sodass"],
   "ans":2,"exp":"'obwohl' leitet Konzessivsätze ein: Obwohl es regnet, geht er spazieren. (Trotz Widerspruch)"},
  {"q":"'Da' vs 'weil' — was ist der Unterschied in der Wortstellung?",
   "opts":["Kein Unterschied","'da' steht oft am Satzanfang, 'weil' eher in der Mitte","'da' hat andere Wortstellung","'da' ist informeller"],
   "ans":1,"exp":"Da er krank ist, bleibt er zu Hause. (da = Satzanfang, bekannte Info) vs. Er bleibt zu Hause, weil er krank ist."},
  {"q":"Welcher Satz enthält einen Finalsatz?",
   "opts":["Er lernt, weil er die Prüfung bestehen will.","Er lernt, damit er die Prüfung besteht.","Er lernt, obwohl er müde ist.","Er lernt, sodass er gut vorbereitet ist."],
   "ans":1,"exp":"'damit' = Finalsatz (Zweck/Ziel). Er lernt, damit er die Prüfung besteht."},
  {"q":"Was drückt 'sodass' aus?",
   "opts":["Konzessiv (Trotz)","Kausal (Grund)","Konsekutiv (Folge)","Temporal (Zeit)"],
   "ans":2,"exp":"'sodass' = Konsekutiv: drückt eine Folge aus. Er war so müde, sodass er einschlief."},
  {"q":"'Trotzdem' ist ein:",
   "opts":["Subjunktor (Nebensatz)","Adverb (Hauptsatz)","Präposition","Konjunktion"],
   "ans":1,"exp":"'trotzdem' ist ein Adverb im Hauptsatz: Es regnete. Trotzdem ging er spazieren."},
],
5: [
  {"q":"Das Partizip I von 'laufen' ist:",
   "opts":["gelaufen","laufend","gelaufend","lief"],
   "ans":1,"exp":"Partizip I = Infinitiv + -d: laufen → laufend. Drückt Gleichzeitigkeit aus."},
  {"q":"Welcher Relativsatz kann durch Partizip I ersetzt werden?",
   "opts":["Das Kind, das gestern spielte.","Das Kind, das gerade spielt.","Das Kind, das gespielt hat.","Das Kind, das spielen wird."],
   "ans":1,"exp":"PI drückt Gleichzeitigkeit aus: das spielende Kind (= das Kind, das gerade spielt)."},
  {"q":"'Die gelöste Aufgabe' enthält ein:",
   "opts":["Partizip I attributiv","Partizip II attributiv","Adjektiv","Verb"],
   "ans":1,"exp":"'gelöst' = Partizip II als Adjektivattribut: die gelöste Aufgabe (= die Aufgabe, die gelöst wurde)."},
  {"q":"Welcher Satz kann durch eine Partizipialkonstruktion ersetzt werden?",
   "opts":["Er ist krank.","Das Paket, das gestern geliefert wurde, ist groß.","Er kommt morgen.","Sie hat Hunger."],
   "ans":1,"exp":"Das gestern gelieferte Paket ist groß. (PII-Konstruktion statt Relativsatz)"},
  {"q":"Partizipialkonstruktionen werden als __ verwendet.",
   "opts":["Prädikativ","Attributiv vor dem Nomen","Adverbial","Subjektiv"],
   "ans":1,"exp":"Partizip I/II als Adjektivattribut: der schlafende Hund, die bestandene Prüfung (vor dem Nomen)."},
],
6: [
  {"q":"Was macht 'doch' in: 'Komm doch mal vorbei!'?",
   "opts":["Drückt Zweifel aus","Mildert Aufforderungen ab","Drückt Überraschung aus","Drückt Unmöglichkeit aus"],
   "ans":1,"exp":"'doch' in Aufforderungen macht sie freundlicher/weniger direkt: Komm doch! ≈ Please do come."},
  {"q":"'Das weißt du ja!' — 'ja' drückt aus:",
   "opts":["Zustimmung","Bekannte/gemeinsame Information oder Überraschung","Zweifel","Bedingung"],
   "ans":1,"exp":"'ja' = gemeinsames Wissen oder milde Überraschung: Das ist ja interessant! / Das weißt du ja!"},
  {"q":"'eben/halt' drückt aus:",
   "opts":["Freude","Unvermeidlichkeit/Resignation","Unsicherheit","Zustimmung"],
   "ans":1,"exp":"eben/halt = so ist es nun mal (Unvermeidlichkeit): Das ist eben/halt so."},
  {"q":"Wo stehen Modalpartikeln im Satz?",
   "opts":["Am Satzanfang","Im Mittelfeld (nach finitem Verb)","Am Satzende","Vor dem Subjekt"],
   "ans":1,"exp":"Modalpartikeln stehen im Mittelfeld: Ich bin ja müde. / Komm doch!"},
  {"q":"'wohl' als Modalpartikel bedeutet:",
   "opts":["Sicherheit","Vermutung/Wahrscheinlichkeit","Wunsch","Bedingung"],
   "ans":1,"exp":"'wohl' = Vermutung: Er ist wohl krank. (= wahrscheinlich krank)"},
],
7: [
  {"q":"Was ist die 'These' in einem Argumentationstext?",
   "opts":["Ein Beispiel","Die Hauptbehauptung/Kernaussage","Eine Zusammenfassung","Eine Frage"],
   "ans":1,"exp":"Die These ist die zentrale Behauptung, die man verteidigt oder widerlegt."},
  {"q":"Welcher Konnektor leitet einen Schlusskonnektoren ein?",
   "opts":["obwohl","deshalb/daher/somit","außerdem","zunächst"],
   "ans":1,"exp":"deshalb, daher, somit, folglich = Schlusskonnektoren (zeigen Konsequenz/Fazit)."},
  {"q":"Ein 'Kommentar' in der Textanalyse ist:",
   "opts":["Eine Zusammenfassung","Eine subjektive Meinungsäußerung","Eine objektive Beschreibung","Ein Zitat"],
   "ans":1,"exp":"Ein Kommentar enthält die subjektive Meinung des Autors zu einem Thema."},
  {"q":"Die TAES-Struktur steht für:",
   "opts":["Titel, Autor, Ende, Schluss","These, Argument, Beispiel, Schluss","Text, Analyse, Erklärung, Stil","Thema, Absatz, Einleitung, Satz"],
   "ans":1,"exp":"TAES: These → Argument → Beispiel → Schluss. Grundstruktur für Erörterungen und Kommentare."},
  {"q":"Welcher Konnektor ist adversativ (Gegensatz)?",
   "opts":["außerdem","deshalb","jedoch/allerdings","zunächst"],
   "ans":2,"exp":"jedoch, allerdings, aber, hingegen = adversativ (Gegensatz): Er ist fleißig, jedoch oft unpünktlich."},
],
8: [
  {"q":"Wie lautet die korrekte formelle Anrede in einem Geschäftsbrief?",
   "opts":["Hallo!","Sehr geehrte Damen und Herren,","Hey,","Liebe alle,"],
   "ans":1,"exp":"'Sehr geehrte Damen und Herren,' ist die Standardanrede in formellen deutschen Briefen/E-Mails."},
  {"q":"Was sollte man im formellen Schreiben NICHT verwenden?",
   "opts":["Konjunktiv II","Passiv","Umgangssprache","Fachbegriffe"],
   "ans":2,"exp":"Umgangssprache ist in formellen Texten unangemessen. Fachbegriffe, Passiv und Konjunktiv II sind erwünscht."},
  {"q":"Was gehört in ein Bewerbungsschreiben?",
   "opts":["Nur Kontaktdaten","Motivation, Erfahrungen und Qualifikationen","Hobbys und Urlaubspläne","Persönliche Probleme"],
   "ans":1,"exp":"Bewerbung: Motivation für die Stelle, relevante Erfahrungen und Qualifikationen."},
  {"q":"Welcher Abschluss ist in einem formellen Brief korrekt?",
   "opts":["Tschüs!","Bis bald,","Mit freundlichen Grüßen,","Ciao,"],
   "ans":2,"exp":"'Mit freundlichen Grüßen' (MfG) ist der Standardabschluss. Halbformell: Viele Grüße. Informell: Liebe Grüße."},
  {"q":"Was gehört NICHT in ein Bewerbungsschreiben?",
   "opts":["Motivation für die Stelle","Relevante Erfahrungen","Persönliche Probleme","Kontaktdaten"],
   "ans":2,"exp":"Persönliche Probleme sind für eine Bewerbung unangemessen und irrelevant."},
],
9: [
  {"q":"Wie widerspricht man höflich?",
   "opts":["Das ist falsch!","Ich sehe das etwas anders, weil...","Nein!","Du hast keine Ahnung."],
   "ans":1,"exp":"'Ich sehe das etwas anders' signalisiert Höflichkeit und lädt zur Diskussion ein."},
  {"q":"\"Ich bin der Meinung, dass...\" ist ein Ausdruck für:",
   "opts":["Zustimmung","Meinungsäußerung","Widerspruch","Zusammenfassung"],
   "ans":1,"exp":"'Ich bin der Meinung...' ist eine typische Formel zur Meinungsäußerung im B2-Sprechen."},
  {"q":"Bei einer B2-Diskussion sollte man:",
   "opts":["Nur die eigene Meinung sagen","Argumente mit Beispielen belegen","Sehr schnell sprechen","Keine Fragen stellen"],
   "ans":1,"exp":"Argumente mit Beispielen zu belegen macht sie überzeugender und zeigt Sprachkompetenz."},
  {"q":"\"Einerseits... andererseits...\" zeigt:",
   "opts":["Chronologie","Zwei Perspektiven/Gegenüberstellung","Ursache und Wirkung","Zusammenfassung"],
   "ans":1,"exp":"'Einerseits... andererseits...' stellt zwei Perspektiven oder Argumente gegenüber."},
  {"q":"Um Zeit beim Sprechen zu gewinnen, sagt man:",
   "opts":["Nichts — einfach schweigen","Das ist eine gute Frage, ich überlege kurz...","Ich weiß es nicht.","Nächste Frage bitte."],
   "ans":1,"exp":"Solche Phrasen geben Zeit zum Nachdenken ohne unangenehme Pausen."},
],
10: [
  {"q":"Was ist \"Skimming\"?",
   "opts":["Jedes Wort genau lesen","Schnelles Überfliegen zum Hauptthema verstehen","Nur die Überschriften lesen","Rückwärts lesen"],
   "ans":1,"exp":"Skimming = globales Lesen: schnell überfliegen, um das Hauptthema zu erfassen."},
  {"q":"Bei Höraufgaben sollte man:",
   "opts":["Alles wörtlich aufschreiben","Schlüsselwörter und Hauptideen notieren","Die Augen schließen","Nichts aufschreiben"],
   "ans":1,"exp":"Schlüsselwörter und Hauptideen notieren ist effizienter als alles aufschreiben."},
  {"q":"\"Selektives Lesen\" bedeutet:",
   "opts":["Alles lesen","Nur interessante Teile lesen","Gezielt nach bestimmten Informationen suchen","Sehr langsam lesen"],
   "ans":2,"exp":"Selektives Lesen (Scanning) = gezielt nach spezifischen Informationen suchen."},
  {"q":"Was macht man bei einem unbekannten Wort im Text?",
   "opts":["Sofort aufhören","Kontext nutzen um Bedeutung zu erschließen","Das Wörterbuch nehmen","Den Text neu beginnen"],
   "ans":1,"exp":"Den Kontext nutzen spart Zeit und ist die wichtigste Lesestrategie in der Prüfung."},
  {"q":"Globalverstehen bedeutet:",
   "opts":["Den ganzen Text übersetzen","Jedes Detail verstehen","Den allgemeinen Inhalt und die Hauptideen verstehen","Nur den Anfang lesen"],
   "ans":2,"exp":"Globalverstehen = das Hauptthema und die Hauptideen eines Textes erfassen."},
],
11: [
  {"q":"\"Die Nachhaltigkeit\" bedeutet:",
   "opts":["Schnelles Wachstum","Langfristig umweltverträgliches Handeln","Wirtschaftlicher Gewinn","Technologischer Fortschritt"],
   "ans":1,"exp":"Nachhaltigkeit = Ressourcen so nutzen, dass sie für künftige Generationen erhalten bleiben."},
  {"q":"\"Integration\" im gesellschaftlichen Kontext bedeutet:",
   "opts":["Mathematische Berechnung","Eingliederung in die Gesellschaft","Computerprogrammierung","Sprachkurs besuchen"],
   "ans":1,"exp":"Gesellschaftliche Integration = Menschen werden gleichberechtigter Teil der Gesellschaft."},
  {"q":"\"Die Fachkraft\" bedeutet:",
   "opts":["Ein Werkzeug","Eine qualifizierte Person in einem Berufsfeld","Ein Unternehmen","Eine Behörde"],
   "ans":1,"exp":"Fachkraft = eine Person mit spezifischer Berufsausbildung (z.B. IT-Fachkraft)."},
  {"q":"\"Globalisierung\" beschreibt:",
   "opts":["Lokale Entwicklungen","Weltweite Vernetzung von Wirtschaft und Gesellschaft","Einen Computerbegriff","Einen geografischen Begriff"],
   "ans":1,"exp":"Globalisierung = weltweite wirtschaftliche, kulturelle und politische Vernetzung."},
  {"q":"\"Die Behörde\" ist:",
   "opts":["Ein privates Unternehmen","Eine staatliche Verwaltungseinrichtung","Eine Schule","Ein Krankenhaus"],
   "ans":1,"exp":"Behörde = staatliche/öffentliche Verwaltungsstelle, z.B. Ausländeramt, Finanzamt."},
],
12: [
  {"q":"Eine Erörterung hat folgende Struktur:",
   "opts":["Begrüßung, Hauptteil, Abschied","Einleitung, Hauptteil (Pro/Kontra), Schluss","These, Antithese","Nur Argumente"],
   "ans":1,"exp":"Erörterung: Einleitung (Thema) → Hauptteil (Pro/Kontra) → Schluss (Fazit)."},
  {"q":"Ein Leserbrief beginnt mit:",
   "opts":["Hallo Redaktion!","Einer formellen Anrede und Bezug auf den Artikel","Einer Zusammenfassung","Persönlichen Daten"],
   "ans":1,"exp":"Leserbrief: formelle Anrede → Bezug auf den Artikel → eigene Meinung mit Begründung."},
  {"q":"Was gehört in die Einleitung einer Erörterung?",
   "opts":["Alle Argumente","Das Thema vorstellen und Interesse wecken","Die Schlussfolgerung","Persönliche Daten"],
   "ans":1,"exp":"Die Einleitung führt in das Thema ein und weckt das Interesse des Lesers."},
  {"q":"Beim Zusammenfassen:",
   "opts":["Kopiert man den Text","Gibt man alle Details wieder","Fasst man Hauptpunkte in eigenen Worten zusammen","Schreibt man seine Meinung"],
   "ans":2,"exp":"Zusammenfassen = Hauptpunkte in eigenen Worten, kürzer als das Original."},
  {"q":"\"Darüber hinaus\" dient als:",
   "opts":["Schlussfolgerung","Widerspruch","Zusätzliches Argument","Einleitung"],
   "ans":2,"exp":"'Darüber hinaus' ist additiv: es fügt ein weiteres Argument zum vorherigen hinzu."},
],
13: [
  {"q":"Eine B2-Präsentation dauert ca.:",
   "opts":["1 Minute","3–5 Minuten","10 Minuten","30 Minuten"],
   "ans":1,"exp":"Die B2-Präsentation (Monolog) dauert ca. 3–5 Minuten."},
  {"q":"Wie beginnt man eine Präsentation?",
   "opts":["Sofort mit Details","Mit Begrüßung, Thema vorstellen und Gliederung","Mit einer langen Geschichte","Mit Fragen ans Publikum"],
   "ans":1,"exp":"Gute Struktur: Begrüßung → Thema nennen → kurze Gliederung → Inhalt."},
  {"q":"Bei der Bildbeschreibung B2:",
   "opts":["Nur beschreiben was man sieht","Beschreiben, interpretieren und Meinung äußern","Nur die Farben nennen","Das Bild übersetzen"],
   "ans":1,"exp":"B2-Bildbeschreibung = beschreiben + interpretieren + eigene Meinung äußern."},
  {"q":"Wenn man ein Wort vergisst:",
   "opts":["Aufhören zu sprechen","Ich weiß nicht sagen","Umschreiben und weitersprechen","Auf Englisch sagen"],
   "ans":2,"exp":"Umschreiben zeigt Sprachkompetenz: 'das Ding, mit dem man schreibt' = Stift."},
  {"q":"Prüfungsangst bekämpft man durch:",
   "opts":["Gar nicht üben","Regelmäßiges Üben und positive Selbstgespräche","Viel Kaffee trinken","Die Prüfung vermeiden"],
   "ans":1,"exp":"Regelmäßiges Üben und positive Gedanken reduzieren Prüfungsangst nachweislich."},
],
14: [
  {"q":"Wie viel sollte man vor der Prüfung schlafen?",
   "opts":["Die ganze Nacht lernen","Mindestens 7–8 Stunden gut schlafen","4 Stunden reichen","Schlafen ist unwichtig"],
   "ans":1,"exp":"Schlaf ist entscheidend für Konzentration und Gedächtnis am Prüfungstag."},
  {"q":"Was macht man, wenn man eine Aufgabe nicht versteht?",
   "opts":["Die Prüfung abgeben","Leer lassen und weitermachen, am Ende zurückkommen","Raten ohne nachzudenken","Den Prüfer fragen"],
   "ans":1,"exp":"Weitermachen und zurückkommen spart Zeit und reduziert Stress in der Prüfung."},
  {"q":"Gutes Zeitmanagement in der Prüfung bedeutet:",
   "opts":["So schnell wie möglich fertig sein","Zeit pro Aufgabe einteilen und einhalten","Beim ersten Fehler aufhören","Alles zweimal schreiben"],
   "ans":1,"exp":"Zeitplan: z.B. Lesen 30 Min, Hören 30 Min, Schreiben 40 Min einhalten."},
  {"q":"Kurz vor der Prüfung sollte man:",
   "opts":["Neue Grammatik lernen","Bekannte Themen wiederholen und sich ausruhen","Die ganze Nacht lernen","Nichts tun"],
   "ans":1,"exp":"Bekanntes wiederholen ist effektiver als kurz vor der Prüfung Neues zu lernen."},
  {"q":"Nach einer nicht bestandenen Prüfung sollte man:",
   "opts":["Nie wieder versuchen","Analysieren was falsch war und nochmal anmelden","Aufgeben","Sich schämen"],
   "ans":1,"exp":"Jede Prüfung ist eine Lernmöglichkeit. Analysieren, verbessern, nochmal versuchen!"},
],
}

# ── HTML template ──────────────────────────────────────────────────────────────
def make_html(num, slug, title_html, raw_list):
    module_file = f"./module-b2-{num}-{slug}.html"
    title_plain = title_html.replace("&amp;", "&")
    qs_block = format_qs(raw_list)
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_plain} — DeutschWeg</title>
<link rel="stylesheet" href="./deutschweg-theme.css">
<style>
body{{background:var(--bg);}}
.mt-wrap{{max-width:560px;margin:0 auto;padding:20px 16px 80px;}}
.mt-header{{text-align:center;margin-bottom:24px;}}
.mt-badge{{display:inline-block;background:#8B5CF6;color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 12px;border-radius:20px;margin-bottom:10px;}}
.mt-title{{font-size:21px;font-weight:800;color:var(--dark);margin-bottom:4px;}}
.mt-subtitle{{font-size:13px;color:var(--mid);}}
.mt-dots{{display:flex;justify-content:center;gap:10px;margin-bottom:20px;}}
.mt-dot{{width:11px;height:11px;border-radius:50%;background:var(--border);transition:all .3s;}}
.mt-dot.active{{background:#8B5CF6;transform:scale(1.2);}}
.mt-dot.correct{{background:var(--green);}}
.mt-dot.wrong{{background:var(--red);}}
.mt-dot.done{{background:#8B5CF6;opacity:.4;}}
.mt-card{{background:#fff;border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:28px 22px 22px;}}
.mt-qnum{{font-size:12px;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}}
.mt-question{{font-size:17px;font-weight:700;color:var(--dark);line-height:1.5;margin-bottom:22px;}}
.mt-options{{display:flex;flex-direction:column;gap:9px;}}
.mt-opt{{display:flex;align-items:center;gap:12px;padding:12px 15px;border:2px solid var(--border);border-radius:12px;cursor:pointer;font-size:15px;font-weight:500;color:var(--dark);background:#fff;text-align:left;width:100%;transition:all .18s;}}
.mt-opt:hover:not(.disabled){{border-color:#8B5CF6;background:#faf5ff;}}
.mt-opt.selected{{border-color:#8B5CF6;background:#f5f3ff;color:#8B5CF6;}}
.mt-opt.correct{{border-color:var(--green)!important;background:var(--green-light)!important;color:#065f46!important;}}
.mt-opt.wrong{{border-color:var(--red)!important;background:var(--red-light)!important;color:#991b1b!important;}}
.mt-opt.disabled{{cursor:default;}}
.mt-opt-letter{{width:26px;height:26px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}}
.mt-feedback{{margin-top:14px;padding:11px 14px;border-radius:10px;font-size:13.5px;font-weight:600;display:none;line-height:1.5;}}
.mt-feedback.show{{display:block;}}
.mt-feedback.ok{{background:var(--green-light);color:#065f46;border:1px solid var(--green-border);}}
.mt-feedback.no{{background:var(--red-light);color:#991b1b;border:1px solid #fecaca;}}
.mt-next{{margin-top:16px;width:100%;padding:13px;background:#8B5CF6;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:none;}}
.mt-next:hover{{opacity:.88;}}
.mt-next.show{{display:block;}}
.mt-results{{background:#fff;border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:36px 24px;text-align:center;display:none;}}
.mt-results.show{{display:block;}}
.mt-score-ring{{width:100px;height:100px;border-radius:50%;border:6px solid #8B5CF6;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 16px;}}
.mt-score-num{{font-size:34px;font-weight:800;color:#8B5CF6;line-height:1;}}
.mt-score-denom{{font-size:13px;color:var(--mid);font-weight:600;}}
.mt-result-label{{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--mid);margin-bottom:6px;}}
.mt-result-msg{{font-size:18px;font-weight:700;color:var(--dark);margin-bottom:20px;line-height:1.4;}}
.mt-rdots{{display:flex;justify-content:center;gap:8px;margin-bottom:20px;}}
.mt-rdot{{width:14px;height:14px;border-radius:50%;}}
.mt-actions{{display:flex;flex-direction:column;gap:10px;}}
.mt-btn-p{{padding:14px;background:#8B5CF6;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;}}
.mt-btn-s{{padding:13px;background:#fff;color:#8B5CF6;border:2px solid #8B5CF6;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;display:block;}}
.mt-btn-p:hover,.mt-btn-s:hover{{opacity:.88;}}
.slide-in{{animation:sIn .22s ease;}}
@keyframes sIn{{from{{opacity:0;transform:translateX(18px);}}to{{opacity:1;transform:translateX(0);}}}}
</style>
</head>
<body>
<nav class="dw-nav">
  <div class="dw-nav-inner" style="display:flex;align-items:center;justify-content:space-between;height:56px;">
    <a href="./deutschweg-prototype.html" class="dw-logo">DeutschWeg</a><a href="./exam-vault.html" style="font-size:13px;font-weight:600;color:#1D4ED8;text-decoration:none;margin:0 4px;">📝 Exams</a>
    <a href="{module_file}" class="dw-btn" style="font-size:13px;padding:7px 16px;">← Lektion</a>
  </div>
</nav>
<div class="mt-wrap">
  <div class="mt-header">
    <div class="mt-badge">B2 · Mini-Test</div>
    <div class="mt-title">{title_html}</div>
    <div class="mt-subtitle">5 Fragen · 3–5 Min</div>
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
    <div class="mt-result-label">Dein Ergebnis</div>
    <div class="mt-score-ring"><div class="mt-score-num" id="rn">0</div><div class="mt-score-denom">von 5</div></div>
    <div class="mt-rdots" id="rd"></div>
    <div class="mt-result-msg" id="rm"></div>
    <div class="mt-actions">
      <button class="mt-btn-p" onclick="restart()">Nochmal versuchen</button>
      <a href="./deutschweg-prototype.html" class="mt-btn-s">Zum Dashboard →</a>
    </div>
  </div>
</div>
<script>
{qs_block}
const MSGS=[[5, "Perfekt! 🎉 Du hast dieses Thema gemeistert!"], [4, "Sehr gut! 👏 Fast perfekt!"], [3, "Gut! 💪 Noch etwas Übung nötig."], [2, "Weiter üben! 📚 Schau dir die Lektion nochmal an."], [0, "Nicht aufgeben! 🌟 Versuche die Lektion erneut."]];
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
  document.getElementById('qnum').textContent='Frage '+(cur+1)+' von 5';
  document.getElementById('qtext').textContent=q.q;
  document.getElementById('fb').className='mt-feedback';
  document.getElementById('fb').textContent='';
  const nb=document.getElementById('nb');
  nb.className='mt-next';
  nb.textContent=cur<4?'Nächste Frage →':'🏆 Ergebnis';
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
    fb.textContent='✓ '+(exp||'Richtig!');
  }}else{{
    const ct=QS[cur].opts.find(o=>o.val===correct);
    fb.className='mt-feedback show no';
    fb.textContent='✗ '+(exp?exp:('Leider falsch. Richtige Antwort: '+(ct?ct.text:correct)));
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

# ── Generate HTML files ────────────────────────────────────────────────────────
print("Generating mini-test-b2-*.html files...")
for num, slug, title_html, _ in MODULES:
    html = make_html(num, slug, title_html, RAW[num])
    fname = f"mini-test-b2-{num}.html"
    path = os.path.join(BASE, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"  OK   {fname}")

# ── Patch deutschweg-theme.css with .mt-quick-btn.b2 ─────────────────────────
print("Patching deutschweg-theme.css...")
theme_path = os.path.join(BASE, 'deutschweg-theme.css')
with open(theme_path, 'r', encoding='utf-8') as f:
    css = f.read()

b2_rule = '.mt-quick-btn.b2 { color: #8B5CF6; background: #F5F3FF; border-color: #DDD6FE; }\n.mt-quick-btn.b2:hover { background: #EDE9FE; }'

if '.mt-quick-btn.b2' not in css:
    css = css.replace(
        '.mt-quick-btn.b1 { color: #059669; background: #ECFDF5; border-color: #A7F3D0; }\n.mt-quick-btn.b1:hover { background: #D1FAE5; }',
        '.mt-quick-btn.b1 { color: #059669; background: #ECFDF5; border-color: #A7F3D0; }\n.mt-quick-btn.b1:hover { background: #D1FAE5; }\n' + b2_rule
    )
    with open(theme_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("  OK   Added .mt-quick-btn.b2 to deutschweg-theme.css")
else:
    print("  SKIP .mt-quick-btn.b2 already in theme")

# ── Patch deutschweg-prototype.html with Quick Test buttons ───────────────────
print("Patching deutschweg-prototype.html...")
proto_path = os.path.join(BASE, 'deutschweg-prototype.html')
with open(proto_path, 'r', encoding='utf-8') as f:
    html = f.read()

for num, slug, _, _ in MODULES:
    module_href = f"./module-b2-{num}-{slug}.html"
    mini_href = f"./mini-test-b2-{num}.html"
    btn = f'\n  <a href="{mini_href}" class="mt-quick-btn b2" onclick="event.stopPropagation()">Quick Test \u2192</a>'

    # Find the closing </a> of the module card for this module
    # Pattern: the </a> that follows href="./module-b2-N-slug.html"
    # We need to find the card's closing </a> and insert after it
    # The card starts with <a class="module-card" href="./module-b2-N-slug.html"
    card_start = f'<a class="module-card" href="{module_href}"'
    idx = html.find(card_start)
    if idx == -1:
        print(f"  WARN module-b2-{num}: card not found")
        continue

    # Find the closing </a> after this card start
    # Search from idx forward
    close_idx = html.find('</a>', idx)
    if close_idx == -1:
        print(f"  WARN module-b2-{num}: closing </a> not found")
        continue

    close_end = close_idx + len('</a>')
    # Check if button already exists
    snippet = html[close_end:close_end+80]
    if 'mini-test-b2-' + str(num) in snippet:
        print(f"  SKIP module-b2-{num}: button already exists")
        continue

    html = html[:close_end] + btn + html[close_end:]
    print(f"  OK   Added Quick Test button for module-b2-{num}")

with open(proto_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("Done!")
