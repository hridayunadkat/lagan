import type { AppData, Category, HabitKind, HabitVersion } from './types'

export interface HabitDraft {
  name: string
  category: Category
  weekdays: number[]
  kind: HabitKind
  target: number
  unit: string
}

const versionFrom = (draft: HabitDraft, effectiveDate: string): HabitVersion => ({
  ...draft,
  effectiveDate,
})

export const addHabit = (
  data: AppData,
  draft: HabitDraft,
  createdDate: string,
  id: string,
): AppData => ({
  ...data,
  habits: [
    ...data.habits,
    {
      id,
      createdDate,
      versions: [versionFrom(draft, createdDate)],
    },
  ],
})

export const editHabit = (
  data: AppData,
  habitId: string,
  draft: HabitDraft,
  effectiveDate: string,
): AppData => ({
  ...data,
  habits: data.habits.map((habit) => {
    if (habit.id !== habitId) return habit
    const versions = [
      ...habit.versions.filter((version) => version.effectiveDate !== effectiveDate),
      versionFrom(draft, effectiveDate),
    ].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
    return { ...habit, versions }
  }),
})

export const archiveHabit = (data: AppData, habitId: string, archivedDate: string): AppData => ({
  ...data,
  habits: data.habits.map((habit) => habit.id === habitId ? { ...habit, archivedDate } : habit),
})

export const restartHabit = (
  data: AppData,
  habitId: string,
  createdDate: string,
  newId: string,
): AppData => {
  const habit = data.habits.find((item) => item.id === habitId)
  if (!habit?.archivedDate) return data
  const latestVersion = [...habit.versions]
    .filter((version) => version.effectiveDate < habit.archivedDate!)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0]
  if (!latestVersion) return data
  const alreadyRestarted = data.habits.some((item) => {
    if (item.archivedDate) return false
    const current = [...item.versions].sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0]
    return current?.name === latestVersion.name && current.category === latestVersion.category
  })
  if (alreadyRestarted) return data
  return {
    ...data,
    habits: [
      ...data.habits,
      {
        id: newId,
        createdDate,
        versions: [{ ...latestVersion, effectiveDate: createdDate }],
      },
    ],
  }
}

export const deleteHabit = (data: AppData, habitId: string): AppData => ({
  ...data,
  habits: data.habits.filter((habit) => habit.id !== habitId),
  completions: Object.fromEntries(
    Object.entries(data.completions).filter(([key]) => !key.startsWith(`${habitId}:`)),
  ),
})
