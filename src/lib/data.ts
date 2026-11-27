import { dateKey, shiftDate } from './scoring'
import { CATEGORIES, type AppData, type Category, type Habit } from './types'

export const uid = () => crypto.randomUUID()

export const HABIT_PRESETS = [
  { name: 'Exercise', category: 'Physical', kind: 'numeric', target: 30, unit: 'minutes' },
  { name: 'Read', category: 'Mental', kind: 'numeric', target: 20, unit: 'minutes' },
  { name: 'Learn Gujarati', category: 'Mental', kind: 'numeric', target: 15, unit: 'minutes' },
  { name: 'Play a chess game', category: 'Mental', kind: 'checkbox', target: 1, unit: 'game' },
  { name: 'Journal', category: 'Discipline', kind: 'checkbox', target: 1, unit: 'entry' },
  { name: 'Floss', category: 'Health', kind: 'checkbox', target: 1, unit: 'time' },
  { name: 'Peace of mind', category: 'Health', kind: 'checkbox', target: 1, unit: 'moment' },
] as const

export const createPresetHabit = (preset: (typeof HABIT_PRESETS)[number], createdDate = dateKey()): Habit => ({
  id: uid(),
  createdDate,
  versions: [{
    effectiveDate: createdDate,
    name: preset.name,
    category: preset.category,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    kind: preset.kind,
    target: preset.target,
    unit: preset.unit,
  }],
})

const STARTERS: Record<Category, { name: string; kind: 'checkbox' | 'numeric'; target: number; unit: string }> = {
  Physical: { name: 'Exercise', kind: 'numeric', target: 30, unit: 'minutes' },
  Social: { name: 'Reach out to a friend', kind: 'checkbox', target: 1, unit: 'time' },
  Discipline: { name: 'Focused work session', kind: 'checkbox', target: 1, unit: 'session' },
  Mental: { name: 'Read', kind: 'numeric', target: 20, unit: 'minutes' },
  Finance: { name: 'Review spending', kind: 'checkbox', target: 1, unit: 'review' },
  Health: { name: 'Floss', kind: 'checkbox', target: 1, unit: 'time' },
}

export const createStarterHabit = (category: Category, createdDate = dateKey()): Habit => {
  const starter = STARTERS[category]
  return {
    id: uid(),
    createdDate,
    versions: [{
      effectiveDate: createdDate,
      name: starter.name,
      category,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      kind: starter.kind,
      target: starter.target,
      unit: starter.unit,
    }],
  }
}

export const emptyData = (): AppData => ({
  version: 1,
  defaultsVersion: 3,
  name: '',
  onboarded: false,
  focusAreas: [],
  habits: [],
  completions: {},
  challenges: {},
})

export const createDemoData = (): AppData => {
  const today = dateKey()
  const created = shiftDate(today, -34)
  const habits = [
    ...CATEGORIES.filter((category) => category !== 'Physical' && category !== 'Mental' && category !== 'Health').map((category) => createStarterHabit(category, created)),
    ...HABIT_PRESETS.map((preset) => createPresetHabit(preset, created)),
  ]
  const data: AppData = {
    version: 1,
    defaultsVersion: 3,
    name: 'Alex',
    onboarded: true,
    focusAreas: [...CATEGORIES],
    habits,
    completions: {},
    challenges: {},
  }

  for (let offset = -33; offset <= 0; offset += 1) {
    const day = shiftDate(today, offset)
    habits.forEach((habit, index) => {
      const version = habit.versions[0]
      const signal = ((offset * 17 + index * 23 + 101) % 100 + 100) % 100
      const thresholds = [78, 58, 86, 68, 48, 72]
      if (signal < thresholds[index % thresholds.length]) {
        const partial = version.kind === 'numeric' && signal % 5 === 0 ? 0.6 : 1
        data.completions[`${habit.id}:${day}`] = {
          value: version.target * partial,
          updatedAt: `${day}T12:00:00`,
        }
      }
    })
  }
  return data
}
