"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2 } from 'lucide-react' // Removed Backspace icon
import { toast } from "@/components/ui/use-toast"
import supabase from '@/lib/supabase'

interface Word {
  id: number
  word: string
  definition: string
  audio_url: string
}

export default function SpellingGame() {
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready')
  const [userInput, setUserInput] = useState('')
  const [currentWord, setCurrentWord] = useState<Word | null>(null)
  const [wordsList, setWordsList] = useState<Word[]>([])
  const [remainingWords, setRemainingWords] = useState<Word[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
      
      if (error) {
        console.error('Error fetching words:', error)
        toast({ 
          description: 'Failed to load words. Please refresh.',
          variant: "destructive"
        })
        return
      }

      if (data) {
        const validWords = data.filter(word => word.word && word.definition && word.audio_url)
        const shuffled = shuffleArray([...validWords])
        setWordsList(shuffled)
        setRemainingWords(shuffled)
      }
      setIsLoading(false)
    }

    fetchWords()
  }, [])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    } else if (timeLeft === 0 && gameState === 'playing') {
      setGameState('lost')
    }
    return () => clearTimeout(timer)
  }, [timeLeft, gameState])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        if (e.key === 'Backspace') {
          setUserInput(prev => prev.slice(0, -1))
        } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
          setUserInput(prev => prev + e.key)
        } else if (e.key === 'Enter') {
          handleSubmit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  const shuffleArray = <T,>(array: T[]): T[] => {
    let currentIndex = array.length
    let randomIndex: number
    const newArray = [...array]

    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex--
      
      [newArray[currentIndex], newArray[randomIndex]] = [
        newArray[randomIndex],
        newArray[currentIndex]
      ]
    }

    return newArray
  }

  const startGame = () => {
    setGameState('playing')
    setTimeLeft(30)
    setUserInput('')
    
    const word = remainingWords[0]
    if (word) {
      setCurrentWord(word)
      setRemainingWords(prev => prev.slice(1))
      
      if (inputRef.current) inputRef.current.focus()
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = word.audio_url
          audioRef.current.load()
          audioRef.current.play().catch(error => {
            console.error('Failed to play audio:', error)
          })
        }
      }, 500)
    } else {
      const shuffled = shuffleArray([...wordsList])
      setRemainingWords(shuffled.slice(1))
      setCurrentWord(shuffled[0])
      
      setTimeout(() => {
        if (audioRef.current && shuffled[0]) {
          audioRef.current.src = shuffled[0].audio_url
          audioRef.current.load()
          audioRef.current.play().catch(error => {
            console.error('Failed to play audio:', error)
          })
        }
      }, 500)
    }
  }

  const playAudio = () => {
    if (!currentWord?.audio_url || !audioRef.current) return

    audioRef.current.src = currentWord.audio_url
    audioRef.current.load()
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error)
      toast({ 
        description: 'Failed to play audio. Please try again.',
        variant: "destructive"
      })
    })
  }

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else {
      setUserInput(prev => prev + key)
    }
  }

  const handleSubmit = () => {
    if (!currentWord) return

    const isCorrect = userInput.trim().toLowerCase() === currentWord.word.trim().toLowerCase()

    if (isCorrect) {
      setGameState('won')
      toast({ description: 'Correct! Well done!' })
    } else {
      setGameState('lost')
      toast({ 
        description: `Incorrect. The word was "${currentWord.word}"`,
        variant: "destructive"
      })
    }
  }

  const shareResults = async () => {
    const shareText = `I just played Spelling B-! ${gameState === 'won' ? 'I spelled' : 'The word was'} "${currentWord?.word}". Can you beat that? #SpellingBee`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Spelling B- Results',
          text: shareText,
          url: window.location.href,
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        toast({
          title: "Copied to clipboard!",
          description: "Share your results with friends.",
        })
      }).catch((err) => {
        console.error('Failed to copy: ', err)
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading game...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl">
        <CardContent className="p-4">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Spelling B-</h1>
          
          {/* Game States */}
          {gameState === 'ready' && (
            <div className="space-y-4">
              <p className="text-center text-gray-600">
                Test your spelling skills on everyday words.
                <br />
                Autocorrect won&apos;t save you!
              </p>
              <Button 
                onClick={startGame} 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors" 
                size="lg"
              >
                <Play className="mr-2 h-5 w-5" /> Start Game
              </Button>
            </div>
          )}

          {gameState === 'playing' && currentWord && (
            <div className="space-y-4">
              {/* Definition */}
              <div className="min-h-[3rem]">
                <p className="text-center font-medium text-gray-700">
                  {currentWord.definition}
                </p>
              </div>
              
              {/* Audio Button */}
              <div className="flex justify-center">
                <Button 
                  onClick={playAudio} 
                  variant="outline" 
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm"
                >
                  <Volume2 className="mr-2 h-5 w-5" /> Play Pronunciation
                </Button>
              </div>
              <audio ref={audioRef} />

              {/* Timer Bar */}
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                  <div 
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"
                  ></div>
                </div>
                <p className="text-center text-sm font-medium text-gray-600 mt-2">{timeLeft} seconds left</p>
              </div>

              {/* User Input Display */}
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                <p className="text-2xl text-center font-bold text-gray-800 min-h-[40px]">
                  {userInput || 'Type your answer'}
                </p>
              </div>
              
              {/* Hidden Input for Accessibility */}
              <input
                ref={inputRef}
                type="text"
                className="sr-only"
                value={userInput}
                readOnly
                onFocus={(e) => e.target.blur()}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />

              {/* Improved iOS-like Keyboard */}
              <div className="md:hidden">
                <div className="space-y-2">
                  {[
                    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'del']
                  ].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center space-x-0.5">
                      {row.map(key => {
                        if (key === 'del') {
                          return (
                            <Button
                              key={key}
                              onClick={() => handleKeyPress('backspace')}
                              className="w-12 h-11 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md flex items-center justify-center"
                              aria-label="Delete"
                            >
                              DEL
                            </Button>
                          )
                        }
                        return (
                          <Button
                            key={key}
                            onClick={() => handleKeyPress(key)}
                            className="w-8 h-11 text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
                            aria-label={key.toUpperCase()}
                          >
                            {key.toUpperCase()}
                          </Button>
                        )
                      })}
                    </div>
                  ))}
                  {/* Submit Button on Mobile */}
                  <div className="flex justify-center space-x-0.5">
                    <Button
                      onClick={handleSubmit}
                      className="w-24 h-11 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center justify-center text-xl font-semibold"
                      aria-label="Enter"
                    >
                      Enter
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desktop Submit Button */}
              <div className="hidden md:block">
                <Button
                  onClick={handleSubmit}
                  className="w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg font-semibold"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}

          {(gameState === 'won' || gameState === 'lost') && currentWord && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {gameState === 'won' ? 'Congratulations!' : 'Better luck next time!'}
              </p>
              
              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Your spelling:</p>
                    <div className={`border p-2 rounded ${gameState === 'won' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <code className={`text-lg font-mono ${gameState === 'won' ? 'text-green-500' : 'text-red-500'}`}>{userInput}</code>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Correct spelling:</p>
                    <div className="border border-green-200 p-2 rounded bg-green-50">
                      <code className="text-lg font-mono text-green-500">{currentWord.word}</code>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Definition:</p>
                    <p className="text-md text-gray-800">{currentWord.definition}</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={startGame} 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-4" 
                size="lg"
              >
                Play Again
              </Button>
              <Button onClick={shareResults} className="w-full mt-2" variant="outline">
                <Share2 className="mr-2 h-5 w-5" /> Challenge a friend
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
