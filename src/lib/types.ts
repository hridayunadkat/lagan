export const CATEGORIES = [
  'Physical',
  'Social',
  'Discipline',
  'Mental',
  'Finance',
  'Health',
] as const

export type Category = (typeof CATEGORIES)[number]
export type HabitKind = 'checkbox' | 'numeric'

export interface HabitVersion {
  effectiveDate: string
  name: string
  category: Category
  weekdays: number[]
  kind: HabitKind
  target: number
  unit: string
}

export interface Habit {
  id: string
  createdDate: string
  archivedDate?: string
  versions: HabitVersion[]
}

export interface Completion {
  value: number
  updatedAt: string
}

export interface ChallengeCompletion {
  completedAt: string
}

export interface AppData {
  version: 1
  defaultsVersion?: number
  name: string
  onboarded: boolean
  focusAreas: Category[]
  habits: Habit[]
  completions: Record<string, Completion>
  challenges: Record<string, ChallengeCompletion>
}

export type AppMode = 'real' | 'demo'

export const CATEGORY_META: Record<Category, { color: string; soft: string }> = {
  Physical: { color: '#ff624d', soft: 'rgba(255,98,77,.14)' },
  Social: { color: '#53a8ff', soft: 'rgba(83,168,255,.14)' },
  Discipline: { color: '#f4d35e', soft: 'rgba(244,211,94,.14)' },
  Mental: { color: '#ff9f43', soft: 'rgba(255,159,67,.14)' },
  Finance: { color: '#46e58c', soft: 'rgba(70,229,140,.14)' },
  Health: { color: '#a97cff', soft: 'rgba(169,124,255,.14)' },
}
