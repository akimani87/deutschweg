-- DeutschWeg — Add expires_at to entitlements, for the A1 Exam Vault's
-- 60-day access window.
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- NOT YET APPLIED to the live database as of this migration file being
-- written — this is the smallest safe schema change needed before
-- expiry can be enforced (see the A1 Exam Vault access-gate task).
--
-- Additive and backward compatible: NULL means "no expiry" (permanent
-- access), which is exactly today's behavior for every existing row
-- (a2_module, b1_module, b2_module, examwhisperer_*) — none of those
-- get an expiry date, only a1_exam_vault does, set at grant time by the
-- webhook handler. No existing entitlement is affected by adding this
-- column.

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
