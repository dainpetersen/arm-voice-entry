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

  onResultRef.current = onResult

  const isSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
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

      if (finalTranscript) {
        setTranscript(finalTranscript)
        onResultRef.current(finalTranscript)
      } else if (interimTranscript) {
        setTranscript(interimTranscript)
      }
    }

    recognition.onerror = (event) => {
      // 'no-speech' is normal, don't treat as error
      if (event.error !== 'no-speech') {
        setError(`Speech error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (recognitionRef.current) {
        try {
          recognition.start()
        } catch {
          setIsListening(false)
        }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setError(null)
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current
      recognitionRef.current = null
      rec.stop()
    }
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return { isListening, isSupported, transcript, startListening, stopListening, clearTranscript, error }
}
