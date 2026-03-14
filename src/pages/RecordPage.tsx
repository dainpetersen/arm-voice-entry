import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TrialConfig, TrialSession, PlotData, PlotNote } from '../types'
import { getPlotOrder, getTotalPlots } from '../types'
import { useSpeechRecognition, parseSpokenNumber } from '../hooks/useSpeechRecognition'
import { playBeep, playError } from '../utils/audio'

interface RecordPageProps {
  configs: TrialConfig[]
  sessions: TrialSession[]
  onSaveSession: (session: TrialSession) => void
}

type InputMode = 'voice' | 'keypad'

function initPlotData(config: TrialConfig): PlotData[] {
  const plotOrder = getPlotOrder(config)
  return plotOrder.map(plotNumber => {
    const readings: Record<string, (number | null)[]> = {}
    for (const v of config.variables) {
      readings[v.id] = Array(v.subSamples).fill(null) as (number | null)[]
    }
    return { plotNumber, readings, notes: [], photos: [] }
  })
}

/** Compress image to JPEG at reduced size for localStorage */
function compressImage(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function RecordPage({ configs, sessions, onSaveSession }: RecordPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()
  const config = configs.find(c => c.id === id)

  // Find existing in-progress session or create new
  const existingSession = sessions.find(s => s.config.id === id && !s.completedAt)

  const [session, setSession] = useState<TrialSession>(() => {
    if (existingSession) return existingSession
    if (!config) return null as unknown as TrialSession
    return {
      config,
      data: initPlotData(config),
      currentPlotIndex: 0,
      currentVariableIndex: 0,
      currentSubSampleIndex: 0,
      startedAt: Date.now(),
      completedAt: null,
    }
  })

  const [inputMode, setInputMode] = useState<InputMode>('voice')
  const [keypadValue, setKeypadValue] = useState('')
  const [lastRecognized, setLastRecognized] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isRecordingNote, setIsRecordingNote] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Auto-save periodically
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => {
      onSaveSession(sessionRef.current)
    }, 5000)
    return () => clearInterval(interval)
  }, [session, onSaveSession])

  const currentVariable = config?.variables[session?.currentVariableIndex]
  const currentPlot = session?.data[session?.currentPlotIndex]
  const totalReadings = config?.variables.reduce((sum, v) => sum + v.subSamples, 0) ?? 0
  const currentReadingInPlot = (config?.variables.slice(0, session?.currentVariableIndex).reduce((sum, v) => sum + v.subSamples, 0) ?? 0) + (session?.currentSubSampleIndex ?? 0)
  const totalReadingsCompleted = (session?.currentPlotIndex ?? 0) * totalReadings + currentReadingInPlot
  const totalPlots = config ? getTotalPlots(config) : 0
  const grandTotal = totalPlots * totalReadings

  const advanceToNext = useCallback((sess: TrialSession): TrialSession => {
    if (!config) return sess
    const { currentPlotIndex, currentVariableIndex, currentSubSampleIndex } = sess
    const currentVar = config.variables[currentVariableIndex]

    if (!currentVar) return sess

    // Advance sub-sample
    if (currentSubSampleIndex < currentVar.subSamples - 1) {
      return { ...sess, currentSubSampleIndex: currentSubSampleIndex + 1 }
    }

    // Advance variable
    if (currentVariableIndex < config.variables.length - 1) {
      return { ...sess, currentVariableIndex: currentVariableIndex + 1, currentSubSampleIndex: 0 }
    }

    // Advance plot
    if (currentPlotIndex < getTotalPlots(config) - 1) {
      return { ...sess, currentPlotIndex: currentPlotIndex + 1, currentVariableIndex: 0, currentSubSampleIndex: 0 }
    }

    // Trial complete
    return { ...sess, completedAt: Date.now() }
  }, [config])

  const goBack = useCallback(() => {
    if (!config) return
    setSession(prev => {
      const { currentPlotIndex, currentVariableIndex, currentSubSampleIndex } = prev

      if (currentSubSampleIndex > 0) {
        return { ...prev, currentSubSampleIndex: currentSubSampleIndex - 1 }
      }

      if (currentVariableIndex > 0) {
        const prevVar = config.variables[currentVariableIndex - 1]!
        return { ...prev, currentVariableIndex: currentVariableIndex - 1, currentSubSampleIndex: prevVar.subSamples - 1 }
      }

      if (currentPlotIndex > 0) {
        const lastVar = config.variables[config.variables.length - 1]!
        return { ...prev, currentPlotIndex: currentPlotIndex - 1, currentVariableIndex: config.variables.length - 1, currentSubSampleIndex: lastVar.subSamples - 1 }
      }

      return prev
    })
  }, [config])

  const recordValue = useCallback((value: number | null) => {
    if (!config || !currentVariable) return

    setSession(prev => {
      const newData = prev.data.map((p, i) => {
        if (i !== prev.currentPlotIndex) return p
        return {
          ...p,
          readings: {
            ...p.readings,
            [currentVariable.id]: p.readings[currentVariable.id]!.map((v, j) =>
              j === prev.currentSubSampleIndex ? value : v
            ),
          },
        }
      })

      const updated = { ...prev, data: newData }
      return advanceToNext(updated)
    })

    playBeep()
  }, [config, currentVariable, advanceToNext])

  // --- Note functions ---
  const addNoteToCurrentPlot = useCallback((text: string) => {
    if (!text.trim()) return
    const note: PlotNote = { text: text.trim(), timestamp: Date.now() }
    setSession(prev => {
      const newData = prev.data.map((p, i) => {
        if (i !== prev.currentPlotIndex) return p
        return { ...p, notes: [...p.notes, note] }
      })
      return { ...prev, data: newData }
    })
  }, [])

  const handleNoteVoiceResult = useCallback((text: string) => {
    setNoteText(prev => prev ? `${prev} ${text}` : text)
  }, [])

  const {
    startListening: startNoteListening,
    stopListening: stopNoteListening,
  } = useSpeechRecognition(handleNoteVoiceResult)

  const toggleNoteRecording = () => {
    if (isRecordingNote) {
      stopNoteListening()
      setIsRecordingNote(false)
    } else {
      startNoteListening()
      setIsRecordingNote(true)
    }
  }

  const saveNote = () => {
    addNoteToCurrentPlot(noteText)
    setNoteText('')
    setShowNoteModal(false)
    setIsRecordingNote(false)
    stopNoteListening()
    playBeep(1000, 80)
  }

  // --- Photo functions ---
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await compressImage(file)
      setSession(prev => {
        const newData = prev.data.map((p, i) => {
          if (i !== prev.currentPlotIndex) return p
          return { ...p, photos: [...p.photos, { dataUrl, timestamp: Date.now() }] }
        })
        return { ...prev, data: newData }
      })
      playBeep(1000, 80)
    } catch {
      playError()
    }

    // Reset input so same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // --- Speech for data entry ---
  const handleSpeechResult = useCallback((text: string) => {
    setLastRecognized(text)
    const cleaned = text.trim().toLowerCase()

    if (cleaned === 'go back' || cleaned === 'back' || cleaned === 'undo' || cleaned === 'previous') {
      goBack()
      playBeep(600, 100)
      return
    }

    const parsed = parseSpokenNumber(text)
    if (parsed === undefined) {
      playError()
      return
    }

    recordValue(parsed)
  }, [recordValue, goBack])

  const { isListening, isSupported, transcript, startListening, stopListening, error } = useSpeechRecognition(handleSpeechResult)

  const handleKeypadPress = (key: string) => {
    if (key === 'C') {
      setKeypadValue('')
    } else if (key === '⌫') {
      setKeypadValue(prev => prev.slice(0, -1))
    } else if (key === '✓') {
      if (keypadValue === '' || keypadValue === '-') {
        recordValue(null)
      } else {
        const num = parseFloat(keypadValue)
        if (!isNaN(num)) {
          recordValue(num)
        }
      }
      setKeypadValue('')
    } else if (key === 'Skip') {
      recordValue(null)
      setKeypadValue('')
    } else {
      setKeypadValue(prev => prev + key)
    }
  }

  if (!config || !session) {
    return (
      <div className="container">
        <p>Trial not found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    )
  }

  // Session complete
  if (session.completedAt) {
    onSaveSession(session)
    return (
      <div style={{ textAlign: 'center', paddingTop: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>&#10003;</div>
        <h2 style={{ fontSize: 24, color: 'var(--green-700)', marginBottom: 8 }}>Trial Complete!</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>
          {getTotalPlots(config)} plots recorded for {config.name}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/review/${config.id}/${session.startedAt}`)}
          style={{ marginBottom: 12 }}
        >
          Review &amp; Export
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    )
  }

  const plotNoteCount = currentPlot?.notes.length ?? 0
  const plotPhotoCount = currentPlot?.photos.length ?? 0

  return (
    <>
      <div className="header">
        <button className="header-back" onClick={() => {
          onSaveSession(session)
          navigate('/')
        }}>
          &lsaquo;
        </button>
        <h1>{config.name}</h1>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${grandTotal > 0 ? (totalReadingsCompleted / grandTotal) * 100 : 0}%` }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
        <span>Plot {session.currentPlotIndex + 1} of {getTotalPlots(config)}</span>
        <span>{totalReadingsCompleted} / {grandTotal} readings</span>
      </div>

      {/* Current reading display */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="recording-current">
          <div style={{ fontSize: 13, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1 }}>Plot</div>
          <div className="recording-plot-number">{currentPlot?.plotNumber}</div>
          <div className="recording-variable">
            {currentVariable?.name}
            {currentVariable?.unit && <span style={{ fontSize: 16, color: 'var(--gray-400)' }}> ({currentVariable.unit})</span>}
          </div>
          {currentVariable && currentVariable.subSamples > 1 && (
            <div className="recording-subsample">
              Reading {session.currentSubSampleIndex + 1} of {currentVariable.subSamples}
            </div>
          )}

          {/* Show current value being entered */}
          <div className={`recording-value ${inputMode === 'voice' && !lastRecognized ? 'interim' : ''}`}>
            {inputMode === 'voice'
              ? (transcript || lastRecognized || 'Listening...')
              : (keypadValue || '—')
            }
          </div>
        </div>
      </div>

      {/* Input mode tabs */}
      <div className="input-mode-tabs">
        <button
          className={`input-mode-tab ${inputMode === 'voice' ? 'active' : ''}`}
          onClick={() => setInputMode('voice')}
        >
          Voice
        </button>
        <button
          className={`input-mode-tab ${inputMode === 'keypad' ? 'active' : ''}`}
          onClick={() => setInputMode('keypad')}
        >
          Keypad
        </button>
      </div>

      {inputMode === 'voice' ? (
        <>
          {!isSupported && (
            <div className="card" style={{ background: 'var(--amber-100)', border: '1px solid var(--amber-500)', marginBottom: 16, textAlign: 'center' }}>
              Voice recognition is not supported in this browser. Try Chrome on Android.
            </div>
          )}

          <button
            className={`mic-button ${isListening ? 'listening' : ''}`}
            onClick={() => isListening ? stopListening() : startListening()}
          >
            {isListening ? '⏹' : '🎤'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--gray-500)' }}>
            {isListening ? 'Speak a number... Say "skip" for missing data, "go back" to undo' : 'Tap to start listening'}
          </p>

          {error && (
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--red-500)', marginTop: 8 }}>
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="keypad">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'].map(key => (
            <button key={key} className="keypad-btn" onClick={() => handleKeypadPress(key)}>
              {key}
            </button>
          ))}
          <button className="keypad-btn" onClick={() => handleKeypadPress('Skip')} style={{ fontSize: 14 }}>
            Skip
          </button>
          <button className="keypad-btn" onClick={() => handleKeypadPress('C')} style={{ fontSize: 14 }}>
            Clear
          </button>
          <button className="keypad-btn confirm" onClick={() => handleKeypadPress('✓')}>
            ✓
          </button>
        </div>
      )}

      {/* Navigation controls */}
      <div className="recording-controls" style={{ marginTop: 24 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={goBack}
          disabled={session.currentPlotIndex === 0 && session.currentVariableIndex === 0 && session.currentSubSampleIndex === 0}
        >
          ← Back
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => recordValue(null)}
        >
          Skip →
        </button>
      </div>

      {/* Note & Photo buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowNoteModal(true)}
          style={{ flex: 1, fontSize: 14 }}
        >
          📝 Note{plotNoteCount > 0 ? ` (${plotNoteCount})` : ''}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => photoInputRef.current?.click()}
          style={{ flex: 1, fontSize: 14 }}
        >
          📷 Photo{plotPhotoCount > 0 ? ` (${plotPhotoCount})` : ''}
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          style={{ display: 'none' }}
        />
      </div>

      {/* Quick data view for current plot */}
      {currentPlot && (Object.values(currentPlot.readings).some(r => r.some(v => v !== null)) || currentPlot.notes.length > 0 || currentPlot.photos.length > 0) && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 14, color: 'var(--gray-500)', cursor: 'pointer' }}>
            Current plot data
          </summary>
          <div style={{ marginTop: 8, fontSize: 14 }}>
            {config.variables.map(v => {
              const readings = currentPlot.readings[v.id] ?? []
              return (
                <div key={v.id} style={{ marginBottom: 4 }}>
                  <strong>{v.name}:</strong>{' '}
                  {readings.map((r, i) => (
                    <span key={i}>
                      {r !== null ? r : <span className="empty-value">—</span>}
                      {i < readings.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )
            })}
            {currentPlot.notes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Notes:</strong>
                {currentPlot.notes.map((n, i) => (
                  <div key={i} style={{ color: 'var(--gray-600)', marginTop: 2, paddingLeft: 8, borderLeft: '2px solid var(--green-200)' }}>
                    {n.text}
                  </div>
                ))}
              </div>
            )}
            {currentPlot.photos.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {currentPlot.photos.map((p, i) => (
                  <img key={i} src={p.dataUrl} alt={`Plot ${currentPlot.plotNumber} photo ${i + 1}`}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                  />
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay" onClick={() => { setShowNoteModal(false); stopNoteListening(); setIsRecordingNote(false) }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>
              Note for Plot {currentPlot?.plotNumber}
            </h3>

            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Type a note or use voice..."
              rows={4}
              style={{
                width: '100%', padding: 12, fontSize: 16, border: '2px solid var(--gray-300)',
                borderRadius: 'var(--radius-sm)', resize: 'vertical', fontFamily: 'inherit',
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className={`btn btn-sm ${isRecordingNote ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleNoteRecording}
                style={{ flex: 1 }}
              >
                {isRecordingNote ? '⏹ Stop' : '🎤 Dictate'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={saveNote}
                disabled={!noteText.trim()}
                style={{ flex: 1, opacity: noteText.trim() ? 1 : 0.5 }}
              >
                Save Note
              </button>
            </div>

            {/* Show existing notes for this plot */}
            {currentPlot && currentPlot.notes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>Previous notes:</div>
                {currentPlot.notes.map((n, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--gray-600)', padding: '4px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    {n.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
