-- DeutschWeg — clean up CamelCase / concatenated module titles
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Some module titles ended up with missing spaces (PerfektTense,
-- AdjectiveEndings, ModalVerbs, etc.) or had a subtitle concatenated
-- onto the main title without a separator (e.g. "PersonalPronouns",
-- "haben and seinThe Two Verbs That Run German"). This migration
-- writes back human-readable titles. Identification is by (level,
-- order_index) so it's stable across module-id changes.

update public.modules set title = 'Haben & Sein'           where level = 'A1' and order_index = 4;
update public.modules set title = 'Der, Die, Das'           where level = 'A1' and order_index = 5;
update public.modules set title = 'Akkusativ Case'          where level = 'A1' and order_index = 6;
update public.modules set title = 'Dativ Case'              where level = 'A1' and order_index = 7;
update public.modules set title = 'Present Tense'           where level = 'A1' and order_index = 9;
update public.modules set title = 'Personal Pronouns'       where level = 'A1' and order_index = 10;
update public.modules set title = 'Modal Verbs'             where level = 'A1' and order_index = 13;
update public.modules set title = 'Perfekt Tense'           where level = 'A2' and order_index = 1;
update public.modules set title = 'Adjective Endings'       where level = 'A2' and order_index = 3;
update public.modules set title = 'Subordinate Clauses'     where level = 'A2' and order_index = 4;
update public.modules set title = 'Reflexive Verbs'         where level = 'A2' and order_index = 6;
update public.modules set title = 'Two-way Prepositions'    where level = 'A2' and order_index = 7;
