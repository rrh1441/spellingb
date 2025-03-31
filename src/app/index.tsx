// src/app/index.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2, SkipBackIcon as Backspace } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "@/components/ui/use-toast" // Make sure toast is imported
import { v4 as uuidv4 } from 'uuid'
import supabase from '../lib/supabase' // Import the potentially null client

const dailyWord = {
  word: 'ephemeral',
  definition: 'Lasting for a very short time.',
  // Assuming audioUrl is now relative path in the bucket or needs adjustment
  audioUrl: 'ephemeral.mp3', // Example: if your audio file is directly in the 'audio' bucket
}

export default function Home() {
  const [score, setScore] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [currentWord, setCurrentWord] = useState(dailyWord)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let id = localStorage.getItem('session_id')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('session_id', id)
    }
    setSessionId(id)

    setCurrentWord(dailyWord)
  }, [])

  const submitScore = async () => {
    // --- ADD NULL CHECK ---
    if (!supabase) {
        console.error("Supabase client is not initialized. Cannot submit score.");
        toast({
            description: "Cannot submit score: Configuration error.",
            variant: "destructive",
        });
        return; // Exit if supabase is null
    }
    // --- END NULL CHECK ---

    // Now safe to use supabase
    const { error } = await supabase
      .from('game_scores') // Ensure this table exists in your *new* Supabase instance
      .insert([{ session_id: sessionId, score, timestamp: new Date() }])

    if (error) {
      console.error('Error submitting score:', error)
       toast({ description: `Score submission failed: ${error.message}`, variant: "destructive" });
    } else {
      toast({ description: 'Score submitted!' })
    }
  }

  const playAudio = async (audioUrl: string) => {
     // --- ADD NULL CHECK ---
     if (!supabase) {
        console.error("Supabase client is not initialized. Cannot play audio.");
        toast({
            description: "Cannot play audio: Configuration error.",
            variant: "destructive",
        });
        return; // Exit if supabase is null
    }
    // --- END NULL CHECK ---

    // Ensure the 'audio' bucket exists in your *new* Supabase instance's Storage
    // and has appropriate access policies (e.g., public read access for these files)
    const { data, error } = await supabase
      .storage
      .from('audio') // Assuming your bucket is named 'audio'
      .download(audioUrl) // audioUrl should be the path *within* the bucket

    if (error) {
      console.error('Error fetching audio:', error)
      toast({ description: `Could not load audio: ${error.message}`, variant: "destructive" });
      return
    }

    // Check if data is actually a Blob
    if (data instanceof Blob) {
        const audioBlobUrl = URL.createObjectURL(data);
        const audio = new Audio(audioBlobUrl);
        audio.play()
            .then(() => {
                // Optional: Clean up the object URL after playing finishes or after some time
                // audio.onended = () => URL.revokeObjectURL(audioBlobUrl);
            })
            .catch(playError => {
                console.error("Error playing audio:", playError);
                toast({ description: "Could not play audio.", variant: "destructive" });
            });
        // Consider revoking the object URL later to free up memory
        // setTimeout(() => URL.revokeObjectURL(audioBlobUrl), 60000); // Example: revoke after 1 minute
    } else {
         console.error('Downloaded audio data is not a Blob:', data);
         toast({ description: "Received invalid audio data.", variant: "destructive" });
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // This component seems to use a hardcoded word "ephemeral".
    // If this component is actually used, you might want it to fetch dynamic words too.
    if (userInput.toLowerCase() === currentWord.word.toLowerCase()) {
      setScore(score + 1)
      toast({ description: 'Correct! Well done!' })
    } else {
      toast({ description: `Incorrect. The word was "${currentWord.word}".` , variant: "destructive"}) // Show correct word on incorrect
    }

    setUserInput('')
    // If this component should cycle words, logic is needed here.
    // setCurrentWord(dailyWord) // Resets to the same word
    inputRef.current?.focus()
  }

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else if (key.length === 1 && key.match(/[a-z]/i)) { // Allow letters only
      setUserInput(prev => prev + key.toLowerCase()) // Store as lowercase for easier comparison
    } else if (key === 'submit') { // Handle submit from virtual keyboard if needed
        handleSubmit();
    }
  }

  // NOTE: This component seems separate from the main game logic in /game/page.tsx
  // It uses a hardcoded word ('ephemeral'), manages its own score,
  // and references a 'game_scores' table and 'audio' storage bucket.
  // Ensure these exist and are configured in your NEW Supabase instance if this
  // component is actively used and not just old code.

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-2">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold mb-4 text-center">Spelling B- Game (Index Page)</h1> {/* Added clarification */}

          <Card className="mb-4 p-4"> {/* Added padding to inner card */}
              <div className="text-lg font-semibold mb-1">{currentWord.definition}</div> {/* Show definition */}
              {/* <div className="text-sm mb-4">{currentWord.definition}</div> */}
              <Button variant="outline" onClick={() => playAudio(currentWord.audioUrl)}>
                <Volume2 className="mr-2 h-5 w-5" /> Play Audio for "{currentWord.word}"
              </Button>
          </Card>

          {/* Input Display Area */}
            <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 shadow-inner mb-4">
                 <p className="text-2xl text-center font-mono text-gray-800 min-h-[40px] tracking-widest">
                    {userInput || <span className="text-gray-400">Spell the word</span>}
                </p>
            </div>


           {/* Removed the readOnly input field as typing is handled by virtual keyboard */}
           {/* <form onSubmit={handleSubmit} className="flex items-center space-x-2 mb-4"> */}
            {/* Input field removed */}
           {/* </form> */}

          <div className="flex justify-between items-center mb-4"> {/* Use justify-between */}
             <div className="text-lg font-medium text-gray-700">Score: {score}</div>
             {/* Maybe add word count or other info here */}
          </div>

          {/* On-screen keyboard (Simplified from /game/page.tsx) */}
           {/* Consider extracting the Keyboard into a reusable component if needed elsewhere */}
          <div className="space-y-2">
            {[
              ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
              ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
              ['z', 'x', 'c', 'v', 'b', 'n', 'm']
            ].map((row, i) => (
              <div key={i} className="flex justify-center space-x-1"> {/* Reduced space */}
                {row.map(key => (
                  <Button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-8 h-10 text-base bg-gray-200 text-gray-700 hover:bg-gray-300 rounded" // Adjusted size/rounding
                    aria-label={`Key ${key}`}
                  >
                    {key.toUpperCase()}
                  </Button>
                ))}
              </div>
            ))}
            <div className="flex justify-center space-x-1 pt-1"> {/* Added padding top */}
              <Button
                 onClick={() => handleKeyPress('backspace')}
                 className="px-4 py-2 bg-gray-300 text-gray-800 hover:bg-gray-400 rounded" // Adjusted style
                 aria-label="Backspace"
               >
                <Backspace className="h-5 w-5" />
              </Button>
              <Button
                 onClick={() => handleKeyPress('submit')} // Use the internal handler
                 className="px-6 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded font-semibold" // Adjusted style
               >
                 Submit {/* Changed from Play icon to text */}
               </Button>
            </div>
          </div>

          {/* Submit Score Button - positioned lower */}
          <div className="mt-6 text-center"> {/* Added margin top */}
             <Button onClick={submitScore} className="bg-green-500 hover:bg-green-600 text-white">
                 <Share2 className="mr-2 h-4 w-4"/> Submit Score
             </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}