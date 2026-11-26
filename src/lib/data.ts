import { dateKey, shiftDate } from './scoring'
import { CATEGORIES, type AppData, type Category, type Challenge, type Habit } from './types'

export const uid = () => crypto.randomUUID()

const STARTERS: Record<Category, { name: string; kind: 'checkbox' | 'numeric'; target: number; unit: string }> = {
  Physical: { name: 'Exercise', kind: 'numeric', target: 30, unit: 'minutes' },
  Social: { name: 'Reach out to a friend', kind: 'checkbox', target: 1, unit: 'time' },
  Discipline: { name: 'Focused work session', kind: 'checkbox', target: 1, unit: 'session' },
  Mental: { name: 'Read', kind: 'numeric', target: 20, unit: 'minutes' },
  Finance: { name: 'Review spending', kind: 'checkbox', target: 1, unit: 'review' },
  Ambition: { name: 'Advance a personal goal', kind: 'checkbox', target: 1, unit: 'step' },
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
  name: '',
  onboarded: false,
  focusAreas: [],
  habits: [],
  completions: {},
  challenges: {},
})

export const CHALLENGES: Challenge[] = [
  { id: 'walk-outside', title: 'Take the long way', category: 'Physical', detail: 'Walk outside for 15 minutes.' },
  { id: 'mobility', title: 'Move with intent', category: 'Physical', detail: 'Do a 10-minute mobility flow.' },
  { id: 'voice-note', title: 'Make someone’s day', category: 'Social', detail: 'Send a thoughtful voice note.' },
  { id: 'new-conversation', title: 'Start a conversation', category: 'Social', detail: 'Speak to someone new.' },
  { id: 'phone-away', title: 'Protect your focus', category: 'Discipline', detail: 'Put your phone away for one hour.' },
  { id: 'hard-thing-first', title: 'Do the hard thing first', category: 'Discipline', detail: 'Finish your most avoided task.' },
  { id: 'journal', title: 'Clear the noise', category: 'Mental', detail: 'Journal one full page.' },
  { id: 'learn', title: 'Learn something useful', category: 'Mental', detail: 'Study one idea for 20 minutes.' },
  { id: 'no-spend', title: 'No-spend day', category: 'Finance', detail: 'Skip every non-essential purchase.' },
  { id: 'money-move', title: 'Make a money move', category: 'Finance', detail: 'Save, invest, or reduce a bill.' },
  { id: 'ship', title: 'Ship something', category: 'Ambition', detail: 'Share one piece of work.' },
  { id: 'future-self', title: 'Meet your future self', category: 'Ambition', detail: 'Take one action your future self wants.' },
]

const hash = (value: string) => [...value].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7)

export const challengesForDay = (day = dateKey()) => {
  const seed = hash(day)
  const result: Challenge[] = []
  let index = seed % CHALLENGES.length
  while (result.length < 3) {
    const candidate = CHALLENGES[index % CHALLENGES.length]
    if (!result.some((item) => item.category === candidate.category)) result.push(candidate)
    index += 5
  }
  return result
}

export const challengeKey = (challengeId: string, day = dateKey()) => `${challengeId}:${day}`

export const createDemoData = (): AppData => {
  const today = dateKey()
  const created = shiftDate(today, -34)
  const habits = CATEGORIES.map((category) => createStarterHabit(category, created))
  const data: AppData = {
    version: 1,
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
      if (signal < thresholds[index]) {
        const partial = version.kind === 'numeric' && signal % 5 === 0 ? 0.6 : 1
        data.completions[`${habit.id}:${day}`] = {
          value: version.target * partial,
          updatedAt: `${day}T12:00:00`,
        }
      }
    })
  }

  for (let offset = -6; offset <= -1; offset += 2) {
    const day = shiftDate(today, offset)
    data.challenges[challengeKey(challengesForDay(day)[0].id, day)] = { completedAt: `${day}T15:00:00` }
  }
  return data
}
