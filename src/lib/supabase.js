import { createClient } from "@supabase/supabase-js";

// Set these in .env.local (dev) and in Vercel → Project → Settings → Environment Variables.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;

export const BUCKET = "project-files";

/* Throw on Supabase errors so callers can use plain try/catch. */
export async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
