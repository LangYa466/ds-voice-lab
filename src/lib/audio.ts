/** 输出统一为 16 位 PCM、16 kHz、单声道 WAV —— ASR 接受的最轻格式。 */
const TARGET_RATE = 16000
export const MAX_SECONDS = 120
export const MAX_BYTES = 8 * 1024 * 1024

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const frames = samples.length
  const view = new DataView(new ArrayBuffer(44 + frames * 2))
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, frames * 2, true)

  for (let i = 0; i < frames; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

/** 解码任意浏览器可读音频，重采样到 16 kHz 单声道。 */
export async function toWav(blob: Blob): Promise<{ wav: Blob; duration: number; samples: Float32Array }> {
  const bytes = await blob.arrayBuffer()
  const probe = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await probe.decodeAudioData(bytes)
  } finally {
    void probe.close()
  }

  const resample = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_RATE), TARGET_RATE)
  const source = resample.createBufferSource()
  source.buffer = decoded
  source.connect(resample.destination)
  source.start()
  const mix = await resample.startRendering()
  const samples = mix.getChannelData(0)

  return {
    wav: encodeWav(samples, TARGET_RATE),
    duration: decoded.duration,
    samples,
  }
}

export type Recorder = {
  stop: () => Promise<Blob>
  level: () => number
  elapsed: () => number
  cancel: () => void
}

/** 麦克风录音；电平用于实时波形。 */
export async function startRecording(onAutoStop: () => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })

  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(analyser)
  const frame = new Float32Array(analyser.fftSize)

  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
    (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
  )
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data)
  })

  const started = performance.now()
  const teardown = () => {
    for (const track of stream.getTracks()) track.stop()
    void ctx.close()
  }

  const timer = window.setTimeout(() => {
    onAutoStop()
  }, MAX_SECONDS * 1000)

  recorder.start(250)

  const stop = () => {
    const { promise, resolve } = Promise.withResolvers<Blob>()
    recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: recorder.mimeType })), {
      once: true,
    })
    recorder.stop()
    window.clearTimeout(timer)
    teardown()
    return promise
  }

  return {
    stop,
    cancel: () => {
      window.clearTimeout(timer)
      if (recorder.state !== 'inactive') recorder.stop()
      teardown()
    },
    level: () => {
      analyser.getFloatTimeDomainData(frame)
      let peak = 0
      for (let i = 0; i < frame.length; i += 4) peak = Math.max(peak, Math.abs(frame[i]))
      return peak
    },
    elapsed: () => (performance.now() - started) / 1000,
  }
}

/** 波形包络：把采样压成 n 个峰值，供 canvas 绘制。 */
export function envelope(samples: Float32Array, bars: number): Float32Array {
  const out = new Float32Array(bars)
  const step = Math.max(1, Math.floor(samples.length / bars))
  for (let i = 0; i < bars; i++) {
    let peak = 0
    const from = i * step
    const to = Math.min(samples.length, from + step)
    for (let j = from; j < to; j += 2) {
      const v = Math.abs(samples[j])
      if (v > peak) peak = v
    }
    out[i] = peak
  }
  return out
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(2)} MiB`
}

/** 取音频的包络与时长，用于合成结果的可视化。 */
export async function decodeEnvelope(blob: Blob, bars: number): Promise<{ bars: Float32Array; duration: number }> {
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    return { bars: envelope(decoded.getChannelData(0), bars), duration: decoded.duration }
  } finally {
    void ctx.close()
  }
}
