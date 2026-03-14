import { useState, useRef, useCallback, useEffect } from 'react'

// Extend Window for webkit prefix
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionConstructor | null
}

/** Detect iOS (iPhone/iPad/iPod) */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Parse spoken text into a number. Handles "twelve point five", "dash"/"skip" for missing data. */
export function parseSpokenNumber(text: string): number | null | undefined {
  const cleaned = text.trim().toLowerCase()

  // Missing data indicators
  if (['dash', 'skip', 'missing', 'no data', 'none', 'blank', 'na', 'n/a'].includes(cleaned)) {
    return null // explicit missing
  }

  // Try direct number parse first
  const directNum = cleaned.replace(/,/g, '')
  if (!isNaN(Number(directNum)) && directNum !== '') {
    return Number(directNum)
  }

  // Word-to-number mapping for common spoken numbers
  const wordMap: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90, hundred: 100,
  }

  // Handle "X point Y" pattern
  const pointMatch = cleaned.match(/^(.+?)\s+point\s+(.+)$/)
  if (pointMatch) {
    const wholePart = parseSpokenNumber(pointMatch[1]!)
    const decPart = parseSpokenNumber(pointMatch[2]!)
    if (wholePart !== undefined && wholePart !== null && decPart !== undefined && decPart !== null) {
      const decStr = decPart.toString()
      return Number(`${wholePart}.${decStr}`)
    }
  }

  // Simple word lookup
  if (wordMap[cleaned] !== undefined) {
    return wordMap[cleaned]!
  }

  // Compound like "twenty three"
  const parts = cleaned.split(/[\s-]+/)
  if (parts.length === 2) {
    const tens = wordMap[parts[0]!]
    const ones = wordMap[parts[1]!]
    if (tens !== undefined && ones !== undefined) {
      return tens + ones
    }
  }

  // Could not parse
  return undefined
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
  error: string | null
}

export function useSpeechRecognition(
  onResult: (text: string) => void,
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onResultRef = useRef(onResult)
  const interimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCommittedRef = useRef<string>('')
  const shouldRestartRef = useRef(false)
  const restartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  onResultRef.current = onResult

  const ios = isIOS()
  const isSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    // Clean up any existing instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    // iOS crashes with continuous mode — use single-shot and auto-restart with delay
    recognition.continuous = !ios
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!
        const text = result[0]!.transcript
        if (result.isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      // Clear any pending interim timeout
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current)
        interimTimeoutRef.current = null
      }

      if (finalTranscript) {
        lastCommittedRef.current = finalTranscript
        setTranscript(finalTranscript)
        onResultRef.current(finalTranscript)
      } else if (interimTranscript) {
        setTranscript(interimTranscript)
        // Auto-commit interim results after 1.5s if they never become final
        interimTimeoutRef.current = setTimeout(() => {
          if (interimTranscript && interimTranscript !== lastCommittedRef.current) {
            lastCommittedRef.current = interimTranscript
            onResultRef.current(interimTranscript)
          }
          interimTimeoutRef.current = null
        }, 1500)
      }
    }

    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' are normal during restart cycles
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech error: ${event.error}`)
        // On iOS, 'not-allowed' means microphone permission denied
        if (event.error === 'not-allowed') {
          shouldRestartRef.current = false
          setIsListening(false)
        }
      }
    }

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (shouldRestartRef.current) {
        // On iOS, add a small delay before restarting to prevent crash loops
        const delay = ios ? 300 : 0
        restartDelayRef.current = setTimeout(() => {
          restartDelayRef.current = null
          if (shouldRestartRef.current) {
            try {
              const newRecognition = new SpeechRecognition()
              newRecognition.continuous = !ios
              newRecognition.interimResults = true
              newRecognition.lang = 'en-US'
              newRecognition.onresult = recognition.onresult
              newRecognition.onerror = recognition.onerror
              newRecognition.onend = recognition.onend
              recognitionRef.current = newRecognition
              newRecognition.start()
            } catch {
              shouldRestartRef.current = false
              setIsListening(false)
            }
          }
        }, delay)
      }
    }

    shouldRestartRef.current = true
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
      setError(null)
    } catch {
      setError('Failed to start speech recognition')
      shouldRestartRef.current = false
    }
  }, [ios])

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false
    if (interimTimeoutRef.current) {
      clearTimeout(interimTimeoutRef.current)
      interimTimeoutRef.current = null
    }
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current)
      restartDelayRef.current = null
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current
      recognitionRef.current = null
      try { rec.stop() } catch { /* ignore */ }
    }
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    lastCommittedRef.current = ''
  }, [])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current)
      }
      if (restartDelayRef.current) {
        clearTimeout(restartDelayRef.current)
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }
    }
  }, [])

  return { isListening, isSupported, transcript, startListening, stopListening, clearTranscript, error }
}
