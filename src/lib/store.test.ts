import { describe, expect, it } from 'vitest'
import { isAppData } from './store'

const validBackup = () => ({
  version: 1,
  name: 'Alex',
  onboarded: true,
  focusAreas: ['Mental'],
  habits: [{
    id: 'habit-1',
    createdDate: '2026-11-26',
    versions: [{
      effectiveDate: '2026-11-26',
      name: 'Read',
      category: 'Mental',
      weekdays: [1, 2, 3, 4, 5],
      kind: 'numeric',
      target: 20,
      unit: 'minutes',
    }],
  }],
  completions: {
    'habit-1:2026-11-26': { value: 10, updatedAt: '2026-11-26T12:00:00Z' },
  },
  challenges: {},
})

describe('backup validation', () => {
  it('accepts complete LAGAN data', () => {
    expect(isAppData(validBackup())).toBe(true)
  })

  it('rejects malformed habits that could crash scoring', () => {
    const backup = validBackup()
    backup.habits[0].versions = []
    expect(isAppData(backup)).toBe(false)
  })

  it('rejects invalid completion values and categories', () => {
    const completionBackup = validBackup()
    completionBackup.completions['habit-1:2026-11-26'].value = Number.NaN
    expect(isAppData(completionBackup)).toBe(false)

    const categoryBackup = validBackup()
    categoryBackup.habits[0].versions[0].category = 'Unknown'
    expect(isAppData(categoryBackup)).toBe(false)
  })

  it('rejects impossible dates and duplicate habit IDs', () => {
    const dateBackup = validBackup()
    dateBackup.habits[0].createdDate = '2026-99-26'
    expect(isAppData(dateBackup)).toBe(false)

    const duplicateBackup = validBackup()
    duplicateBackup.habits.push(structuredClone(duplicateBackup.habits[0]))
    expect(isAppData(duplicateBackup)).toBe(false)
  })
})
