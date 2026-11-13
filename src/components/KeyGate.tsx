import { useState } from 'react'
import { saveKey } from '../lib/store'
import { DemoBar } from './DemoBar'

type Props = {
  onSubmit: (key: string) => void
}

export function KeyGate({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const usable = value.trim().length > 0

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">DeepSeek 语音测试台</span>
        </div>

        <DemoBar />

        <h1 className="gate-title">先放入你的 API 密钥</h1>
        <p className="gate-copy">
          密钥只写进这台浏览器的 localStorage，请求由浏览器直接发往{' '}
          <span className="mono">api.deepseek.com</span>。换设备、清缓存都要重新填。
        </p>

        <form
          className="gate-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!usable) return
            saveKey(value)
            onSubmit(value.trim())
          }}
        >
          <label className="gate-label" htmlFor="api-key">
            DeepSeek API Key
          </label>
          <div className="gate-input">
            <input
              id="api-key"
              className="input mono"
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              autoFocus
              spellCheck={false}
            />
            <button type="button" className="link gate-reveal" onClick={() => setShow((v) => !v)}>
              {show ? '隐藏' : '显示'}
            </button>
          </div>
          <button className="btn btn-primary gate-submit" type="submit" disabled={!usable}>
            保存并开始
          </button>
        </form>

        <p className="gate-foot">
          还没有密钥？<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">去开放平台创建</a>
        </p>
      </div>
    </div>
  )
}
