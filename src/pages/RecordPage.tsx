import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { TrialConfig, TrialSession, PlotData } from '../types'
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
    return { plotNumber, readings }
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
    let { currentPlotIndex, currentVariableIndex, currentSubSampleIndex } = sess
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
      let { currentPlotIndex, currentVariableIndex, currentSubSampleIndex } = prev

      // Go back sub-sample
      if (currentSubSampleIndex > 0) {
        return { ...prev, currentSubSampleIndex: currentSubSampleIndex - 1 }
      }

      // Go back variable
      if (currentVariableIndex > 0) {
        const prevVar = config.variables[currentVariableIndex - 1]!
        return { ...prev, currentVariableIndex: currentVariableIndex - 1, currentSubSampleIndex: prevVar.subSamples - 1 }
      }

      // Go back plot
      if (currentPlotIndex > 0) {
        const lastVar = config.variables[config.variables.length - 1]!
        return { ...prev, currentPlotIndex: currentPlotIndex - 1, currentVariableIndex: config.variables.length - 1, currentSubSampleIndex: lastVar.subSamples - 1 }
      }

      return prev // already at beginning
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

  const handleSpeechResult = useCallback((text: string) => {
    setLastRecognized(text)
    const parsed = parseSpokenNumber(text)

    if (parsed === undefined) {
      // Could not parse
      playError()
      return
    }

    // Check for "go back" command
    const cleaned = text.trim().toLowerCase()
    if (cleaned === 'go back' || cleaned === 'back' || cleaned === 'undo' || cleaned === 'previous') {
      goBack()
      playBeep(600, 100)
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
        recordValue(null) // missing data
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

  if (!config) {
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
        <>
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
        </>
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

      {/* Quick data view for current plot */}
      {currentPlot && Object.values(currentPlot.readings).some(r => r.some(v => v !== null)) && (
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
          </div>
        </details>
      )}
    </>
  )
}
