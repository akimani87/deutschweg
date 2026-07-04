-- DeutschWeg — Add order_id to entitlements for Lemon Squeezy idempotency
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Adds order_id (Lemon Squeezy order ID) so the webhook handler can detect
-- duplicate deliveries without re-querying by user+product.
-- Also adds a unique constraint on (user_id, product_key) so duplicate
-- concurrent inserts fail with code 23505 (handled gracefully in the webhook).

ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS order_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entitlements_user_product_unique'
  ) THEN
    ALTER TABLE public.entitlements
      ADD CONSTRAINT entitlements_user_product_unique
      UNIQUE (user_id, product_key);
  END IF;
END $$;
