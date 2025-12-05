/**
 * Script to fetch definitions from Free Dictionary API and generate audio via OpenAI TTS
 *
 * Usage:
 *   npx ts-node scripts/generate-word-data.ts
 *
 * Prerequisites:
 *   - OPENAI_API_KEY environment variable set
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables set
 *
 * This script will:
 *   1. Load words from src/data/words.json
 *   2. Fetch definitions from Free Dictionary API (free, no key needed)
 *   3. Generate pronunciation audio via OpenAI TTS (voice: onyx)
 *   4. Upload audio to Supabase Storage
 *   5. Insert word data into Supabase database
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TTS_VOICE = 'onyx';
const TTS_MODEL = 'tts-1';
const TTS_SPEED = 0.75; // Slower for clearer pronunciation
const AUDIO_FORMAT = 'mp3';
const STORAGE_BUCKET = 'audio';

// Rate limiting
const DICTIONARY_DELAY_MS = 500; // Be nice to the free API
const TTS_DELAY_MS = 200;

interface WordEntry {
  word: string;
  definition: string;
  difficulty: 'easy' | 'medium' | 'hard';
  audio_url?: string;
}

interface DictionaryResponse {
  word: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}

// Initialize Supabase client with service role key for admin access
function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Fetch definition from Free Dictionary API
async function fetchDefinition(word: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!response.ok) {
      console.warn(`  ⚠️  No definition found for "${word}"`);
      return null;
    }

    const data: DictionaryResponse[] = await response.json();

    if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
      const meaning = data[0].meanings[0];
      const def = meaning.definitions[0];
      const partOfSpeech = meaning.partOfSpeech;

      // Format: "(noun) the definition text"
      return `(${partOfSpeech}) ${def.definition}`;
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Error fetching definition for "${word}":`, error);
    return null;
  }
}

// Generate audio using OpenAI TTS API
async function generateAudio(word: string): Promise<Buffer | null> {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: word,
        voice: TTS_VOICE,
        response_format: AUDIO_FORMAT,
        speed: TTS_SPEED,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ TTS API error for "${word}":`, error);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`  ❌ Error generating audio for "${word}":`, error);
    return null;
  }
}

// Upload audio to Supabase Storage
async function uploadAudio(
  supabase: ReturnType<typeof createClient>,
  word: string,
  difficulty: string,
  audioBuffer: Buffer
): Promise<string | null> {
  const fileName = `${difficulty}/${word.toLowerCase().replace(/\s+/g, '-')}.${AUDIO_FORMAT}`;

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, audioBuffer, {
        contentType: `audio/${AUDIO_FORMAT}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error(`  ❌ Upload error for "${word}":`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`  ❌ Error uploading audio for "${word}":`, error);
    return null;
  }
}

// Check if word already exists
async function wordExists(
  supabase: ReturnType<typeof createClient>,
  word: string
): Promise<boolean> {
  const { data } = await supabase
    .from('audio_files')
    .select('id')
    .eq('word', word)
    .limit(1);
  return !!(data && data.length > 0);
}

// Insert or update word in database
async function saveWord(
  supabase: ReturnType<typeof createClient>,
  entry: WordEntry,
  exists: boolean
): Promise<boolean> {
  try {
    if (exists) {
      // Update existing record
      const { error } = await supabase
        .from('audio_files')
        .update({
          definition: entry.definition,
          difficulty: entry.difficulty,
          audio_url: entry.audio_url,
        })
        .eq('word', entry.word);

      if (error) {
        console.error(`  ❌ Database error updating "${entry.word}":`, error);
        return false;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('audio_files')
        .insert({
          word: entry.word,
          definition: entry.definition,
          difficulty: entry.difficulty,
          audio_url: entry.audio_url,
        });

      if (error) {
        console.error(`  ❌ Database error inserting "${entry.word}":`, error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error saving "${entry.word}":`, error);
    return false;
  }
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main processing function
async function processWords() {
  console.log('🚀 Starting word data generation...\n');

  // Validate environment variables
  if (!OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY environment variable');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  // Load word list
  const wordsPath = path.join(__dirname, '../src/data/words.json');
  const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf-8'));

  const supabase = getSupabaseClient();

  // Process each difficulty level
  const difficulties = ['easy', 'medium', 'hard'] as const;

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const difficulty of difficulties) {
    const words: string[] = wordsData[difficulty] || [];
    console.log(`\n📚 Processing ${words.length} ${difficulty.toUpperCase()} words...\n`);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      totalProcessed++;

      console.log(`[${i + 1}/${words.length}] Processing "${word}"...`);

      // Step 0: Check if word already exists (skip definition fetch if so)
      const exists = await wordExists(supabase, word);
      let definition: string | null = null;

      if (exists) {
        // Get existing definition from database
        const { data } = await supabase
          .from('audio_files')
          .select('definition')
          .eq('word', word)
          .limit(1);
        definition = data?.[0]?.definition || null;
        if (definition) {
          console.log(`  ✅ Using existing definition`);
        }
      }

      // Step 1: Fetch definition if we don't have one
      if (!definition) {
        await sleep(DICTIONARY_DELAY_MS);
        definition = await fetchDefinition(word);
      }

      if (!definition) {
        console.log(`  ⏭️  Skipping "${word}" - no definition found`);
        totalFailed++;
        continue;
      }
      console.log(`  ✅ Definition fetched`);

      // Step 2: Generate audio
      await sleep(TTS_DELAY_MS);
      const audioBuffer = await generateAudio(word);

      if (!audioBuffer) {
        console.log(`  ⏭️  Skipping "${word}" - audio generation failed`);
        totalFailed++;
        continue;
      }
      console.log(`  ✅ Audio generated (${audioBuffer.length} bytes)`);

      // Step 3: Upload audio to Supabase Storage
      const audioUrl = await uploadAudio(supabase, word, difficulty, audioBuffer);

      if (!audioUrl) {
        console.log(`  ⏭️  Skipping "${word}" - audio upload failed`);
        totalFailed++;
        continue;
      }
      console.log(`  ✅ Audio uploaded`);

      // Step 4: Insert into database
      const entry: WordEntry = {
        word,
        definition,
        difficulty,
        audio_url: audioUrl,
      };

      const success = await saveWord(supabase, entry, exists);

      if (success) {
        console.log(`  ✅ Saved to database\n`);
        totalSuccess++;
      } else {
        totalFailed++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Successful: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log('='.repeat(50));
}

// Run the script
processWords().catch(console.error);
