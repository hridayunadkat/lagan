import { describe, expect, it } from 'vitest'
import { completionKey, scoresFor, streaksFor, xpFor } from './scoring'
import type { AppData, Habit } from './types'

const today = '2026-11-26'
const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'habit-1',
  createdDate: '2026-11-20',
  versions: [{
    effectiveDate: '2026-11-20',
    name: 'Read',
    category: 'Mental',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    kind: 'numeric',
    target: 20,
    unit: 'minutes',
  }],
  ...overrides,
})

const data = (habits = [habit()]): AppData => ({
  version: 1,
  name: 'Test',
  onboarded: true,
  focusAreas: [],
  habits,
  completions: {},
  challenges: {},
})

describe('LAGAN scoring', () => {
  it('counts numeric progress proportionally and only after creation', () => {
    const state = data()
    state.completions[completionKey('habit-1', today)] = { value: 10, updatedAt: '' }
    expect(scoresFor(state, today).Mental).toBe(7)
  })

  it('normalizes a new daily habit against its full weekly schedule', () => {
    const state = data([habit({ createdDate: today, versions: [{ ...habit().versions[0], effectiveDate: today }] })])
    state.completions[completionKey('habit-1', today)] = { value: 100, updatedAt: '' }
    expect(scoresFor(state, today).Mental).toBe(14)
  })

  it('derives XP without duplicate rewards and removes it on undo', () => {
    const state = data()
    state.completions[completionKey('habit-1', today)] = { value: 20, updatedAt: '' }
    expect(xpFor(state)).toBe(20)
    state.completions[completionKey('habit-1', today)] = { value: 20, updatedAt: 'later' }
    expect(xpFor(state)).toBe(20)
    delete state.completions[completionKey('habit-1', today)]
    expect(xpFor(state)).toBe(0)
  })

  it('does not award XP for removed legacy challenges', () => {
    const state = data()
    state.challenges['legacy:2026-11-26'] = { completedAt: '' }
    expect(xpFor(state)).toBe(0)
  })

  it('does not let an unfinished current day break yesterday’s streak', () => {
    const state = data()
    for (const day of ['2026-11-23', '2026-11-24', '2026-11-25']) {
      state.completions[completionKey('habit-1', day)] = { value: 20, updatedAt: '' }
    }
    expect(streaksFor(state, today).current).toBe(3)
  })

  it('uses the historical version for earlier dates', () => {
    const changed = habit({
      versions: [
        habit().versions[0],
        { ...habit().versions[0], effectiveDate: today, target: 40 },
      ],
    })
    const state = data([changed])
    state.completions[completionKey('habit-1', '2026-11-25')] = { value: 20, updatedAt: '' }
    state.completions[completionKey('habit-1', today)] = { value: 20, updatedAt: '' }
    expect(scoresFor(state, today).Mental).toBe(21)
  })
})
