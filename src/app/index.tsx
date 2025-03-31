// src/app/index.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
// Removed unused 'Play' icon import
import { Volume2, Share2, SkipBackIcon as Backspace } from 'lucide-react'
// Removed unused 'motion' and 'AnimatePresence' imports
import { toast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid'
import supabase from '../lib/supabase'

const dailyWord = {
  word: 'ephemeral',
  definition: 'Lasting for a very short time.',
  audioUrl: 'ephemeral.mp3',
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
    if (!supabase) {
        console.error("Supabase client is not initialized. Cannot submit score.");
        toast({
            description: "Cannot submit score: Configuration error.",
            variant: "destructive",
        });
        return;
    }

    const { error } = await supabase
      .from('game_scores')
      .insert([{ session_id: sessionId, score, timestamp: new Date() }])

    if (error) {
      console.error('Error submitting score:', error)
       toast({ description: `Score submission failed: ${error.message}`, variant: "destructive" });
    } else {
      toast({ description: 'Score submitted!' })
    }
  }

  const playAudio = async (audioUrl: string) => {
     if (!supabase) {
        console.error("Supabase client is not initialized. Cannot play audio.");
        toast({
            description: "Cannot play audio: Configuration error.",
            variant: "destructive",
        });
        return;
    }

    const { data, error } = await supabase
      .storage
      .from('audio')
      .download(audioUrl)

    if (error) {
      console.error('Error fetching audio:', error)
      toast({ description: `Could not load audio: ${error.message}`, variant: "destructive" });
      return
    }

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

    if (userInput.toLowerCase() === currentWord.word.toLowerCase()) {
      setScore(score + 1)
      toast({ description: 'Correct! Well done!' })
    } else {
      toast({ description: `Incorrect. The word was "${currentWord.word}".` , variant: "destructive"})
    }

    setUserInput('')
    inputRef.current?.focus()
  }

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else if (key.length === 1 && key.match(/[a-z]/i)) {
      setUserInput(prev => prev + key.toLowerCase())
    } else if (key === 'submit') {
        handleSubmit();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-2">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold mb-4 text-center">Spelling B- Game (Index Page)</h1>

          <Card className="mb-4 p-4">
              <div className="text-lg font-semibold mb-1">{currentWord.definition}</div>
              <Button variant="outline" onClick={() => playAudio(currentWord.audioUrl)}>
                <Volume2 className="mr-2 h-5 w-5" /> Play Audio for &quot;{currentWord.word}&quot; {/* Escaped quotes */}
              </Button>
          </Card>

            <div className="bg-gray-100 p-3 rounded-lg border border-gray-200 shadow-inner mb-4">
                 <p className="text-2xl text-center font-mono text-gray-800 min-h-[40px] tracking-widest">
                    {userInput || <span className="text-gray-400">Spell the word</span>}
                </p>
            </div>

          <div className="flex justify-between items-center mb-4">
             <div className="text-lg font-medium text-gray-700">Score: {score}</div>
          </div>

          <div className="space-y-2">
            {[
              ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
              ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
              ['z', 'x', 'c', 'v', 'b', 'n', 'm']
            ].map((row, i) => (
              <div key={i} className="flex justify-center space-x-1">
                {row.map(key => (
                  <Button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-8 h-10 text-base bg-gray-200 text-gray-700 hover:bg-gray-300 rounded"
                    aria-label={`Key ${key}`}
                  >
                    {key.toUpperCase()}
                  </Button>
                ))}
              </div>
            ))}
            <div className="flex justify-center space-x-1 pt-1">
              <Button
                 onClick={() => handleKeyPress('backspace')}
                 className="px-4 py-2 bg-gray-300 text-gray-800 hover:bg-gray-400 rounded"
                 aria-label="Backspace"
               >
                <Backspace className="h-5 w-5" />
              </Button>
              <Button
                 onClick={() => handleKeyPress('submit')}
                 className="px-6 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded font-semibold"
               >
                 Submit
               </Button>
            </div>
          </div>

          <div className="mt-6 text-center">
             <Button onClick={submitScore} className="bg-green-500 hover:bg-green-600 text-white">
                 <Share2 className="mr-2 h-4 w-4"/> Submit Score
             </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}