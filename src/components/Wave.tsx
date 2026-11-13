import { useEffect, useRef } from 'react'

type Props = {
  /** 每条柱的高度，0–1。长度决定柱数。 */
  bars: Float32Array | null
  /** 未选音频时的空闲状态。 */
  idle?: boolean
  height?: number
}

/** 波形条：整页唯一的主角。颜色取自 CSS 变量，跟随主题。 */
export function Wave({ bars, idle = false, height = 132 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const phase = useRef(0)
  const source = useRef<{ bars: Float32Array | null; idle: boolean }>({ bars, idle })
  source.current = { bars, idle }

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = () => {
      const width = canvas.clientWidth
      const h = canvas.clientHeight
      const style = getComputedStyle(canvas)
      const accent = style.getPropertyValue('--accent').trim() || '#f5b75a'
      const line = style.getPropertyValue('--line').trim() || '#23262f'

      ctx.clearRect(0, 0, width, h)
      ctx.fillStyle = line
      ctx.fillRect(0, Math.round(h / 2), width, 1)

      const gap = 3
      const barWidth = 3
      const count = Math.max(1, Math.floor(width / (barWidth + gap)))
      const data = source.current.bars
      const center = h / 2
      const t = phase.current

      ctx.fillStyle = accent
      for (let i = 0; i < count; i++) {
        let value: number
        if (data) {
          const at = Math.min(data.length - 1, Math.floor((i / count) * data.length))
          value = data[at]
        } else if (source.current.idle) {
          // 静息波形：一条低幅的行波，像待机的电平表。
          const swell = 0.45 + 0.55 * Math.sin(i * 0.037 + t * 0.5)
          value = 0.05 + 0.13 * Math.abs(Math.sin(i * 0.23 - t * 1.6)) * swell
        } else {
          value = 0.0
        }
        const mag = Math.min(1, Math.max(0, value))
        const barHeight = Math.max(3, mag * (h - 20))
        const x = i * (barWidth + gap)
        ctx.globalAlpha = data ? 0.4 + mag * 0.6 : 0.3 + mag * 0.7
        ctx.fillRect(x, center - barHeight / 2, barWidth, barHeight)
      }
      ctx.globalAlpha = 1

      if (!still) {
        phase.current += 0.02
        raf = requestAnimationFrame(draw)
      }
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="wave" style={{ height }} aria-hidden="true" />
}
