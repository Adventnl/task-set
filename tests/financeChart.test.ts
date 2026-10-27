// @vitest-environment jsdom
import {
  act,
  createElement,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import FinanceChart from '../src/components/finance/FinanceChart'

// The chart vendor owns geometry. Exercise our event boundary and reset behavior with
// its render contract, without requiring jsdom to measure an SVG viewport.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  LineChart: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick: (state: { activeLabel: number }, event: MouseEvent) => void
  }) =>
    createElement(
      'div',
      {
        onClick: (event: MouseEvent) =>
          onClick({ activeLabel: Date.parse('2026-10-01') }, event),
      },
      createElement('button', { 'data-plot': true }, 'Plot point'),
      children,
    ),
  Brush: () => {
    const [zoomed, setZoomed] = useState(false)
    return createElement(
      'div',
      { className: 'recharts-brush' },
      createElement(
        'button',
        { 'data-zoom': true, onClick: () => setZoomed(true) },
        zoomed ? 'Zoomed' : 'Full range',
      ),
    )
  },
  CartesianGrid: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))
it('drills into plotted dates, keeps zoom-handle clicks inside the chart, and resets the vendor range', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div'),
    root = createRoot(container),
    onSelect = vi.fn()
  document.body.append(container)
  try {
    await act(async () =>
      root.render(
        createElement(FinanceChart, {
          points: [
            { id: '2026-10-01', time: Date.parse('2026-10-01'), amount: 500 },
            { id: '2026-10-02', time: Date.parse('2026-10-02'), amount: 600 },
          ],
          label: 'Spending',
          onSelect,
        }),
      ),
    )
    await act(async () =>
      (container.querySelector('[data-zoom]') as HTMLButtonElement).click(),
    )
    expect(onSelect).not.toHaveBeenCalled()
    expect(container.querySelector('[data-zoom]')?.textContent).toBe('Zoomed')
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Reset zoom')!
        .click(),
    )
    expect(container.querySelector('[data-zoom]')?.textContent).toBe(
      'Full range',
    )
    await act(async () =>
      (container.querySelector('[data-plot]') as HTMLButtonElement).click(),
    )
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('2026-10-01')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
