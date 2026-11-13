# DeepSeek 语音测试台

浏览器里的 DeepSeek 语音接口试验台：**语音识别（ASR）+ 语音合成（TTS）**，纯前端、无后端、暗色单主题。

打开页面先填入 DeepSeek API Key，密钥只写入 `localStorage`，请求由浏览器直连 `api.deepseek.com`。

## 功能

- **语音识别** — 麦克风录音（最长 120 秒，自动停止）或上传音频文件；浏览器内解码后统一转成 16 kHz / 16 bit / 单声道 WAV 再上传，避免格式不符。结果可复制。
- **语音合成** — 整段合成，两种音色（`stella` 海星女声 / `tide` 暗潮男声），可选朗读前剥离 Markdown；生成后可视化波形包络、试听、下载 WAV，或一键「发给识别」做闭环回测。
- **预生成样例** — 首页展示一句示例文案，两个播放按钮直接播放随站点打包的音频，不需要密钥。
- 实时波形：录音时跟随麦克风电平，合成后显示音频包络。
- 计费字符实时估算（汉字 2、其余 1），与官方计费口径一致。

## 用到的接口

| 方法 | 地址 | 说明 |
| --- | --- | --- |
| `POST` | `https://api.deepseek.com/v1/tools/asr` | `multipart/form-data` 的 `file` 字段；16 位 PCM WAV 或 Ogg Opus，≤ 8 MiB，≤ 120 秒 |
| `POST` | `https://api.deepseek.com/v1/tools/tts` | JSON：`text` / `voice_id` / `format` / `filter_markdown`，返回流式 `audio/wav` |

浏览器端直接调用依赖接口返回的 CORS 头（`access-control-allow-origin` 回显来源），已验证可用。

## 本地运行

```bash
bun install
bun run dev
```

构建与预览：

```bash
bun run build
bun run preview
```

部署到 Vercel 就是普通静态站：

```bash
vercel --prod
```

## 结构

```
src/
  lib/api.ts        ASR / TTS 请求、错误归一化、计费字符
  lib/audio.ts      录音、重采样编码 WAV、波形包络
  lib/store.ts      localStorage 中的密钥
  components/       Wave / DemoBar / AsrPanel / TtsPanel / KeyGate
```

## 说明

- 密钥保存在本机 `localStorage`，没有服务器参与。页面上的「换一个密钥」会清除它。
- 接口在浏览器端的并发上限为每账号 50 个请求，超限返回 429。
- 预生成样例音频位于 `public/demo/`，由接口生成后随站点打包。

## License

MIT
