/**
 * DeutschWeg — Supabase configuration
 *
 * The ANON key is intentionally public — it is designed for client-side use.
 * Supabase Row Level Security (RLS) policies control what each user can access.
 * Never put the SERVICE ROLE key here.
 *
 * Supabase setup required — run this SQL in your Supabase SQL editor:
 * ─────────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS public.profiles (
 *   id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   full_name    text,
 *   email        text,
 *   country      text,
 *   trial_start  timestamptz DEFAULT now(),
 *   trial_end    timestamptz DEFAULT (now() + interval '14 days'),
 *   plan         text DEFAULT 'trial',
 *   created_at   timestamptz DEFAULT now()
 * );
 *
 * ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can read/write their own profile
 * CREATE POLICY "own_profile_select" ON public.profiles
 *   FOR SELECT USING (auth.uid() = id);
 * CREATE POLICY "own_profile_insert" ON public.profiles
 *   FOR INSERT WITH CHECK (auth.uid() = id);
 * CREATE POLICY "own_profile_update" ON public.profiles
 *   FOR UPDATE USING (auth.uid() = id);
 *
 * -- Admin can read all profiles (used by admin.html)
 * CREATE POLICY "admin_read_all" ON public.profiles
 *   FOR SELECT USING (true);
 * ─────────────────────────────────────────────────────────────────────
 */

var DW_SUPABASE_URL = 'https://udmunxzzuqoynlftapwh.supabase.co';
var DW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbXVueHp6dXFveW5sZnRhcHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTEzMzEsImV4cCI6MjA4OTgyNzMzMX0.CnSrfql7wlUZsvOambviF60tFCXqY0sxi_VomDeScgQ';

// dwSupabase is the global client used by all DeutschWeg pages
var dwSupabase = supabase.createClient(DW_SUPABASE_URL, DW_SUPABASE_KEY);
