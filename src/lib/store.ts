import { useCallback, useEffect, useState } from 'react'
import { createDemoData, emptyData } from './data'
import { CATEGORIES, type AppData, type AppMode, type Category } from './types'

const MODE_KEY = 'level:mode'
const keyFor = (mode: AppMode) => `level:data:${mode}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const isCategory = (value: unknown): value is Category =>
  typeof value === 'string' && CATEGORIES.includes(value as Category)

const isDateKey = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const isAppData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.version !== 1) return false
  if (typeof value.name !== 'string' || typeof value.onboarded !== 'boolean') return false
  if (!Array.isArray(value.focusAreas) || !value.focusAreas.every(isCategory)) return false
  if (!Array.isArray(value.habits) || !isRecord(value.completions) || !isRecord(value.challenges)) return false

  const habitIds = new Set<string>()
  const habitsValid = value.habits.every((habit) => {
    if (!isRecord(habit) || typeof habit.id !== 'string' || !isDateKey(habit.createdDate)) return false
    if (!habit.id || habitIds.has(habit.id)) return false
    habitIds.add(habit.id)
    if (habit.archivedDate !== undefined && !isDateKey(habit.archivedDate)) return false
    if (!Array.isArray(habit.versions) || habit.versions.length === 0) return false
    const effectiveDates = new Set<string>()
    return habit.versions.every((version) => {
      if (!isRecord(version) || !isDateKey(version.effectiveDate)) return false
      if (effectiveDates.has(version.effectiveDate as string)) return false
      effectiveDates.add(version.effectiveDate as string)
      if (typeof version.name !== 'string' || !version.name.trim() || !isCategory(version.category)) return false
      if (!Array.isArray(version.weekdays) || version.weekdays.length === 0) return false
      if (!version.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return false
      if (version.kind !== 'checkbox' && version.kind !== 'numeric') return false
      return typeof version.target === 'number'
        && Number.isFinite(version.target)
        && version.target > 0
        && typeof version.unit === 'string'
    })
  })
  if (!habitsValid) return false

  const completionsValid = Object.values(value.completions).every((completion) =>
    isRecord(completion)
    && typeof completion.value === 'number'
    && Number.isFinite(completion.value)
    && completion.value >= 0
    && typeof completion.updatedAt === 'string')
  const challengesValid = Object.values(value.challenges).every((challenge) =>
    isRecord(challenge) && typeof challenge.completedAt === 'string')
  return completionsValid && challengesValid
}

export const normalizeAppData = (value: unknown): AppData | null => {
  if (!isRecord(value)) return null
  const migrated = {
    ...value,
    focusAreas: Array.isArray(value.focusAreas)
      ? value.focusAreas.map((category) => category === 'Ambition' ? 'Health' : category)
      : value.focusAreas,
    habits: Array.isArray(value.habits)
      ? value.habits.map((habit) => {
        if (!isRecord(habit) || !Array.isArray(habit.versions)) return habit
        return {
          ...habit,
          versions: habit.versions.map((version) =>
            isRecord(version) && version.category === 'Ambition'
              ? { ...version, category: 'Health' }
              : version),
        }
      })
      : value.habits,
  }
  return isAppData(migrated) ? migrated : null
}

const loadMode = (): AppMode => localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real'

const loadData = (mode: AppMode): AppData => {
  const saved = localStorage.getItem(keyFor(mode))
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved)
      const normalized = normalizeAppData(parsed)
      if (normalized) return normalized
    } catch {
      // A corrupt local save should never prevent the app from opening.
    }
  }
  return mode === 'demo' ? createDemoData() : emptyData()
}

export function useLevelStore() {
  const [mode, setModeState] = useState<AppMode>(loadMode)
  const [data, setDataState] = useState<AppData>(() => loadData(loadMode()))

  useEffect(() => {
    localStorage.setItem(keyFor(mode), JSON.stringify(data))
  }, [data, mode])

  const setData = useCallback((update: AppData | ((current: AppData) => AppData)) => {
    setDataState(update)
  }, [])

  const setMode = useCallback((nextMode: AppMode) => {
    localStorage.setItem(MODE_KEY, nextMode)
    setModeState(nextMode)
    setDataState(loadData(nextMode))
  }, [])

  const refreshDemo = useCallback(() => {
    const demo = createDemoData()
    localStorage.setItem(keyFor('demo'), JSON.stringify(demo))
    setModeState('demo')
    localStorage.setItem(MODE_KEY, 'demo')
    setDataState(demo)
  }, [])

  const resetReal = useCallback(() => {
    const fresh = emptyData()
    localStorage.setItem(keyFor('real'), JSON.stringify(fresh))
    setModeState('real')
    localStorage.setItem(MODE_KEY, 'real')
    setDataState(fresh)
  }, [])

  const importData = useCallback((raw: string) => {
    const parsed: unknown = JSON.parse(raw)
    const normalized = normalizeAppData(parsed)
    if (!normalized) throw new Error('This is not a valid LAGAN backup.')
    setModeState('real')
    localStorage.setItem(MODE_KEY, 'real')
    setDataState(normalized)
  }, [])

  return { data, setData, mode, setMode, refreshDemo, resetReal, importData }
}
