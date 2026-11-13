import { useCallback, useState } from 'react'
import { AsrPanel } from './components/AsrPanel'
import { DemoBar } from './components/DemoBar'
import { TtsPanel } from './components/TtsPanel'
import { KeyGate } from './components/KeyGate'
import { clearKey, loadKey } from './lib/store'

type Tab = 'asr' | 'tts'

export function App() {
  const [apiKey, setApiKey] = useState(loadKey)
  const [tab, setTab] = useState<Tab>('asr')
  const [handoff, setHandoff] = useState<{ blob: Blob; id: number } | null>(null)

  const onAuthError = useCallback(() => {
    clearKey()
    setApiKey('')
  }, [])

  const sendToAsr = useCallback((blob: Blob) => {
    setHandoff({ blob, id: Date.now() })
    setTab('asr')
  }, [])

  const forget = useCallback(() => {
    clearKey()
    setApiKey('')
  }, [])

  if (!apiKey) {
    return <KeyGate onSubmit={(key) => setApiKey(key)} />
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">DeepSeek 语音测试台</span>
        </div>
        <div className="top-right">
          <span className="key-chip mono" title="密钥只存在这台设备的 localStorage">
            sk-••••{apiKey.slice(-4)}
          </span>
          <button className="link" onClick={forget}>
            换一个密钥
          </button>
        </div>
      </header>

      <DemoBar />

      <nav className="tabs" aria-label="功能">
        <button
          className={tab === 'asr' ? 'tab tab-on' : 'tab'}
          aria-current={tab === 'asr'}
          onClick={() => setTab('asr')}
        >
          语音转文字
          <span className="tab-api mono">/v1/tools/asr</span>
        </button>
        <button
          className={tab === 'tts' ? 'tab tab-on' : 'tab'}
          aria-current={tab === 'tts'}
          onClick={() => setTab('tts')}
        >
          文字转语音
          <span className="tab-api mono">/v1/tools/tts</span>
        </button>
      </nav>

      <main>
        {tab === 'asr' ? (
          <AsrPanel apiKey={apiKey} onAuthError={onAuthError} handoff={handoff} />
        ) : (
          <TtsPanel apiKey={apiKey} onAuthError={onAuthError} onSendToAsr={sendToAsr} />
        )}
      </main>

      <footer className="foot">
        <p>
          请求由浏览器直接发给 <span className="mono">api.deepseek.com</span>，不经过任何服务器。密钥只写进
          localStorage。语音识别上限 120 秒 / 8 MiB，合成上限 10,000 计费字符。
        </p>
        <p>
          源码 MIT。<a href="https://api-docs.deepseek.com/zh-cn/guides/tts" target="_blank" rel="noreferrer">API 文档</a>
        </p>
      </footer>
    </div>
  )
}
