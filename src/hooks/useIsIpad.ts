// src/hooks/useIsIpad.tsx

import { useState, useEffect } from 'react'

const useIsIpad = (): boolean => {
  const [isIpad, setIsIpad] = useState(false)

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || ''

    // Check for iPad
    const iPad = /iPad/.test(userAgent) || (
      /Macintosh/.test(userAgent) &&
      'ontouchend' in document
    )
    setIsIpad(iPad)
  }, [])

  return isIpad
}

export default useIsIpad
