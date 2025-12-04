-- Migration: Add words table with difficulty levels
-- This replaces/augments the existing audio_files table

-- Create enum for difficulty levels
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Create new words table
CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    word VARCHAR(100) NOT NULL UNIQUE,
    definition TEXT NOT NULL,
    difficulty difficulty_level NOT NULL DEFAULT 'medium',
    audio_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_words_difficulty ON words(difficulty);
CREATE INDEX idx_words_word ON words(word);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_words_updated_at
    BEFORE UPDATE ON words
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the game)
CREATE POLICY "Allow public read access" ON words
    FOR SELECT USING (true);

-- Create streak tracking table for future use
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Could be anonymous ID from localStorage
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_played_date DATE,
    total_games_played INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own streak data
CREATE POLICY "Allow public streak access" ON user_streaks
    FOR ALL USING (true);

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    username TEXT, -- Optional display name
    score INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    difficulty difficulty_level NOT NULL,
    game_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_date ON leaderboard(game_date);
CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX idx_leaderboard_difficulty ON leaderboard(difficulty);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public leaderboard access" ON leaderboard
    FOR ALL USING (true);
