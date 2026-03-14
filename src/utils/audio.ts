/** Play a short confirmation beep */
export function playBeep(frequency = 800, duration = 100): void {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gain.gain.value = 0.3

    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch {
    // Audio not available — silently fail
  }
}

/** Play a success sound (higher pitch double beep) */
export function playSuccess(): void {
  playBeep(1000, 80)
  setTimeout(() => playBeep(1200, 80), 120)
}

/** Play an error sound (low pitch) */
export function playError(): void {
  playBeep(300, 200)
}

/** Speak text aloud using speech synthesis */
export function speak(text: string): void {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.2
    utterance.pitch = 1
    utterance.volume = 0.8
    window.speechSynthesis.speak(utterance)
  }
}
