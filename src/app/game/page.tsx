// src/app/game/page.tsx

"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, Play, Share2, X } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import supabase from '@/lib/supabase'
import useIsIpad from '@/hooks/useIsIpad' // Detect if device is iPad
import { formatInTimeZone } from 'date-fns-tz'

interface Word {
  id: number
  word: string
  definition: string
  audio_url: string
}

// Helper function to seed a random number generator
const seedRandom = (seed: number): () => number => {
  let value = seed
  return () => {
    // LCG parameters
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

// Deterministic Fisher-Yates Shuffle
const deterministicShuffle = (array: Word[], seed: number): Word[] => {
  const shuffled = [...array]
  const rand = seedRandom(seed)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Get today's date in 'YYYY-MM-DD' format according to Pacific Time
const getTodayDate = (): string => {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  const formatter = new Intl.DateTimeFormat('en-CA', options) // 'YYYY-MM-DD'
  return formatter.format(now)
}

export default function SpellingGame() {
  // Define the total game time in seconds
  const TOTAL_TIME = 60

  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [userInput, setUserInput] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [selectedWords, setSelectedWords] = useState<Word[]>([])
  const [score, setScore] = useState(0)
  const [correctWordCount, setCorrectWordCount] = useState<number>(0)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)
  const [attempts, setAttempts] = useState<string[]>([]) // Store user's attempts for each word
  const audioRef = useRef<HTMLAudioElement>(null)

  const isIpad = useIsIpad()
  const [showIpadKeyboard, setShowIpadKeyboard] = useState(false)
  const [showAnswersModal, setShowAnswersModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Function to get LA midnight UTC date
  const getLaMidnightUtc = (laDateString: string): Date => {
    // Local midnight in LA (no offset)
    const localDateStr = `${laDateString}T00:00:00`
    // Determine LA offset for this date
    const offsetString = formatInTimeZone(new Date(localDateStr), 'America/Los_Angeles', 'XXX')
    // Create full ISO string with LA offset
    const laMidnightLocalISO = `${laDateString}T00:00:00${offsetString}`
    // Construct a Date (UTC) from this string
    return new Date(laMidnightLocalISO)
  }

  // Select three words for "today"
  const getTodayWords = useCallback((wordList: Word[]): Word[] => {
    const referenceDate = new Date('2023-01-01')
    const laDateString = getTodayDate()
    const laMidnightUtc = getLaMidnightUtc(laDateString)

    const diffTime = laMidnightUtc.getTime() - referenceDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    const shuffledWords = deterministicShuffle(wordList, diffDays)
    return [
      shuffledWords[0],
      shuffledWords[1],
      shuffledWords[2]
    ]
  }, [])

  // Check if user played today based on LA date
  const hasUserPlayedToday = useCallback((): boolean => {
    const lastPlayedDate = localStorage.getItem('lastPlayedDate')
    const today = getTodayDate()
    return lastPlayedDate === today
  }, [])

  // 1) Store attempts and final score in localStorage
  const saveGameData = useCallback((finalScore: number, correctWords: number, timeLeftValue: number) => {
    const today = getTodayDate()
    localStorage.setItem('lastPlayedDate', today)
    localStorage.setItem('lastScore', finalScore.toString())
    localStorage.setItem('lastCorrectWordCount', correctWords.toString())
    localStorage.setItem('lastTimeLeft', timeLeftValue.toString())
    // Also store attempts to ensure the "Check Right Answers" modal is correct after refresh
    localStorage.setItem('lastAttempts', JSON.stringify(attempts))

    console.log(
      `Game Data Saved: Score=${finalScore}, CorrectWords=${correctWords}, TimeLeft=${timeLeftValue}, attempts=${attempts}`
    )
  }, [attempts])

  // 2) Load final score and attempts from localStorage
  const loadGameData = useCallback(() => {
    try {
      const storedScore = localStorage.getItem('lastScore')
      const storedCorrectWords = localStorage.getItem('lastCorrectWordCount')
      const storedTimeLeft = localStorage.getItem('lastTimeLeft')
      const storedAttempts = localStorage.getItem('lastAttempts')

      console.log(
        `Loaded Game Data: Score=${storedScore}, CorrectWords=${storedCorrectWords}, TimeLeft=${storedTimeLeft}, Attempts=${storedAttempts}`
      )

      if (storedScore) {
        setScore(parseInt(storedScore, 10))
      }
      if (storedCorrectWords) {
        const correctWords = parseInt(storedCorrectWords, 10)
        setCorrectWordCount(correctWords)
      }
      if (storedTimeLeft) {
        setTimeLeft(parseInt(storedTimeLeft, 10))
      }
      // If we have stored attempts, restore them
      if (storedAttempts) {
        setAttempts(JSON.parse(storedAttempts))
      }
    } catch (error) {
      console.error('Error loading game data:', error)
      toast({
        description: 'Failed to load your previous game data. Starting a new game.',
        variant: "destructive"
      })
      localStorage.removeItem('lastPlayedDate')
      localStorage.removeItem('lastScore')
      localStorage.removeItem('lastCorrectWordCount')
      localStorage.removeItem('lastTimeLeft')
      localStorage.removeItem('lastAttempts')
    }
  }, [toast])

  // 3) Handle game end
  const handleGameEnd = useCallback(() => {
    // Add time bonus to final score
    setScore(prevScore => {
      const finalScore = prevScore + timeLeft
      saveGameData(finalScore, correctWordCount, timeLeft)
      return finalScore
    })
    setGameState('finished')
  }, [timeLeft, correctWordCount, saveGameData])

  // 4) Main submit function, record attempt
  const handleSubmit = useCallback(() => {
    if (currentWordIndex >= selectedWords.length) return

    const currentWord = selectedWords[currentWordIndex]
    const userAttempt = userInput.trim().toLowerCase()
    const isCorrect = userAttempt === currentWord.word.trim().toLowerCase()

    // Record the attempt in the array
    setAttempts(prev => {
      const newArr = [...prev]
      newArr[currentWordIndex] = userInput.trim()
      return newArr
    })

    if (isCorrect) {
      setCorrectWordCount(prev => prev + 1)
      setScore(prev => prev + 50)
    }

    const nextIndex = currentWordIndex + 1
    if (nextIndex < selectedWords.length && timeLeft > 0) {
      setCurrentWordIndex(nextIndex)
      setUserInput('')
      // Auto-play next word
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = selectedWords[nextIndex].audio_url
          audioRef.current.load()
          audioRef.current.play().catch(err => {
            console.error('Failed to play audio:', err)
          })
        }
      }, 500)
    } else {
      handleGameEnd()
    }
  }, [currentWordIndex, selectedWords, timeLeft, handleGameEnd, userInput])

  // 5) Fetch words from supabase on mount
  useEffect(() => {
    const fetchWords = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .order('id', { ascending: true })

      if (error) {
        console.error('Error fetching words:', error)
        toast({
          description: 'Failed to load words. Please refresh.',
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }

      if (data) {
        const validWords = data.filter(word => word.word && word.definition && word.audio_url)
        if (validWords.length < 3) {
          console.error('Not enough valid words in the database.')
          toast({
            description: 'Insufficient words in the database.',
            variant: "destructive"
          })
          setIsLoading(false)
          return
        }
        const todaysWords = getTodayWords(validWords)
        setSelectedWords(todaysWords)
        setAttempts(Array(todaysWords.length).fill(''))
        console.log(`Selected Words for Today: ${todaysWords.map(w => w.word).join(', ')}`)
      }
      setIsLoading(false)
    }

    fetchWords()
  }, [getTodayWords, toast])

  // 6) Check if user has played today
  useEffect(() => {
    const played = hasUserPlayedToday()
    setHasPlayedToday(played)
    if (played) {
      loadGameData()
      // Force game to finished after loading stored data
      setTimeout(() => {
        setGameState('finished')
      }, 100)
    }
  }, [hasUserPlayedToday, loadGameData])

  // 7) Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
    } else if (timeLeft === 0 && gameState === 'playing') {
      handleGameEnd()
    }
    return () => clearTimeout(timer)
  }, [timeLeft, gameState, handleGameEnd])

  // 8) Keyboard events (physical)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing' && !isIpad) {
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
  }, [gameState, handleSubmit, isIpad])

  // 9) Start game
  const startGame = () => {
    if (hasPlayedToday) {
      toast({
        description: 'You have already played today. Play again tomorrow!',
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
    setAttempts(Array(selectedWords.length).fill(''))

    // Auto-play first word
    setTimeout(() => {
      if (audioRef.current && selectedWords[0]) {
        audioRef.current.src = selectedWords[0].audio_url
        audioRef.current.load()
        audioRef.current.play().catch(error => {
          console.error('Failed to play audio:', error)
        })
      }
    }, 500)
  }

  // 10) Play current audio
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

  // 11) On-screen keyboard for phone
  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      setUserInput(prev => prev.slice(0, -1))
    } else if (key === 'submit') {
      handleSubmit()
    } else {
      setUserInput(prev => prev + key)
    }
  }

  // 12) Share results
  const shareResults = async () => {
    const shareText = `I just played Spelling B-! I scored ${score} points. Can you beat that?`

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2 relative">
      <Card className="w-full max-w-lg mx-auto overflow-hidden shadow-lg bg-white rounded-xl z-10">
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
                disabled={hasPlayedToday || isLoading}
              >
                <Play className="mr-2 h-5 w-5" />
                {isLoading ? "Loading..." : "Start Game (Sound On)"}
              </Button>
              {hasPlayedToday && (
                <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                  Play again tomorrow!
                </p>
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

              {/* Phone On-Screen Keyboard (small screens, non-iPad) */}
              {!isIpad && (
                <div className="md:hidden">
                  <div className="space-y-4">
                    {[
                      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                      ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'del']
                    ].map((row, rowIndex) => (
                      <div key={rowIndex} className="flex justify-center space-x-1">
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
                        onClick={() => handleKeyPress('submit')}
                        className="w-24 h-11 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center justify-center text-xl font-semibold"
                        aria-label="Enter"
                      >
                        Enter
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* iPad-specific handling */}
              {isIpad && !showIpadKeyboard && (
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={() => setShowIpadKeyboard(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
                  >
                    Get Keyboard
                  </Button>
                </div>
              )}

              {/* iPad On-Screen Keyboard (shown after "Get Keyboard") */}
              {isIpad && showIpadKeyboard && (
                <div className="space-y-4">
                  {[
                    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'del']
                  ].map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center space-x-1">
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
                            onClick={() => handleKeyPress(key.toLowerCase())}
                            className="w-8 h-11 text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md"
                            aria-label={key}
                          >
                            {key}
                          </Button>
                        )
                      })}
                    </div>
                  ))}
                  {/* Submit Button on iPad */}
                  <div className="flex justify-center space-x-1">
                    <Button
                      onClick={() => handleKeyPress('submit')}
                      className="w-24 h-11 bg-blue-500 text-white hover:bg-blue-600 rounded-md flex items-center justify-center text-xl font-semibold"
                      aria-label="Enter"
                    >
                      Enter
                    </Button>
                  </div>
                </div>
              )}

              {/* Desktop Submit Button */}
              {!isIpad && (
                <div className="hidden md:block">
                  <Button
                    onClick={handleSubmit}
                    className="w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg font-semibold"
                  >
                    Submit
                  </Button>
                </div>
              )}
            </div>
          )}

          {gameState === 'finished' && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gray-800">
                {correctWordCount > 0 ? 'Congratulations!' : 'Better luck next time!'}
              </p>

              {/* Display Score and Message */}
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
                      <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                        Play again tomorrow!
                      </p>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Score:</p>
                      <div className="border border-red-200 p-2 rounded bg-red-50">
                        <code className="text-xl font-mono text-red-500">0 points</code>
                      </div>
                      <p className="text-center text-2xl font-bold text-gray-800 mt-4">
                        Better luck next time! Play again tomorrow!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Button to show right answers popup */}
              <Button
                onClick={() => setShowAnswersModal(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white transition-colors mt-4"
                size="lg"
              >
                Click for Right Answers
              </Button>

              {/* "Keep us ad-free" button */}
              <Button
                onClick={() => window.open('https://trysimpleapps.gumroad.com/coffee', '_blank')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white transition-colors mt-4"
                size="lg"
              >
                Keep us ad-free
              </Button>

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

      {/* Answers Modal */}
      {showAnswersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
              onClick={() => setShowAnswersModal(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-center mb-4">Your Attempts</h2>
            <div className="space-y-3">
              {selectedWords.map((word, i) => {
                const attempt = attempts[i] || ''
                const isCorrect = attempt.trim().toLowerCase() === word.word.trim().toLowerCase()
                return (
                  <div key={word.id} className="flex space-x-2 items-center">
                    <div
                      className={`flex-1 p-2 rounded border ${
                        isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                      }`}
                    >
                      <p
                        className={`text-lg font-mono ${
                          isCorrect ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {attempt || '(no attempt)'}
                      </p>
                    </div>
                    <div
                      className="flex-1 p-2 rounded border border-green-300 bg-green-50"
                    >
                      <p className="text-lg font-mono text-green-600">{word.word}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
