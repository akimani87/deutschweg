-- Certification gate for Mock Exam content (mock-exam-certification-checklist.md).
-- Mock Exam content (referenced by mock_exam_sets.hoeren_exam_id/lesen_exam_id/
-- schreiben_exam_id) is a distinct, higher-bar category from Practice Pool
-- content (the existing generative exams/exam_tasks used by "Generate new"
-- and standalone practice) -- but both continue to live in the same exams/
-- exam_tasks tables, no schema duplication.
--
-- Schema-only for now: adds the flag but does NOT enforce it with a
-- constraint/FK check yet, since existing mock_exam_sets rows reference
-- exams that are not yet certified (see the audit in
-- mock-exam-certification-checklist.md and the Step 3 report). Enforcement
-- is a separate, later step once current content either passes review or
-- is regenerated.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_certified_mock_exam boolean NOT NULL DEFAULT false;
