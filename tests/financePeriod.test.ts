// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import FinancePeriod from '../src/components/finance/FinancePeriod'
import { EMPTY_FINANCE_FILTER } from '../src/shared/hooks/useFinance'

it('reveals editable custom dates and applies a preset without a dead custom-date option', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onFilter = vi.fn()
  try {
    await act(async () => {
      root.render(
        createElement(FinancePeriod, {
          filter: { ...EMPTY_FINANCE_FILTER },
          onFilter,
        }),
      )
    })
    expect(container.querySelectorAll('input[type=date]')).toHaveLength(0)
    const select = container.querySelector('select')!
    await act(async () => {
      select.value = 'custom'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelectorAll('input[type=date]')).toHaveLength(2)
    expect(onFilter).not.toHaveBeenCalled()
    await act(async () => {
      select.value = '30'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onFilter).toHaveBeenCalledWith({
      start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
    expect(container.querySelectorAll('input[type=date]')).toHaveLength(0)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
