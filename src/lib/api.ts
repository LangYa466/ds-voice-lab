const BASE = 'https://api.deepseek.com/v1/tools'

export type VoiceId = 'stella' | 'tide'

export const VOICES: { id: VoiceId; name: string; note: string }[] = [
  { id: 'stella', name: '海星', note: '女声，默认' },
  { id: 'tide', name: '暗潮', note: '男声' },
]

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type Transcript = {
  request_id: string
  text: string
  duration_ms: number
}

async function failure(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`
  try {
    const body = (await res.json()) as {
      error?: { message?: string }
      message?: string
    }
    const detail = body.error?.message ?? body.message
    if (detail) message = detail
  } catch {
    // Response body was not JSON; the status code alone is all we have.
  }
  return new ApiError(res.status, message)
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return `${error.message}（HTTP ${error.status}）`
  if (error instanceof Error) return error.message
  return '未知错误'
}

/** 整段合成。音频边合成边返回，这里等完整 wav。 */
export async function synthesize(
  apiKey: string,
  text: string,
  voiceId: VoiceId,
  filterMarkdown: boolean,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      format: 'wav',
      filter_markdown: filterMarkdown,
    }),
    signal,
  })
  if (!res.ok) throw await failure(res)
  return res.blob()
}

/** 一次请求发送完整音频，返回完整转写文本。 */
export async function transcribe(apiKey: string, wav: Blob): Promise<Transcript> {
  const form = new FormData()
  form.append('file', wav, 'speech.wav')

  const res = await fetch(`${BASE}/asr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw await failure(res)
  return (await res.json()) as Transcript
}

/** 计费字符：汉字算 2，其余算 1。 */
export function billableChars(text: string): number {
  let total = 0
  for (const ch of text) {
    total += /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3005\u3007]/.test(ch) ? 2 : 1
  }
  return total
}
