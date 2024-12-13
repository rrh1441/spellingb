// src/hooks/useIsIpad.ts
import { useState, useEffect } from 'react'

const useIsIpad = (): boolean => {
  const [isIpad, setIsIpad] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera?.toString() || ''

    // Detect iPadOS 13+ which reports as Mac
    const isIpadOS = /Macintosh/.test(ua) && 'ontouchend' in document

    // Traditional iPad detection
    const isiPad = /iPad/.test(ua) || isIpadOS

    setIsIpad(isiPad)
  }, [])

  return isIpad
}

export default useIsIpad
