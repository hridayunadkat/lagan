import { describe, expect, it } from 'vitest'
import { addHabit, archiveHabit, deleteHabit, editHabit, restartHabit } from './habits'
import type { AppData } from './types'

const draft = {
  name: 'Read',
  category: 'Mental' as const,
  weekdays: [1, 2, 3, 4, 5],
  kind: 'numeric' as const,
  target: 20,
  unit: 'minutes',
}

const emptyData = (): AppData => ({
  version: 1,
  name: '',
  onboarded: true,
  focusAreas: [],
  habits: [],
  completions: {},
  challenges: {},
})

describe('habit mutations', () => {
  it('adds a habit with its initial dated version', () => {
    const result = addHabit(emptyData(), draft, '2026-11-26', 'habit-1')
    expect(result.habits).toEqual([{
      id: 'habit-1',
      createdDate: '2026-11-26',
      versions: [{ ...draft, effectiveDate: '2026-11-26' }],
    }])
  })

  it('edits from today forward without rewriting history', () => {
    const initial = addHabit(emptyData(), draft, '2026-11-20', 'habit-1')
    const result = editHabit(initial, 'habit-1', { ...draft, name: 'Read deeply', target: 30 }, '2026-11-26')
    expect(result.habits[0].versions).toHaveLength(2)
    expect(result.habits[0].versions[0].name).toBe('Read')
    expect(result.habits[0].versions[1]).toMatchObject({
      effectiveDate: '2026-11-26',
      name: 'Read deeply',
      target: 30,
    })
  })

  it('replaces repeated same-day edits instead of creating duplicates', () => {
    const initial = addHabit(emptyData(), draft, '2026-11-20', 'habit-1')
    const first = editHabit(initial, 'habit-1', { ...draft, target: 30 }, '2026-11-26')
    const second = editHabit(first, 'habit-1', { ...draft, target: 40 }, '2026-11-26')
    expect(second.habits[0].versions).toHaveLength(2)
    expect(second.habits[0].versions.at(-1)?.target).toBe(40)
  })

  it('permanently deletes only the selected habit and its completion history', () => {
    const first = addHabit(emptyData(), draft, '2026-11-20', 'habit-1')
    const second = addHabit(first, { ...draft, name: 'Journal' }, '2026-11-20', 'habit-2')
    second.completions = {
      'habit-1:2026-11-25': { value: 20, updatedAt: '' },
      'habit-2:2026-11-25': { value: 20, updatedAt: '' },
    }

    const result = deleteHabit(second, 'habit-1')
    expect(result.habits.map((habit) => habit.id)).toEqual(['habit-2'])
    expect(result.completions).toEqual({
      'habit-2:2026-11-25': { value: 20, updatedAt: '' },
    })
  })

  it('restarts an archived habit without rewriting its archived period', () => {
    const initial = addHabit(emptyData(), draft, '2026-11-01', 'habit-1')
    initial.completions['habit-1:2026-11-10'] = { value: 20, updatedAt: '' }
    const archived = archiveHabit(initial, 'habit-1', '2026-11-11')
    const restarted = restartHabit(archived, 'habit-1', '2026-11-20', 'habit-2')

    expect(restarted.habits[0].archivedDate).toBe('2026-11-11')
    expect(restarted.habits[1]).toMatchObject({
      id: 'habit-2',
      createdDate: '2026-11-20',
      versions: [{ name: 'Read', effectiveDate: '2026-11-20' }],
    })
    expect(restarted.completions['habit-1:2026-11-10']).toBeDefined()
  })
})
