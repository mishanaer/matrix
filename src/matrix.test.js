import { expect, test } from 'bun:test'
import { defaults, createColumns, advance, highlight, createRain, normalizeSettings } from './matrix-rain.js'

test('custom input preserves complete Unicode characters and supports an empty set', () => {
  for (const [characters, glyphs] of [['🙂', ['🙂']], ['AЖ🙂', ['A', 'Ж', '🙂']], ['👩🏽‍💻', ['👩🏽‍💻']], ['👨‍👩‍👧‍👦🇷🇺e\u0301', ['👨‍👩‍👧‍👦', '🇷🇺', 'e\u0301']], ['', ['']]]) {
    const settings = { ...defaults, characters }
    const columns = createColumns(10, 20, settings)
    for (let tick = 0; tick < 30; tick++) advance(columns, 20, settings)
    const allowed = new Set(glyphs)
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


function browser(options = {}) {
  const original = new Map()
  const replace = (name, value) => {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  const noop = () => {}
  const bounds = { width: 640, height: 320 }
  const painted = []
  const callbacks = new Map(), listeners = new Map(), documentListeners = new Map(), mediaListeners = new Map()
  const stats = { draws: 0, measures: 0, resizeDisconnected: false, intersectionDisconnected: false }
  const settings = { ...defaults, color: '#111111', glowColor: '#ffffff', ...options }
  const document = { hidden: false, addEventListener: (type, fn) => documentListeners.set(type, fn), removeEventListener: type => documentListeners.delete(type) }
  const media = { matches: false, addEventListener: (type, fn) => mediaListeners.set(type, fn), removeEventListener: type => mediaListeners.delete(type) }
  const context = {
    clearRect() { stats.draws++; painted.length = 0 },
    fillText(char) { painted.push({ char, color: this.fillStyle, alpha: this.globalAlpha }) },
    setTransform: noop,
    measureText() { stats.measures++; return { width: parseFloat(this.font) * .6 } },
  }
  const canvas = {
    width: 0, height: 0,
    get clientWidth() { return bounds.width },
    get clientHeight() { return bounds.height },
    parentElement: { getBoundingClientRect: () => ({ width: 1280, height: 720 }) },
    getBoundingClientRect: () => ({ ...bounds, left: 0, top: 0 }),
    getContext: () => context,
  }
  let nextFrame = 0, resized, intersected, observed
  replace('devicePixelRatio', 2)
  replace('matchMedia', () => media)
  replace('requestAnimationFrame', callback => { const id = ++nextFrame; callbacks.set(id, callback); return id })
  replace('cancelAnimationFrame', id => callbacks.delete(id))
  replace('window', { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) })
  replace('document', document)
  replace('IntersectionObserver', class {
    constructor(callback) { intersected = callback }
    observe() {}
    disconnect() { stats.intersectionDisconnected = true }
  })
  replace('ResizeObserver', class {
    constructor(callback) { resized = callback }
    observe(element) { observed = element }
    disconnect() { stats.resizeDisconnected = true }
  })
  const rain = createRain(canvas, settings, info => { stats.columns = info.columns })
  return {
    rain, canvas, bounds, settings, painted, stats, callbacks, listeners, documentListeners, mediaListeners, document, media,
    get observed() { return observed },
    tick(time = 100) { const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(time) },
    resize() { resized() },
    visibility(visible) { intersected([{ isIntersecting: visible }]) },
    pointer(x = 100, y = 100) { listeners.get('pointermove')({ clientX: x, clientY: y }) },
    restore() {
      rain.destroy()
      for (const [name, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
      }
    },
  }
}

test('canvas uses and observes its own size, including resized CSS dimensions', () => {
  const page = browser()
  try {
    expect(page.observed).toBe(page.canvas)
    expect([page.canvas.width, page.canvas.height]).toEqual([1280, 640])
    page.bounds.width = 390
    page.bounds.height = 844
    page.resize()
    page.tick()
    expect([page.canvas.width, page.canvas.height]).toEqual([780, 1688])
    page.bounds.width = page.bounds.height = 0
    page.resize()
    page.tick(101)
    expect([page.canvas.width, page.canvas.height]).toEqual([2, 2])
  } finally { page.restore() }
})

test('invalid public settings stay finite and bounded without mutating the input', () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity, undefined, '12']) {
    const input = Object.freeze({ fontSize: value, lineHeight: value, density: value })
    const normalized = normalizeSettings(input)
    expect(normalized.fontSize).toBeGreaterThanOrEqual(8)
    expect(normalized.lineHeight).toBeGreaterThanOrEqual(4)
    expect(normalized.density).toBeGreaterThanOrEqual(.1)
    const page = browser(input)
    try {
      expect(Number.isFinite(page.canvas.width)).toBe(true)
      expect(page.painted.every(cell => typeof cell.char === 'string' && Number.isFinite(cell.alpha))).toBe(true)
      page.settings.lineHeight = value
      page.rain.rebuild()
      expect(() => page.tick()).not.toThrow()
    } finally { page.restore() }
  }
  expect(normalizeSettings({ opacity: -1, glowBrightness: 100 })).toMatchObject({ opacity: 0, glowBrightness: 2 })
  expect(normalizeSettings({ characters: '', pointer: false, mask: false })).toMatchObject({ characters: '', pointer: false, mask: false })
})

test('pointer events share one draw with animation and brightness changes apply live', () => {
  const page = browser()
  try {
    const initial = page.stats.draws
    for (let i = 0; i < 120; i++) page.pointer(100 + i / 10, 100)
    expect(page.stats.draws).toBe(initial)
    expect(page.callbacks.size).toBe(1)
    page.tick()
    expect(page.stats.draws).toBe(initial + 1)
    expect(page.painted.some(cell => cell.color === page.settings.glowColor)).toBe(true)
    page.settings.glowBrightness = 0
    page.rain.update('glowBrightness')
    page.tick(101)
    expect(page.painted.some(cell => cell.color === page.settings.glowColor)).toBe(false)
    expect(page.painted.length).toBeGreaterThan(0)
    page.settings.glowBrightness = .5
    page.rain.update('glowBrightness')
    page.tick(102)
    expect(page.painted.filter(cell => cell.color === page.settings.glowColor).every(cell => cell.alpha <= .475)).toBe(true)
    page.settings.glowBrightness = 2
    page.rain.update('glowBrightness')
    page.tick(103)
    expect(page.painted.some(cell => cell.color === page.settings.glowColor)).toBe(true)
    expect(page.painted.every(cell => cell.alpha >= 0 && cell.alpha <= 1)).toBe(true)
  } finally { page.restore() }
})

test('disabled, invisible, hidden, paused, and reduced-motion canvases ignore pointer work', () => {
  for (const mode of ['disabled', 'invisible', 'hidden', 'paused', 'reduced', 'zero-radius', 'zero-brightness']) {
    const page = browser()
    try {
      if (mode === 'disabled') { page.settings.pointer = false; page.rain.update('pointer'); page.tick(1) }
      if (mode === 'invisible') page.visibility(false)
      if (mode === 'hidden') { page.document.hidden = true; page.documentListeners.get('visibilitychange')() }
      if (mode === 'paused') page.rain.pause()
      if (mode === 'reduced') { page.media.matches = true; page.mediaListeners.get('change')() }
      if (mode === 'zero-radius') { page.settings.radius = 0; page.rain.update('radius'); page.tick(1) }
      if (mode === 'zero-brightness') { page.settings.glowBrightness = 0; page.rain.update('glowBrightness'); page.tick(1) }
      const before = { draws: page.stats.draws, frames: page.callbacks.size }
      for (let i = 0; i < 120; i++) page.pointer()
      expect(page.stats.draws).toBe(before.draws)
      expect(page.callbacks.size).toBe(before.frames)
    } finally { page.restore() }
  }
})

test('geometry and resize changes rebuild only once per frame, using the latest values', () => {
  const page = browser()
  try {
    for (let i = 0; i < 120; i++) {
      page.settings.fontSize = 8 + i % 20
      page.rain.update('fontSize')
      page.resize()
    }
    expect(page.stats.measures).toBe(1)
    expect(page.stats.draws).toBe(1)
    page.tick()
    expect(page.stats.measures).toBe(2)
    expect(page.stats.draws).toBe(2)
    expect(page.canvas.width).toBe(1280)
    expect(page.stats.columns).toBe(24)
  } finally { page.restore() }
})

test('offscreen updates wait until visible and reduced-motion updates remain static', () => {
  const page = browser()
  try {
    page.visibility(false)
    page.settings.characters = '👩🏽‍💻'
    page.rain.update('characters')
    expect(page.callbacks.size).toBe(0)
    expect(page.stats.draws).toBe(1)
    page.visibility(true)
    page.tick()
    expect(page.painted.every(cell => cell.char === '👩🏽‍💻')).toBe(true)
    page.media.matches = true
    page.mediaListeners.get('change')()
    expect(page.callbacks.size).toBe(0)
    page.settings.glowBrightness = .5
    page.rain.update('glowBrightness')
    page.tick(101)
    expect(page.callbacks.size).toBe(0)
    expect(page.stats.draws).toBe(3)
  } finally { page.restore() }
})

test('destroy cancels queued work and removes observers and event listeners', () => {
  const page = browser()
  try {
    page.rain.rebuild()
    page.pointer()
    page.rain.destroy()
    page.visibility(true)
    expect(page.callbacks.size).toBe(0)
    expect(page.listeners.size).toBe(0)
    expect(page.documentListeners.size).toBe(0)
    expect(page.mediaListeners.size).toBe(0)
    expect(page.stats.resizeDisconnected).toBe(true)
    expect(page.stats.intersectionDisconnected).toBe(true)
  } finally { page.restore() }
})
