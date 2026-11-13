import { useCallback, useEffect, useRef, useState } from 'react'
import { VOICES, type VoiceId } from '../lib/api'

const SENTENCE = '群主给个管理呗，明天去面试英伟达CEO，要求有管理经验的。'

/** 预生成的两段语音，放在 public/demo，不需要密钥即可试听。 */
export function DemoBar() {
  const [playing, setPlaying] = useState<VoiceId | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(
    () => () => {
      audio.current?.pause()
    },
    [],
  )

  const toggle = useCallback((voice: VoiceId) => {
    const el = audio.current ?? new Audio()
    audio.current = el

    if (playing === voice) {
      el.pause()
      setPlaying(null)
      return
    }

    el.onended = () => setPlaying(null)
    if (el.dataset.voice !== voice) {
      el.src = `/demo/${voice}.wav`
      el.dataset.voice = voice
    }
    el.currentTime = 0
    void el.play()
    setPlaying(voice)
  }, [playing])

  return (
    <section className="demo" aria-label="合成样例">
      <p className="demo-quote">“{SENTENCE}”</p>
      <div className="demo-actions">
        {VOICES.map((voice) => (
          <button
            key={voice.id}
            className={playing === voice.id ? 'demo-btn demo-btn-on' : 'demo-btn'}
            onClick={() => toggle(voice.id)}
            aria-pressed={playing === voice.id}
          >
            <span className="demo-icon" aria-hidden="true">
              {playing === voice.id ? (
                <svg viewBox="0 0 12 12" width="11" height="11">
                  <rect x="2" y="1.5" width="2.5" height="9" rx="0.8" fill="currentColor" />
                  <rect x="7.5" y="1.5" width="2.5" height="9" rx="0.8" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" width="11" height="11">
                  <path d="M3 1.6 10 6 3 10.4z" fill="currentColor" />
                </svg>
              )}
            </span>
            {voice.name}
            <span className="demo-note">{voice.id === 'stella' ? '女声' : '男声'}</span>
          </button>
        ))}
        <span className="demo-tag mono">预生成，无需密钥</span>
      </div>
    </section>
  )
}
