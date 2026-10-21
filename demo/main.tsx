import { StrictMode, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from './react/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem } from './react/components/ui/select'
import { Slider } from './react/components/ui/slider'
import { ScrollArea } from './react/components/ui/scroll-area'
import { InputGroup, InputField } from './fluid/input-group'
import { Switch } from './fluid/switch'
import { Drawer, DrawerTrigger, DrawerContent, DrawerTitle, DrawerDescription } from './shadcn/drawer'
import { defaults, Matrix, type MatrixOptions } from '../src/matrix'
import './theme.css'
import './tokens.css'
import './style.css'

type Settings = MatrixOptions
type NumericKey = { [Key in keyof Settings]: Settings[Key] extends number ? Key : never }[keyof Settings]
const palette = [
  { value: '--deslop-primary', name: 'Primary' },
  { value: '--accent-green', name: 'Green' },
  { value: '--accent-blue', name: 'Blue' },
  { value: '--accent-teal', name: 'Teal' },
  { value: '--accent-cyan', name: 'Cyan' },
  { value: '--accent-indigo', name: 'Indigo' },
  { value: '--accent-pink', name: 'Pink' },
]
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`
const pixels = (value: number) => `${value} px`
const multiplier = (value: number) => `${value.toFixed(2)}×`

function Choice({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; name: string }[]
  onChange: (value: string) => void
}) {
  return <div className="choice-field">
    <span className="field-label">{label}</span>
    <Select value={value} onValueChange={value => { if (value !== null) onChange(value) }}>
      <SelectTrigger aria-label={label} className="w-full" />
      <SelectContent>{options.map((option, index) => <SelectItem index={index} key={option.value} value={option.value}>{option.name}</SelectItem>)}</SelectContent>
    </Select>
  </div>
}

function App() {
  const [settings, setSettings] = useState<Settings>({ ...defaults })
  const [resetKey, setResetKey] = useState(0)
  const [ink, setInk] = useState('--deslop-primary')
  const [glow, setGlow] = useState('--deslop-primary')
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved === 'dark'
    } catch { /* Theme still works when storage is unavailable. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* Storage is optional. */ }
  }, [dark])

  function change<Key extends keyof Settings>(key: Key, value: Settings[Key]) {
    setSettings(current => ({ ...current, [key]: value }))
  }
  function reset() {
    setSettings({ ...defaults })
    setInk('--deslop-primary')
    setGlow('--deslop-primary')
    setResetKey(current => current + 1)
  }
  function range(key: NumericKey, label: string, min: number, max: number, step: number, formatValue: (value: number) => string) {
    return <Slider size="default" variant="scrubber" label={label} value={settings[key]} min={min} max={max} step={step} formatValue={formatValue}
      disabled={(key === 'radius' || key === 'glowDecay' || key === 'glowBrightness') && !settings.pointer}
      onChange={value => change(key, typeof value === 'number' ? value : value[0])} />
  }

  return <main>
    <div className="effect-stage" aria-label="Fullscreen effect">
      <Matrix className="rain-canvas" resetKey={resetKey} options={{ ...settings, color: `var(${ink})`, glowColor: `var(${glow})` }} />
    </div>
    <Drawer open={visible} onOpenChange={setVisible} modal={false} disablePointerDismissal showSwipeHandle>
      <div className="toolbar" aria-label="Effect controls">
        <Button variant="primary" asChild><a href="https://github.com/mishanaer/matrix" target="_blank" rel="noopener noreferrer">GitHub</a></Button>
        <Button variant="secondary" onClick={() => setDark(current => !current)}>{dark ? 'Light theme' : 'Dark theme'}</Button>
        <DrawerTrigger render={<Button variant="secondary" />}>{visible ? 'Close settings' : 'Settings'}</DrawerTrigger>
        <Button variant="secondary" onClick={reset}>Reset</Button>
      </div>
      <DrawerContent className="h-[50dvh] max-h-[50dvh]">
      <DrawerTitle className="sr-only">Settings</DrawerTitle>
      <DrawerDescription className="sr-only">Changes appear instantly in the preview.</DrawerDescription>
      <ScrollArea className="settings-scroll" viewportClassName="settings-viewport">
        <div className="settings-content">
          <section className="control-section" aria-labelledby="symbols-heading">
            <h3 id="symbols-heading">Characters</h3>
            {range('fontSize', 'Size', 8, 28, 1, pixels)}
            {range('density', 'Density', .4, 2, .05, multiplier)}
            {range('lineHeight', 'Line spacing', 12, 36, 1, pixels)}
            <InputGroup className="w-full">
              <InputField className="character-field" label="Character set" labelHidden index={0} value={settings.characters} onChange={value => change('characters', value)} maxLength={120} spellCheck={false} autoComplete="off" />
            </InputGroup>
          </section>
          <section className="control-section" aria-labelledby="motion-heading">
            <h3 id="motion-heading">Motion</h3>
            {range('speed', 'Speed', .1, 3, .05, multiplier)}
            {range('interval', 'Frame interval', 16, 250, 1, value => `${value} ms`)}
            {range('decay', 'Trail persistence', .8, .995, .005, percent)}
          </section>
          <section className="control-section" aria-labelledby="color-heading">
            <h3 id="color-heading">Color and brightness</h3>
            {range('opacity', 'Opacity', .05, 1, .01, percent)}
            <Choice label="Character color" value={ink} options={palette} onChange={setInk} />
            <Choice label="Highlight color" value={glow} options={palette} onChange={setGlow} />
          </section>
          <section className="control-section" aria-labelledby="cursor-heading">
            <h3 id="cursor-heading">Pointer</h3>
            <Switch className="pointer-switch" label="Pointer highlight" checked={settings.pointer} onToggle={() => change('pointer', !settings.pointer)} />
            {range('glowBrightness', 'Brightness', 0, 2, .01, percent)}
            {range('radius', 'Radius', 0, 180, 2, pixels)}
            {range('glowDecay', 'Highlight persistence', .5, .98, .01, percent)}
          </section>
        </div>
      </ScrollArea>
      </DrawerContent>
    </Drawer>
  </main>
}

const root = createRoot(document.getElementById('root')!)
root.render(<StrictMode><App /></StrictMode>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
