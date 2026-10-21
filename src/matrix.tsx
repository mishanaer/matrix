"use client"

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { createRain, defaults, normalizeSettings } from './matrix-rain.js'

export { createRain, defaults } from './matrix-rain.js'
export type MatrixOptions = { -readonly [Key in keyof typeof defaults]: (typeof defaults)[Key] extends number ? number : (typeof defaults)[Key] extends boolean ? boolean : string }
export type MatrixProps = {
  options?: Partial<MatrixOptions>
  className?: string
  style?: CSSProperties
  /** Change this value to restart the rain without remounting the component. */
  resetKey?: number
}

/** Decorative canvas. It fills its parent and does not change page styles. */
export function Matrix({ options, className, style, resetKey }: MatrixProps) {
  const normalized = useMemo(() => normalizeSettings(options), [options])
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef<MatrixOptions>({ ...defaults })
  const rain = useRef<ReturnType<typeof createRain> | null>(null)
  const previousReset = useRef(resetKey)

  useEffect(() => {
    const element = canvas.current!
    const next = { ...normalized }
    const inheritedColor = getComputedStyle(element).color
    const originalColor = element.style.color
    for (const key of ['color', 'glowColor'] as const) {
      element.style.color = next[key] === 'currentColor' ? inheritedColor : next[key]
      next[key] = getComputedStyle(element).color
    }
    element.style.color = originalColor
    const rebuild = previousReset.current !== resetKey ||
      (['fontSize', 'density', 'lineHeight', 'characters'] as const).some(key => live.current[key] !== next[key])
    Object.assign(live.current, next)
    previousReset.current = resetKey
    if (rebuild) rain.current?.rebuild()
    else rain.current?.update('color')
  }, [normalized, resetKey])

  useEffect(() => {
    const effect = createRain(canvas.current!, live.current)
    rain.current = effect
    return () => { effect.destroy(); rain.current = null }
  }, [])

  return <canvas ref={canvas} aria-hidden="true" className={className} style={{
    display: 'block', width: '100%', height: '100%',
    opacity: normalized.opacity,
    ...(normalized.mask ? {
      maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent), linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      maskComposite: 'intersect',
    } : {}),
    ...style,
  }} />
}
