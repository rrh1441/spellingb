// src/hooks/useIsIpad.tsx
import { useState, useEffect } from 'react'

const useIsIpad = (): boolean => {
  const [isIpad, setIsIpad] = useState(false)

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || ''
    // Detect iPad or iPadOS
    const iPad = /iPad/.test(userAgent) || (
      /Macintosh/.test(userAgent) &&
      'ontouchend' in document
    )
    setIsIpad(iPad)
    console.log(`Device is iPad: ${iPad}`)
  }, [])

  return isIpad
}

export default useIsIpad
