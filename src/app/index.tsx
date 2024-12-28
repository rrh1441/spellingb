"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2, SkipBackIcon as Backspace } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid'
import supabase from '../lib/supabase'

const dailyWord = {
  word: 'ephemeral',
  definition: 'Lasting for a very short time.',
  audioUrl: '/ephemeral.mp3',
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
    const { data, error } = await supabase
      .storage
      .from('audio')
      .download(audioUrl)

    if (error) {
      console.error('Error fetching audio:', error)
      return
    }

    const audioUrlObject = URL.createObjectURL(data)
    const audio = new Audio(audioUrlObject)
    audio.play()
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (userInput.toLowerCase() === currentWord.word.toLowerCase()) {
      setScore(score + 1)
      toast({ description: 'Correct! Well done!' })
    } else {
      toast({ description: 'Incorrect.' })
    }

    setUserInput('')
    setCurrentWord(dailyWord)
    inputRef.current?.focus()
  }

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else {
      setUserInput(prev => prev + key)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-2">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold mb-4 text-center">Spelling B- Game</h1>

          <Card className="mb-4">
            <CardContent>
              <div className="text-lg font-semibold">{currentWord.word}</div>
              <div className="text-sm mb-4">{currentWord.definition}</div>
              <Button variant="outline" onClick={() => playAudio(currentWord.audioUrl)}>
                <Volume2 className="mr-2 h-5 w-5" /> Play Audio
              </Button>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="flex items-center space-x-2 mb-4">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              readOnly
              onFocus={(e) => e.target.blur()}
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

          {/* On-screen keyboard for mobile */}
          <div className="space-y-2 md:hidden">
            {[
              ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
              ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
              ['z', 'x', 'c', 'v', 'b', 'n', 'm']
            ].map((row, i) => (
              <div key={i} className="flex justify-center space-x-px">
                {row.map(key => (
                  <Button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-8 h-8 text-base bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    {key}
                  </Button>
                ))}
              </div>
            ))}
            <div className="flex justify-center space-x-px">
              <Button
                onClick={() => handleKeyPress('backspace')}
                className="px-3 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                <Backspace className="h-5 w-5" />
              </Button>
              <Button
                onClick={handleSubmit}
                className="px-3 py-2 bg-blue-500 text-white hover:bg-blue-600"
              >
                Submit
              </Button>
            </div>
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
        </CardContent>
      </Card>
    </div>
  )
}
