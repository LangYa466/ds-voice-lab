import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, VOICES, billableChars, describeError, synthesize, type VoiceId } from '../lib/api'
import { decodeEnvelope } from '../lib/audio'
import { Wave } from './Wave'

type Props = {
  apiKey: string
  onAuthError: () => void
  onSendToAsr: (blob: Blob) => void
}

const MAX_CHARS = 10000
const SAMPLE = '你好，我是 DeepSeek。把文字发过来，我会用合成的语音念给你听。'

export function TtsPanel({ apiKey, onAuthError, onSendToAsr }: Props) {
  const [text, setText] = useState(SAMPLE)
  const [voice, setVoice] = useState<VoiceId>('stella')
  const [filterMarkdown, setFilterMarkdown] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [audio, setAudio] = useState<{
    url: string
    blob: Blob
    bytes: number
    duration: number
    voice: VoiceId
  } | null>(null)
  const [bars, setBars] = useState<Float32Array | null>(null)

  const abort = useRef<AbortController | null>(null)
  const objectUrl = useRef('')

  useEffect(
    () => () => {
      abort.current?.abort()
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    [],
  )

  const billed = billableChars(text)
  const overLimit = billed > MAX_CHARS
  const empty = text.trim().length === 0

  const speak = useCallback(async () => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller

    setWorking(true)
    setError('')
    try {
      const blob = await synthesize(apiKey, text, voice, filterMarkdown, controller.signal)
      if (blob.size === 0) throw new Error('服务返回了空音频，请重试。')
      const envelope = await decodeEnvelope(blob, 160).catch(() => null)

      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = URL.createObjectURL(blob)
      setAudio({
        url: objectUrl.current,
        blob,
        bytes: blob.size,
        duration: envelope?.duration ?? 0,
        voice,
      })
      setBars(envelope?.bars ?? null)
    } catch (err) {
      if (controller.signal.aborted) return
      if (err instanceof ApiError && err.status === 401) onAuthError()
      setError(describeError(err))
    } finally {
      setWorking(false)
    }
  }, [apiKey, filterMarkdown, onAuthError, text, voice])

  return (
    <section className="panel" aria-label="文字转语音">
      <div className="meter">
        <div className="meter-line">
          <span className={working ? 'dot dot-live' : 'dot'} />
          <span className="mono">{working ? '合成中' : audio ? '已合成' : '就绪'}</span>
          <span className="meter-clock">{audio ? `${audio.duration.toFixed(1)}s` : '--:--'}</span>
          <span className="meter-hint">
            {audio ? `${VOICES.find((v) => v.id === audio.voice)?.name} · ${(audio.bytes / 1024).toFixed(0)} KiB WAV` : '24 kHz · 16 bit · 单声道'}
          </span>
        </div>
        <Wave bars={bars} idle={!bars} height={148} />
      </div>

      <textarea
        className="field"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder="输入要朗读的文字"
        spellCheck={false}
        aria-label="要朗读的文字"
      />

      <div className="row">
        <div className="segmented" role="radiogroup" aria-label="音色">
          {VOICES.map((item) => (
            <button
              key={item.id}
              role="radio"
              aria-checked={voice === item.id}
              className={voice === item.id ? 'seg seg-on' : 'seg'}
              onClick={() => setVoice(item.id)}
            >
              {item.name}
              <span className="seg-note">{item.note}</span>
            </button>
          ))}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={filterMarkdown}
            onChange={(event) => setFilterMarkdown(event.target.checked)}
          />
          朗读前去掉 Markdown
        </label>

        <span className={overLimit ? 'count count-over' : 'count mono'}>
          {billed.toLocaleString()} / {MAX_CHARS.toLocaleString()} 计费字符
        </span>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={() => void speak()}
          disabled={working || empty || overLimit}
        >
          {working ? '合成中…' : '合成语音'}
        </button>
        {working && (
          <button className="btn btn-ghost" onClick={() => abort.current?.abort()}>
            取消
          </button>
        )}
        {audio && !working && (
          <button className="btn btn-ghost" onClick={() => onSendToAsr(audio.blob)}>
            发给识别
          </button>
        )}
        {audio && !working && (
          <a className="btn btn-ghost" href={audio.url} download="deepseek-tts.wav">
            下载 WAV
          </a>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {audio && <audio className="player" src={audio.url} controls preload="metadata" />}
    </section>
  )
}
