import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = 'https://znyczuopidkjyggwlibj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWN6dW9waWRranlnZ3dsaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MDkxNDcsImV4cCI6MjA0ODQ4NTE0N30.goPkSdTjwnaA1fnbdQzTssSuWCG9bTkT-_0C2mFACz0'; // Your Supabase public key

// Create and export the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;


