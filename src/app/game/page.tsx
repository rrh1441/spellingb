// src/app/game/page.tsx

"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from "@/components/ui/use-toast" // Assuming a toast hook or component
import supabase from '@/lib/supabase'
import useIsIpad from '@/hooks/useIsIpad'

interface Word {
  id: number
  word: string
  definition: string
  audio_url: string
}

export default function SpellingGame() {
  const isIpad = useIsIpad()

  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [userInput, setUserInput] = useState('')
  const [score, setScore] = useState(0)
  const [correctWordCount, setCorrectWordCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)
  const [selectedWords, setSelectedWords] = useState<Word[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const audioRef = useRef<HTMLAudioElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const getTodayDate = (): string => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const saveGameData = useCallback((finalScore: number, correctWords: number, timeLeftValue: number) => {
    const today = getTodayDate()
    localStorage.setItem('lastPlayedDate', today)
    localStorage.setItem('lastScore', finalScore.toString())
    localStorage.setItem('lastCorrectWordCount', correctWords.toString())
    localStorage.setItem('lastTimeLeft', timeLeftValue.toString())
    console.log(`Game Data Saved: Score=${finalScore}, CorrectWords=${correctWords}, TimeLeft=${timeLeftValue}`)
  }, [])

  const loadGameData = useCallback(() => {
    try {
      const storedScore = localStorage.getItem('lastScore')
      const storedCorrectWords = localStorage.getItem('lastCorrectWordCount')
      const storedTimeLeft = localStorage.getItem('lastTimeLeft')
      console.log(`Loaded Game Data: Score=${storedScore}, CorrectWords=${storedCorrectWords}, TimeLeft=${storedTimeLeft}`)

      if (storedScore) setScore(parseInt(storedScore, 10))
      if (storedCorrectWords) {
        const correctWords = parseInt(storedCorrectWords, 10)
        setCorrectWordCount(correctWords)
      }
      if (storedTimeLeft) {
        setTimeLeft(parseInt(storedTimeLeft, 10))
      }
    } catch (error) {
      console.error('Error loading game data:', error)
      // toast call without adding it to deps, stable function
      toast({
        description: 'Failed to load previous game data. Starting fresh.',
        variant: "destructive"
      })
      localStorage.removeItem('lastPlayedDate')
      localStorage.removeItem('lastScore')
      localStorage.removeItem('lastCorrectWordCount')
      localStorage.removeItem('lastTimeLeft')
    }
  }, [toast]) // toast is stable, but per warning, remove it from deps. Let's just remove toast from deps.

// Remove toast from deps by not including it. Toast is stable and doesn't need to be a dep.
// We'll do:
const stableLoadGameData = useCallback(() => {
  try {
    const storedScore = localStorage.getItem('lastScore')
    const storedCorrectWords = localStorage.getItem('lastCorrectWordCount')
    const storedTimeLeft = localStorage.getItem('lastTimeLeft')
    console.log(`Loaded Game Data: Score=${storedScore}, CorrectWords=${storedCorrectWords}, TimeLeft=${storedTimeLeft}`)

    if (storedScore) setScore(parseInt(storedScore, 10))
    if (storedCorrectWords) {
      const correctWords = parseInt(storedCorrectWords, 10)
      setCorrectWordCount(correctWords)
    }
    if (storedTimeLeft) {
      setTimeLeft(parseInt(storedTimeLeft, 10))
    }
  } catch (error) {
    console.error('Error loading game data:', error)
    toast({
      description: 'Failed to load previous game data. Starting fresh.',
      variant: "destructive"
    })
    localStorage.removeItem('lastPlayedDate')
    localStorage.removeItem('lastScore')
    localStorage.removeItem('lastCorrectWordCount')
    localStorage.removeItem('lastTimeLeft')
  }
// no deps here, no toast in deps
}, [])

const hasUserPlayedToday = useCallback((): boolean => {
  const lastPlayedDate = localStorage.getItem('lastPlayedDate')
  const today = getTodayDate()
  return lastPlayedDate === today
}, [])

const handleGameEnd = useCallback(() => {
  setScore(prev => {
    const finalScore = prev + timeLeft
    saveGameData(finalScore, correctWordCount, timeLeft)
    return finalScore
  })
  setGameState('finished')
}, [timeLeft, correctWordCount, saveGameData])

// Fetch words from Supabase with typing
useEffect(() => {
  const fetchWords = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from<Word>('audio_files')
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
      const validWords = data.filter((w: Word) => w.word && w.definition && w.audio_url)
      if (validWords.length < 3) {
        console.error('Not enough valid words in the database.')
        toast({
          description: 'Insufficient words in the database.',
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }
      setSelectedWords(validWords.slice(0, 3))
    }
    setIsLoading(false)
  }

  fetchWords()
}, [toast]) // remove toast from dependency. It's stable. We'll remove it from here as well.
// Actually let's remove toast from here. It's stable and does not need to be a dependency.
// Just remove toast from the deps array entirely:
 // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  const fetchWords = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from<Word>('audio_files')
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
      const validWords = data.filter((w: Word) => w.word && w.definition && w.audio_url)
      if (validWords.length < 3) {
        console.error('Not enough valid words in the database.')
        toast({
          description: 'Insufficient words in the database.',
          variant: "destructive"
        })
        setIsLoading(false)
        return
      }
      setSelectedWords(validWords.slice(0, 3))
    }
    setIsLoading(false)
  }

  fetchWords()
}, []) // no toast dependency needed.

useEffect(() => {
  const played = hasUserPlayedToday()
  setHasPlayedToday(played)
  if (played) {
    stableLoadGameData()
    setTimeout(() => {
      setGameState('finished')
    }, 100)
  }
}, [hasUserPlayedToday, stableLoadGameData])

// Timer effect depends on gameState, timeLeft, handleGameEnd
useEffect(() => {
  let timer: NodeJS.Timeout
  if (gameState === 'playing' && timeLeft > 0) {
    timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
  } else if (timeLeft === 0 && gameState === 'playing') {
    handleGameEnd()
  }
  return () => clearTimeout(timer)
}, [gameState, timeLeft, handleGameEnd])

const handleSubmit = () => {
  if (currentWordIndex >= selectedWords.length) return

  const currentWord = selectedWords[currentWordIndex]
  const isCorrect = userInput.trim().toLowerCase() === currentWord.word.trim().toLowerCase()

  if (isCorrect) {
    setCorrectWordCount(prev => prev + 1)
    setScore(prev => prev + 50)
  } else {
    // No popup
  }

  const nextIndex = currentWordIndex + 1
  if (nextIndex < selectedWords.length && timeLeft > 0) {
    setCurrentWordIndex(nextIndex)
    setUserInput('')
    if (isIpad && inputRef.current) {
      inputRef.current.focus()
    }

    if (audioRef.current && selectedWords[nextIndex]) {
      audioRef.current.src = selectedWords[nextIndex].audio_url
      audioRef.current.load()
      audioRef.current.play().catch(err => console.error('Audio play error:', err))
    }
  } else {
    handleGameEnd()
  }
}

const startGame = () => {
  if (hasPlayedToday) {
    toast({
      description: 'You have already played today. Come back tomorrow!',
      variant: "destructive"
    })
    return
  }

  setGameState('playing')
  setTimeLeft(60)
  setUserInput('')
  setScore(0)
  setCorrectWordCount(0)
  setCurrentWordIndex(0)

  if (isIpad && inputRef.current) {
    inputRef.current.focus()
    console.log('Input focused on iPad at startGame')
  }

  if (audioRef.current && selectedWords[0]) {
    audioRef.current.src = selectedWords[0].audio_url
    audioRef.current.load()
    audioRef.current.play().catch(error => {
      console.error('Failed to play audio:', error)
    })
  }
}

// Remove handleKeyPress since it's never used
// const handleKeyPress = (key: string) => {
//   // Not used, removing to fix the unused var error
// }

if (isLoading) {
  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <p style={{fontSize:'1rem',color:'#6B7280'}}>Loading game...</p>
    </div>
  )
}

return (
  <div style={{minHeight:'100vh',backgroundColor:'#f9fafb',display:'flex',justifyContent:'center',alignItems:'center',padding:'1rem'}}>
    {isIpad && (
      <div style={{position:'absolute',top:0,left:0,backgroundColor:'#FEF3C7',color:'#B45309',padding:'0.5rem'}}>
        iPad Detected
      </div>
    )}
    <div style={{width:'100%',maxWidth:'400px',backgroundColor:'#ffffff',borderRadius:'0.75rem',boxShadow:'0 1px 3px rgba(0,0,0,0.1)',padding:'1rem'}}>
      <h1 style={{fontSize:'1.875rem',fontWeight:'bold',textAlign:'center',color:'#1F2937',marginBottom:'1rem'}}>Spelling B-</h1>

      {gameState === 'ready' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{textAlign:'center',color:'#4B5563'}}>
            Test your spelling skills on everyday words.<br/>
            Autocorrect won&apos;t save you!
          </p>
          <button
            onClick={startGame}
            style={{width:'100%',backgroundColor:'#3B82F6',color:'#ffffff',padding:'0.5rem',borderRadius:'0.5rem'}}
          >
            Start Game
          </button>
          {hasPlayedToday && (
            <p style={{textAlign:'center',fontSize:'1.5rem',fontWeight:'bold',color:'#1F2937',marginTop:'1rem'}}>
              Play again tomorrow!
            </p>
          )}
        </div>
      )}

      {gameState === 'playing' && selectedWords.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'1rem',fontWeight:'500',color:'#374151'}}>Score: {score}</span>
            <span style={{fontSize:'1rem',fontWeight:'500',color:'#374151'}}>Time Left: {timeLeft}s</span>
          </div>

          <p style={{textAlign:'center',fontWeight:'500',color:'#374151',minHeight:'3rem'}}>
            {selectedWords[currentWordIndex]?.definition}
          </p>

          <button
            onClick={() => {
              if (audioRef.current && selectedWords[currentWordIndex]) {
                audioRef.current.src = selectedWords[currentWordIndex].audio_url
                audioRef.current.load()
                audioRef.current.play().catch(err => console.error(err))
              }
            }}
            style={{backgroundColor:'#F3F4F6',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'0.5rem',padding:'0.5rem',boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}
          >
            Play Pronunciation
          </button>
          <audio ref={audioRef} />

          <div style={{backgroundColor:'#F3F4F6',padding:'1rem',borderRadius:'0.5rem',border:'1px solid #D1D5DB',boxShadow:'inset 0 1px 2px rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:'1.5rem',textAlign:'center',fontWeight:'bold',color:'#1F2937',minHeight:'40px'}}>
              {userInput || 'Type your answer'}
            </p>
          </div>

          {isIpad ? (
            <>
              <input
                ref={inputRef}
                type="text"
                style={{width:'100%',padding:'0.5rem',border:'1px solid #D1D5DB',borderRadius:'0.5rem'}}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Tap here and start typing..."
              />
              <button
                onClick={() => {
                  inputRef.current?.focus()
                  console.log('Manual tap to focus triggered')
                }}
                style={{marginTop:'0.5rem',backgroundColor:'#93C5FD',color:'#1E3A8A',padding:'0.5rem',borderRadius:'0.5rem'}}
              >
                Click for keyboard
              </button>
            </>
          ) : (
            <>
              {/* Hidden input for non-iPads */}
              <input
                ref={inputRef}
                type="text"
                style={{position:'absolute',left:'-9999px'}}
                value={userInput}
                readOnly
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
              />
              {/* Here you could put your custom on-screen keyboard logic for non-iPads if needed */}
            </>
          )}

          <button
            onClick={handleSubmit}
            style={{width:'100%',backgroundColor:'#10B981',color:'#ffffff',padding:'0.5rem',borderRadius:'0.5rem'}}
          >
            Submit
          </button>
        </div>
      )}

      {gameState === 'finished' && (
        <div style={{textAlign:'center',display:'flex',flexDirection:'column',gap:'1rem'}}>
          <p style={{fontSize:'1.875rem',fontWeight:'bold',color:'#1F2937'}}>
            {correctWordCount > 0 ? 'Congratulations!' : 'Better luck next time!'}
          </p>
          <p style={{fontSize:'1rem',color:'#374151'}}>
            You spelled {correctWordCount} words correctly.
          </p>
          <p style={{fontSize:'1rem',color:'#374151'}}>
            Total Score: {score} points (with time bonus)
          </p>
          <p style={{fontSize:'1rem',color:'#374151'}}>
            Play again tomorrow!
          </p>
        </div>
      )}
    </div>
  </div>
)
}
