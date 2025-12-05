const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissingAudio() {
  const { data, error } = await supabase
    .from('audio_files')
    .select('word, audio_url, difficulty');

  if (error) {
    console.log('Error:', error);
    return;
  }

  const missing = data.filter(w => !w.audio_url || w.audio_url.trim() === '');
  console.log('Total words:', data.length);
  console.log('Words with missing audio:', missing.length);

  if (missing.length > 0) {
    console.log('\nMissing audio for:');
    missing.forEach(w => console.log(`  - ${w.word} (${w.difficulty || 'no difficulty'})`));
  }
}

checkMissingAudio();
