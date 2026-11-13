import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, describeError, transcribe, type Transcript } from '../lib/api'
import {
  MAX_BYTES,
  MAX_SECONDS,
  envelope,
  formatBytes,
  formatClock,
  startRecording,
  toWav,
  type Recorder,
} from '../lib/audio'
import { Wave } from './Wave'

type Phase = 'idle' | 'recording' | 'working' | 'ready'

type Clip = {
  wav: Blob
  duration: number
  size: number
  origin: string
}

type Props = {
  apiKey: string
  onAuthError: () => void
  /** 从合成面板转过来的音频，每次换新对象即触发一次转写。 */
  handoff?: { blob: Blob; id: number } | null
}

export function AsrPanel({ apiKey, onAuthError, handoff = null }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [clock, setClock] = useState(0)
  const [bars, setBars] = useState<Float32Array | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const [result, setResult] = useState<Transcript | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const recorder = useRef<Recorder | null>(null)
  const frame = useRef(0)
  const finishRef = useRef<() => void>(() => {})

  const cleanup = useCallback(() => {
    cancelAnimationFrame(frame.current)
    recorder.current?.cancel()
    recorder.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const run = useCallback(
    async (blob: Blob, origin: string) => {
      setPhase('working')
      setError('')
      setResult(null)
      try {
        const { wav, duration, samples } = await toWav(blob)
        if (duration > MAX_SECONDS) {
          throw new Error(`音频 ${duration.toFixed(1)} 秒，超过 ${MAX_SECONDS} 秒上限。`)
        }
        if (wav.size > MAX_BYTES) {
          throw new Error(`转换后 ${formatBytes(wav.size)}，超过 ${formatBytes(MAX_BYTES)} 上限。`)
        }
        const next = { wav, duration, size: wav.size, origin }
        setClip(next)
        setBars(envelope(samples, 160))
        const transcript = await transcribe(apiKey, wav)
        setResult(transcript)
        setPhase('ready')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onAuthError()
        setError(describeError(err))
        setPhase('idle')
      }
    },
    [apiKey, onAuthError],
  )

  useEffect(() => {
    if (!handoff) return
    setPhase('working')
    void run(handoff.blob, '合成音频')
  }, [handoff, run])

  const finish = useCallback(async () => {
    const active = recorder.current
    if (!active) return
    recorder.current = null
    cancelAnimationFrame(frame.current)
    const blob = await active.stop()
    setPhase('working')
    await run(blob, '麦克风')
  }, [run])

  finishRef.current = () => void finish()

  const record = useCallback(async () => {
    setError('')
    setResult(null)
    setClip(null)
    setBars(null)
    try {
      const active = await startRecording(() => finishRef.current())
      recorder.current = active
      setPhase('recording')
      const live = new Float32Array(160)
      const tick = () => {
        const level = active.level()
        live.copyWithin(0, 1)
        live[live.length - 1] = Math.min(1, level * 3.5)
        setBars(live.slice())
        setClock(active.elapsed())
        frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? '麦克风权限被拒绝。在浏览器地址栏的权限设置里允许后重试。'
          : describeError(err),
      )
    }
  }, [])

  const stop = useCallback(() => {
    void finish()
  }, [finish])

  const upload = useCallback(
    (file: File) => {
      setError('')
      setResult(null)
      setClip(null)
      void run(file, file.name)
    },
    [run],
  )

  const copy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [result])

  const recording = phase === 'recording'
  const working = phase === 'working'

  return (
    <section className="panel" aria-label="语音转文字">
      <div className="meter">
        <div className="meter-line">
          <span className={recording ? 'dot dot-live' : 'dot'} />
          <span className="mono">
            {recording ? 'REC' : working ? '处理中' : result ? '已转写' : '就绪'}
          </span>
          <span className="meter-clock">{formatClock(recording ? clock : clip?.duration ?? 0)}</span>
          <span className="meter-hint">
            {recording ? `上限 ${MAX_SECONDS} 秒，到点自动停止` : '16 kHz 单声道 WAV · 语音自动识别语种'}
          </span>
        </div>
        <Wave bars={bars} idle={!bars} height={148} />
      </div>

      <div className="actions">
        {recording ? (
          <button className="btn btn-stop" onClick={stop}>
            <span className="dot dot-live" /> 停止并转写
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void record()} disabled={working}>
            开始录音
          </button>
        )}

        <label className={working ? 'btn btn-ghost is-disabled' : 'btn btn-ghost'}>
          选择音频文件
          <input
            type="file"
            accept="audio/*,.ogg,.opus,.wav"
            hidden
            disabled={working}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) upload(file)
            }}
          />
        </label>

        {clip && !recording && (
          <span className="meta">
            {clip.origin} · {clip.duration.toFixed(1)} 秒 · {formatBytes(clip.size)}
          </span>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="result">
          <div className="result-head">
            <span className="result-title">转写文本</span>
            <button className="link" onClick={() => void copy()}>
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <p className="result-text">{result.text || '（没有识别到语音）'}</p>
          <p className="meta mono">
            {result.request_id} · 音频 {(result.duration_ms / 1000).toFixed(1)} 秒
          </p>
        </div>
      )}
    </section>
  )
}
