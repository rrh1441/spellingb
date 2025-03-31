// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// These values will be pulled from Vercel's Environment Variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Optional: Add checks to ensure variables are loaded
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Anon Key is missing from environment variables.");
  // Depending on your app's needs, you might throw an error or handle this state
  // throw new Error("Supabase configuration is incomplete.");
}

// Initialize client only if configuration is present
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.error("Supabase client could not be initialized. Check Vercel Environment Variables.");
}

export default supabase;