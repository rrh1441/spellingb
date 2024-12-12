"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2 } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import supabase from '@/lib/supabase'

interface Word {
  id: number
  word: string
  definition: string
  audio_url: string
}

export default function SpellingGame() {
  // Define the total game time in seconds
  const TOTAL_TIME = 60

  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [userInput, setUserInput] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [selectedWords, setSelectedWords] = useState<Word[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [correctWordCount, setCorrectWordCount] = useState(0)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Function to select three words based on the current date
  const getTodayWords = useCallback((wordList: Word[]): Word[] => {
    const referenceDate = new Date('2023-01-01')
    const today = new Date()
    const diffTime = today.getTime() - referenceDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const offset = (diffDays * 3) % wordList.length
    return [
      wordList[offset],
      wordList[(offset + 1) % wordList.length],
      wordList[(offset + 2) % wordList.length]
    ]
  }, [])

  // Check if user has played today
  const hasUserPlayedToday = useCallback((): boolean => {
    const lastPlayedDate = localStorage.getItem('lastPlayedDate')
    const today = getTodayDate()
    return lastPlayedDate === today
  }, [])

  // Save score to localStorage
  const saveScore = useCallback(() => {
    const today = getTodayDate()
    localStorage.setItem('lastPlayedDate', today)
    localStorage.setItem('lastScore', score.toString())
  }, [score])

  // Load score from localStorage
  const loadScore = useCallback(() => {
    const storedScore = localStorage.getItem('lastScore')
    if (storedScore) {
      setScore(parseInt(storedScore, 10))
    }
  }, [])

  // Function to handle game end
  const handleGameEnd = useCallback(() => {
    if (correctWordCount > 0) {
      const timeBonus = timeLeft * 1 // Time Bonus = Remaining Time × 1 point
      const finalScore = score + timeBonus
      setScore(finalScore)
      setGameState('finished')
      saveScore()
      toast({ 
        description: `Time's up! You scored ${finalScore} points.`,
        variant: "success"
      })
    } else {
      setScore(0)
      setGameState('finished')
      saveScore()
      toast({ 
        description: `Time's up! You scored 0 points.`,
        variant: "destructive"
      })
    }
  }, [correctWordCount, timeLeft, score, saveScore])

  // Function to handle user submission
  const handleSubmit = useCallback(() => {
    if (currentWordIndex >= selectedWords.length) return

    const currentWord = selectedWords[currentWordIndex]
    const isCorrect = userInput.trim().toLowerCase() === currentWord.word.trim().toLowerCase()

    if (isCorrect) {
      setScore(prev => prev + 50) // +50 points for correct word
      setCorrectWordCount(prev => prev + 1)
      toast({ description: 'Correct! +50 points.' })
    } else {
      toast({ 
        description: `Incorrect. The word was "${currentWord.word}"`,
        variant: "destructive"
      })
    }

    // Move to next word
    const nextIndex = currentWordIndex + 1
    if (nextIndex < selectedWords.length && timeLeft > 0) {
      setCurrentWordIndex(nextIndex)
      setUserInput('')
      
      if (inputRef.current) inputRef.current.focus()
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = selectedWords[nextIndex].audio_url
          audioRef.current.load()
          audioRef.current.play().catch(error => {
            console.error('Failed to play audio:', error)
          })
        }
      }, 500)
    } else {
      // End game if no more words
      handleGameEnd()
    }
  }, [currentWordIndex, selectedWords, timeLeft, handleGameEnd, userInput])

  // Function to fetch words from Supabase
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
        const todaysWords = getTodayWords(shuffled)
        setSelectedWords(todaysWords)
      }
      setIsLoading(false)
    }

    fetchWords()
  }, [getTodayWords])

  // Check if user has played today
  useEffect(() => {
    const played = hasUserPlayedToday()
    setHasPlayedToday(played)
    if (played) {
      loadScore()
      setGameState('finished')
    }
  }, [hasUserPlayedToday, loadScore])

  // Timer Countdown
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    } else if (timeLeft === 0 && gameState === 'playing') {
      handleGameEnd()
    }
    return () => clearTimeout(timer)
  }, [timeLeft, gameState, handleGameEnd])

  // Handling Keyboard Inputs
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
  }, [gameState, handleSubmit])

  // Function to shuffle an array
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

  // Function to start the game
  const startGame = () => {
    if (hasPlayedToday) {
      toast({ 
        description: 'You have already played today. Come back tomorrow!',
        variant: "destructive"
      })
      return
    }

    setGameState('playing')
    setTimeLeft(TOTAL_TIME)
    setUserInput('')
    setScore(0)
    setCorrectWordCount(0)
    setCurrentWordIndex(0)

    // Load the first word
    const firstWord = selectedWords[0]
    if (firstWord) {
      setCurrentWordIndex(0)
      if (inputRef.current) inputRef.current.focus()
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = firstWord.audio_url
          audioRef.current.load()
          audioRef.current.play().catch(error => {
            console.error('Failed to play audio:', error)
          })
        }
      }, 500)
    }
  }

  // Function to play audio pronunciation
  const playAudio = () => {
    const currentWord = selectedWords[currentWordIndex]
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

  // Function to handle key presses from the on-screen keyboard
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else {
      setUserInput(prev => prev + key)
    }
  }

  // Function to share results
  const shareResults = async () => {
    const shareText = `I just played Spelling B-! I scored ${score} points. Can you beat that? #SpellingBee`
    
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
                disabled={hasPlayedToday} // Disable if already played
              >
                <Play className="mr-2 h-5 w-5" /> Start Game
              </Button>
              {hasPlayedToday && (
                <p className="text-center text-sm text-gray-500">You have already played today. Come back tomorrow!</p>
              )}
            </div>
          )}

          {gameState === 'playing' && selectedWords.length > 0 && (
            <div className="space-y-4">
              {/* Current Score and Time Left */}
              <div className="flex justify-between items-center">
                <p className="text-lg font-medium text-gray-700">Score: {score}</p>
                <p className="text-lg font-medium text-gray-700">Time Left: {timeLeft}s</p>
              </div>

              {/* Definition */}
              <div className="min-h-[3rem]">
                <p className="text-center font-medium text-gray-700">
                  {selectedWords[currentWordIndex].definition}
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
                    style={{ width: `${(timeLeft / TOTAL_TIME) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"
                  ></div>
                </div>
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
                <div className="space-y-4"> {/* Increased vertical spacing between rows */}
                  {[
                    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'del']
                  ].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center space-x-1"> {/* Increased horizontal spacing */}
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
                  <div className="flex justify-center space-x-1">
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

          {gameState === 'finished' && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {correctWordCount > 0 ? 'Congratulations!' : 'Better luck next time!'}
              </p>
              
              <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-4">
                <div className="space-y-3">
                  {correctWordCount > 0 ? (
                    <>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Correct Words:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {correctWordCount} × 50 = {correctWordCount * 50} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Time Bonus:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-lg font-mono text-green-500">
                            {timeLeft} points
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                        <div className="border border-green-200 p-2 rounded bg-green-50">
                          <code className="text-xl font-mono text-green-500">
                            {score} points
                          </code>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                      <div className="border border-red-200 p-2 rounded bg-red-50">
                        <code className="text-xl font-mono text-red-500">0 points</code>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Definition of Last Word:</p>
                    <p className="text-md text-gray-800">
                      {selectedWords[selectedWords.length - 1].definition}
                    </p>
                  </div>
                </div>
              </div>

              {/* Share Results */}
              <Button 
                onClick={shareResults} 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-4" 
                size="lg"
              >
                <Share2 className="mr-2 h-5 w-5" /> Share Results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
