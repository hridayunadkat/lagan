import { describe, expect, it } from 'vitest'
import { dateKeyInTimeZone, widgetSummary } from './widget-data.js'

const habit = {
  id: 'exercise',
  createdDate: '2026-11-01',
  versions: [
    {
      effectiveDate: '2026-11-01',
      name: 'Exercise',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      target: 2,
    },
  ],
}

describe('widgetSummary', () => {
  it('returns progress, counts, habits, and the current streak', () => {
    const data = {
      habits: [habit],
      completions: {
        'exercise:2026-11-25': { value: 2 },
        'exercise:2026-11-26': { value: 1 },
      },
    }

    expect(widgetSummary(data, '2026-11-26')).toEqual({
      date: '2026-11-26',
      progress: 50,
      completed: 0,
      total: 1,
      streak: 1,
      habits: [{ name: 'Exercise', progress: 50, complete: false }],
    })
  })

  it('returns an empty summary when nothing is scheduled', () => {
    const data = {
      habits: [{ ...habit, archivedDate: '2026-11-26' }],
      completions: {},
    }

    expect(widgetSummary(data, '2026-11-26')).toMatchObject({
      progress: 0,
      completed: 0,
      total: 0,
      streak: 0,
      habits: [],
    })
  })
})

describe('dateKeyInTimeZone', () => {
  it('uses the configured local date', () => {
    const instant = new Date('2026-11-27T01:00:00Z')
    expect(dateKeyInTimeZone('America/New_York', instant)).toBe('2026-11-26')
    expect(dateKeyInTimeZone('Asia/Kolkata', instant)).toBe('2026-11-27')
  })
})
