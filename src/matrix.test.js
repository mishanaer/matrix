import { expect, test } from 'bun:test'
import { defaults, createColumns, advance, highlight, createRain } from './matrix-rain.js'

test('custom input preserves complete Unicode characters and supports an empty set', () => {
  for (const characters of ['🙂', 'AЖ🙂', '']) {
    const settings = { ...defaults, characters }
    const columns = createColumns(10, 20, settings)
    for (let tick = 0; tick < 30; tick++) advance(columns, 20, settings)
    const allowed = new Set(characters ? Array.from(characters) : [''])
    expect(columns.every(column => column.chars.every(char => allowed.has(char)))).toBe(true)
  }
})

test('original defaults produce bounded trails and valid characters over repeated drop resets', () => {
  const columns = createColumns(30, 25, defaults)
  for (let tick = 0; tick < 400; tick++) advance(columns, 25, defaults)
  expect(columns).toHaveLength(30)
  for (const column of columns) {
    expect(column.alphas.every(alpha => Number.isFinite(alpha) && alpha >= 0 && alpha <= 0.8)).toBe(true)
    expect(column.chars.every(char => defaults.characters.includes(char))).toBe(true)
    expect(column.maxRow).toBeLessThan(25)
    expect(column.brightness).toBeGreaterThanOrEqual(0.5)
    expect(column.brightness).toBeLessThanOrEqual(1)
  }
})

test('pointer lights its center, leaves remote cells untouched, and decays away', () => {
  const columns = createColumns(30, 25, defaults)
  highlight(columns, 25, defaults, 12, 126, 168)
  expect(columns[10].glows[10]).toBe(0.95)
  expect(columns[0].glows[0]).toBe(0)
  const glow = columns[10].glows[10]
  advance(columns, 25, defaults)
  expect(columns[10].glows[10]).toBeLessThan(glow)
  for (let tick = 0; tick < 40; tick++) advance(columns, 25, defaults)
  expect(columns[10].glows[10]).toBe(0)
  highlight(columns, 25, { ...defaults, pointer: false }, 12, 126, 168)
  expect(columns[10].glows[10]).toBe(0)
})

test('canvas follows viewport changes and applies pointer brightness live', () => {
  const original = new Map()
  const replace = (name, value) => {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  let bounds = { width: 1280, height: 720 }
  let resized
  let disconnected = false
  const noop = () => {}
  const painted = []
  const listeners = new Map()
  const settings = { ...defaults, color: '#111111', glowColor: '#ffffff' }
  const context = {
    clearRect() { painted.length = 0 },
    fillText() { painted.push({ color: this.fillStyle, alpha: this.globalAlpha }) },
    setTransform: noop, measureText: () => ({ width: 7 }),
  }
  const canvas = {
    width: 0, height: 0,
    parentElement: { getBoundingClientRect: () => bounds },
    getBoundingClientRect: () => ({ ...bounds, left: 0, top: 0 }),
    getContext: () => context,
  }
  replace('devicePixelRatio', 2)
  replace('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }))
  replace('requestAnimationFrame', () => 1)
  replace('cancelAnimationFrame', noop)
  replace('window', { addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: noop })
  replace('document', { hidden: false, addEventListener: noop, removeEventListener: noop })
  replace('IntersectionObserver', class { observe() {} disconnect() {} })
  replace('ResizeObserver', class {
    constructor(callback) { resized = callback }
    observe() {}
    disconnect() { disconnected = true }
  })
  let rain
  try {
    rain = createRain(canvas, settings)
    expect([canvas.width, canvas.height]).toEqual([2560, 1440])
    bounds = { width: 390, height: 844 }
    resized()
    expect([canvas.width, canvas.height]).toEqual([780, 1688])
    listeners.get('pointermove')({ clientX: 100, clientY: 100 })
    expect(painted.some(cell => cell.color === settings.glowColor)).toBe(true)
    settings.glowBrightness = 0
    rain.update('glowBrightness')
    expect(painted.some(cell => cell.color === settings.glowColor)).toBe(false)
    expect(painted.length).toBeGreaterThan(0)
    settings.glowBrightness = 0.5
    rain.update('glowBrightness')
    expect(painted.filter(cell => cell.color === settings.glowColor).every(cell => cell.alpha <= 0.475)).toBe(true)
    settings.glowBrightness = 2
    rain.update('glowBrightness')
    expect(painted.some(cell => cell.color === settings.glowColor)).toBe(true)
    expect(painted.every(cell => cell.alpha >= 0 && cell.alpha <= 1)).toBe(true)
    rain.destroy()
    rain = null
    expect(disconnected).toBe(true)
  } finally {
    rain?.destroy()
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
})
