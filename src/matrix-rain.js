// Reconstructed from aiforui.dev's shipped MatrixRain module 183376.
// Original rendering behavior; the host supplies resolved theme colors.
const defaultValues = {
  speed: 1, interval: 90, fontSize: 12, density: 1, lineHeight: 16,
  decay: 0.94, opacity: 0.5, radius: 122, glowDecay: 0.64, glowBrightness: 1,
  color: 'currentColor', glowColor: 'currentColor', background: 'transparent',
  characters: 'АИСДПЕЛХУЙ01<>=+*-#$', mask: true, pointer: true,
}
export const defaults = Object.freeze(defaultValues)

const ranges = {
  speed: [0, 10], interval: [16, 1000], fontSize: [8, 96], density: [0.1, 4], lineHeight: [4, 128],
  decay: [0, 1], opacity: [0, 1], radius: [0, 1000], glowDecay: [0, 1], glowBrightness: [0, 2],
}

/** @param {Partial<typeof defaults>} [options] */
export function normalizeSettings(options = {}) {
  const settings = { ...defaults }
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = options?.[key]
    if (typeof value === typeof fallback && (typeof value !== 'number' || Number.isFinite(value))) settings[key] = value
  }
  for (const [key, [min, max]] of Object.entries(ranges)) settings[key] = Math.max(min, Math.min(max, settings[key]))
  return settings
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const splitCharacters = text => Array.from(segmenter.segment(text), part => part.segment)

function randomChar(characters) {
  return characters[Math.floor(Math.random() * characters.length)] ?? ''
}

function resetDrop(column, rows, initial = false) {
  column.head = initial ? Math.random() * rows * 2 : -Math.random() * rows * 1.5
  column.speed = 0.25 + 0.75 * Math.random()
  if (initial || Math.random() < 0.2) {
    column.maxRow = Math.floor(rows * (0.35 + 0.65 * Math.random()))
    column.brightness = 0.5 + 0.5 * Math.random()
  }
}

export function createColumns(count, rows, settings, characters = splitCharacters(settings.characters)) {
  return Array.from({ length: count }, () => {
    const column = {
      chars: Array.from({ length: rows }, () => randomChar(characters)),
      alphas: Array(rows).fill(0), floors: Array.from({ length: rows }, () => 0.04 + 0.08 * Math.random()),
      glows: Array(rows).fill(0),
    }
    resetDrop(column, rows, true)
    // Seed a settled trail directly instead of simulating hundreds of frames.
    for (let row = 0; row <= Math.min(column.maxRow, column.head); row++) {
      const age = (column.head - row) / Math.max(0.01, column.speed * settings.speed)
      column.alphas[row] = Math.max(column.floors[row], 0.8 * settings.decay ** age)
    }
    return column
  })
}

export function advance(columns, rows, settings, characters = splitCharacters(settings.characters)) {
  for (const column of columns) {
    column.head += column.speed * settings.speed
    const head = Math.floor(column.head)
    for (let row = 0; row <= column.maxRow; row++) {
      if (column.alphas[row] > 0) column.alphas[row] = Math.max(settings.decay * column.alphas[row], column.floors[row])
    }
    if (head >= 0 && head <= column.maxRow && head < rows) column.alphas[head] = 0.8
    for (let row = 0; row < rows; row++) {
      if (column.glows[row] > 0) column.glows[row] = column.glows[row] < 0.03 ? 0 : settings.glowDecay * column.glows[row]
    }
    if (Math.random() < 0.4) column.chars[Math.floor(Math.random() * rows)] = randomChar(characters)
    if (head > column.maxRow + 4) resetDrop(column, rows)
  }
}

export function highlight(columns, rows, settings, columnWidth, x, y) {
  if (!settings.pointer || settings.radius <= 0) return
  const radius = settings.radius
  const fromColumn = Math.max(0, Math.floor((x - radius) / columnWidth))
  const toColumn = Math.min(columns.length - 1, Math.ceil((x + radius) / columnWidth))
  const fromRow = Math.max(0, Math.floor((y - radius) / settings.lineHeight))
  const toRow = Math.min(rows - 1, Math.ceil((y + radius) / settings.lineHeight))
  for (let column = fromColumn; column <= toColumn; column++) {
    for (let row = fromRow; row <= toRow; row++) {
      const distance = Math.hypot(column * columnWidth + columnWidth / 2 - x, row * settings.lineHeight + settings.lineHeight / 2 - y)
      if (distance > radius) continue
      columns[column].glows[row] = Math.max(columns[column].glows[row], 0.95 * (1 - distance / radius) ** 1.5)
    }
  }
}

/** @param {Partial<typeof defaults>} [source] */
export function createRain(canvas, source = defaults, onStats = () => {}) {
  let settings = normalizeSettings(source)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  let columns = [], rows = 0, columnWidth = 0, width = 0, height = 0
  let animation = 0, last = 0, paused = false, visible = true, frames = 0, destroyed = false
  let characters = [], needsRebuild = false, needsDraw = false, pointerPosition = null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')

  function draw() {
    context.clearRect(0, 0, width, height)
    context.font = `${settings.fontSize}px monospace`
    context.textBaseline = 'top'
    for (let column = 0; column < columns.length; column++) {
      const item = columns[column]
      for (let row = 0; row < rows; row++) {
        const alpha = item.alphas[row] * item.brightness
        const glow = settings.pointer ? Math.min(1, item.glows[row] * settings.glowBrightness) : 0
        const intensity = Math.max(alpha, glow)
        if (intensity < 0.02) continue
        context.fillStyle = glow > alpha ? settings.glowColor : settings.color
        context.globalAlpha = intensity
        context.fillText(item.chars[row], column * columnWidth, settings.lineHeight * row)
      }
    }
    context.globalAlpha = 1
    frames++
    onStats({ columns: columns.length, rows, frames, paused })
  }

  function rebuildNow() {
    const rect = canvas.getBoundingClientRect()
    width = Math.max(1, Math.round(canvas.clientWidth || rect.width))
    height = Math.max(1, Math.round(canvas.clientHeight || rect.height))
    const dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.font = `${settings.fontSize}px monospace`
    columnWidth = context.measureText('0').width * 1.7 / settings.density
    rows = Math.ceil(height / settings.lineHeight)
    characters = splitCharacters(settings.characters)
    columns = createColumns(Math.ceil(width / columnWidth), rows, settings, characters)
    needsRebuild = false
    needsDraw = true
  }

  function schedule() {
    if (!destroyed && !animation && visible && !document.hidden) animation = requestAnimationFrame(frame)
  }

  function rebuild() {
    settings = normalizeSettings(source)
    needsRebuild = true
    schedule()
  }

  function frame(time) {
    animation = 0
    if (!visible || document.hidden) return
    if (needsRebuild) rebuildNow()
    const running = !paused && !reduced.matches
    if (running && time - last >= settings.interval) {
      last = time
      advance(columns, rows, settings, characters)
      needsDraw = true
    }
    if (pointerPosition && running && settings.pointer && settings.radius > 0 && settings.glowBrightness > 0) {
      const rect = canvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const x = (pointerPosition.clientX - rect.left) * width / rect.width
        const y = (pointerPosition.clientY - rect.top) * height / rect.height
        if (x >= -settings.radius && x <= width + settings.radius && y >= -settings.radius && y <= height + settings.radius) {
          highlight(columns, rows, settings, columnWidth, x, y)
          needsDraw = true
        }
      }
    }
    pointerPosition = null
    if (needsDraw) { draw(); needsDraw = false }
    if (running) schedule()
  }

  function resume() {
    cancelAnimationFrame(animation)
    animation = 0
    last = 0
    pointerPosition = null
    if (needsRebuild || needsDraw || (!paused && !reduced.matches)) schedule()
  }

  function pointer(event) {
    if (paused || !visible || document.hidden || reduced.matches || !settings.pointer || settings.radius <= 0 || settings.glowBrightness <= 0) return
    pointerPosition = { clientX: event.clientX, clientY: event.clientY }
    schedule()
  }

  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume() })
  observer.observe(canvas)
  const resize = new ResizeObserver(rebuild)
  resize.observe(canvas)
  window.addEventListener('pointermove', pointer, { passive: true })
  document.addEventListener('visibilitychange', resume)
  reduced.addEventListener('change', resume)
  rebuildNow()
  draw()
  needsDraw = false
  resume()

  return {
    update(key) {
      if (['fontSize', 'density', 'lineHeight', 'characters'].includes(key)) rebuild()
      else { settings = normalizeSettings(source); needsDraw = true; schedule() }
    },
    rebuild,
    pause() { paused = !paused; resume(); onStats({ columns: columns.length, rows, frames, paused }); return paused },
    destroy() {
      destroyed = true
      cancelAnimationFrame(animation)
      observer.disconnect()
      resize.disconnect()
      window.removeEventListener('pointermove', pointer)
      document.removeEventListener('visibilitychange', resume)
      reduced.removeEventListener('change', resume)
    },
  }
}
