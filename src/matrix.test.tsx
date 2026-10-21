import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Matrix } from './matrix'

test('renders on the server without browser globals or demo styles', () => {
  const markup = renderToStaticMarkup(<Matrix options={{ opacity: .25, mask: false }} />)
  expect(markup).toContain('aria-hidden="true"')
  expect(markup).toContain('opacity:0.25')
  expect(markup).not.toContain('mask-image')
  expect(markup).not.toContain('Settings')
})
