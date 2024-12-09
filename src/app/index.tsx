"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid'
import supabase from '../lib/supabase'

// Initialize the daily word structure
const dailyWord = {
  word: 'ephemeral',
  definition: 'Lasting for a very short time.',
  audioUrl: '/ephemeral.mp3', // Default audio
}

export default function Home() {
  const [score, setScore] = useState(0)
  const [userInput, setUserInput] = useState('')
  const [currentWord, setCurrentWord] = useState(dailyWord)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Generate a session ID and set it in localStorage
    let id = localStorage.getItem('session_id')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('session_id', id)
    }
    setSessionId(id)

    // Set the daily word (in a real app, you might fetch a new word here)
    setCurrentWord(dailyWord)
  }, [])

  const submitScore = async () => {
    const { error } = await supabase
      .from('game_scores')
      .insert([{ session_id: sessionId, score, timestamp: new Date() }])

    if (error) {
      console.error('Error submitting score:', error)
    } else {
      toast({ description: 'Score submitted!' })
    }
  }

  const playAudio = async (audioUrl: string) => {
    const { data, error } = await supabase.storage.from('audio').download(audioUrl)

    if (error) {
      console.error('Error fetching audio:', error)
      return
    }

    const audioUrlObject = URL.createObjectURL(data)
    const audio = new Audio(audioUrlObject)
    audio.play()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (userInput.toLowerCase() === currentWord.word.toLowerCase()) {
      setScore(score + 1)
      toast({ description: 'Correct!' })
    } else {
      toast({ description: 'Incorrect. Try again!' })
    }

    // Reset input and pick a new word (currently resetting to the same daily word)
    setUserInput('')
    setCurrentWord(dailyWord)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Spelling B- Game</h1>

      <Card className="mb-4">
        <CardContent>
          <div className="text-lg font-semibold">{currentWord.word}</div>
          <div className="text-sm mb-4">{currentWord.definition}</div>
          <Button variant="outline" onClick={() => playAudio(currentWord.audioUrl)}>
            <Volume2 className="mr-2" /> Play Audio
          </Button>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex items-center space-x-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className="p-2 border border-gray-300 rounded-md"
          placeholder="Spell the word"
        />
        <Button type="submit">
          <Play className="mr-2" /> Submit
        </Button>
      </form>

      <div className="flex space-x-4 mb-4">
        <div>Score: {score}</div>
      </div>

      <AnimatePresence>
        <motion.div
          className="fixed bottom-4 right-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Button onClick={submitScore} className="flex items-center space-x-2">
            <Share2 /> Submit Score
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
