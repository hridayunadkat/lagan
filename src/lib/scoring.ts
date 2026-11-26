import { CATEGORIES, type AppData, type Category, type Habit, type HabitVersion } from './types'

export const dateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const fromDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const shiftDate = (key: string, amount: number) => {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

export const dateRange = (start: string, end: string) => {
  const result: string[] = []
  for (let cursor = start; cursor <= end; cursor = shiftDate(cursor, 1)) result.push(cursor)
  return result
}

export const versionOn = (habit: Habit, day: string): HabitVersion | undefined =>
  [...habit.versions]
    .filter((version) => version.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]

export const isScheduled = (habit: Habit, day: string) => {
  if (day < habit.createdDate || (habit.archivedDate && day >= habit.archivedDate)) return false
  const version = versionOn(habit, day)
  return Boolean(version?.weekdays.includes(fromDateKey(day).getDay()))
}

export const completionKey = (habitId: string, day: string) => `${habitId}:${day}`

export const completionRatio = (data: AppData, habit: Habit, day: string) => {
  const version = versionOn(habit, day)
  if (!version) return 0
  const completion = data.completions[completionKey(habit.id, day)]
  return Math.min(1, Math.max(0, (completion?.value ?? 0) / version.target))
}

export const scoreBreakdownFor = (data: AppData, category: Category, today = dateKey()) => {
  const days = dateRange(shiftDate(today, -6), today)
  let completed = 0
  let scheduled = 0

  for (const habit of data.habits) {
    let habitCompleted = 0
    let habitScheduled = 0
    for (const day of days) {
      const version = versionOn(habit, day)
      if (version?.category !== category || !isScheduled(habit, day)) continue
      habitScheduled += 1
      habitCompleted += completionRatio(data, habit, day)
    }

    if (habitScheduled > 0) {
      const firstCategoryVersion = [...habit.versions]
        .filter((version) => version.category === category && version.effectiveDate <= today)
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0]
      if (firstCategoryVersion && firstCategoryVersion.effectiveDate > days[0]) {
        for (const day of days) {
          if (day >= firstCategoryVersion.effectiveDate) break
          if (firstCategoryVersion.weekdays.includes(fromDateKey(day).getDay())) habitScheduled += 1
        }
      }
      scheduled += habitScheduled
      completed += habitCompleted
    }
  }

  return { completed, scheduled, score: scheduled ? Math.round((completed / scheduled) * 100) : null }
}

export const scoresFor = (data: AppData, today = dateKey()): Record<Category, number | null> => {
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, scoreBreakdownFor(data, category, today).score]),
  ) as Record<Category, number | null>
}

export const overallScore = (scores: Record<Category, number | null>) =>
  Math.round(CATEGORIES.reduce((sum, category) => sum + (scores[category] ?? 0), 0) / CATEGORIES.length)

export const xpFor = (data: AppData) => {
  const habitXp = Object.entries(data.completions).reduce((xp, [key, completion]) => {
    const separator = key.lastIndexOf(':')
    const habit = data.habits.find((item) => item.id === key.slice(0, separator))
    const day = key.slice(separator + 1)
    const version = habit && versionOn(habit, day)
    return xp + (version && completion.value >= version.target ? 20 : 0)
  }, 0)
  return habitXp
}

const dayComplete = (data: AppData, day: string) => {
  const scheduled = data.habits.filter((habit) => isScheduled(habit, day))
  if (!scheduled.length) return null
  return scheduled.every((habit) => completionRatio(data, habit, day) >= 1)
}

export const streaksFor = (data: AppData, today = dateKey()) => {
  const allDates = data.habits.map((habit) => habit.createdDate).sort()
  if (!allDates.length) return { current: 0, longest: 0 }
  const days = dateRange(allDates[0], today)
  let running = 0
  let longest = 0
  for (const day of days) {
    const state = dayComplete(data, day)
    if (state === true) {
      running += 1
      longest = Math.max(longest, running)
    } else if (state === false && day !== today) {
      running = 0
    }
  }
  return { current: running, longest }
}

export const habitStreak = (data: AppData, habit: Habit, today = dateKey()) => {
  let streak = 0
  for (let day = today; day >= habit.createdDate; day = shiftDate(day, -1)) {
    if (!isScheduled(habit, day)) continue
    if (completionRatio(data, habit, day) >= 1) streak += 1
    else if (day !== today) break
  }
  return streak
}

export const totalCompletions = (data: AppData) =>
  Object.entries(data.completions).filter(([key, completion]) => {
    const separator = key.lastIndexOf(':')
    const habit = data.habits.find((item) => item.id === key.slice(0, separator))
    const version = habit && versionOn(habit, key.slice(separator + 1))
    return version && completion.value >= version.target
  }).length

export const dailyRatio = (data: AppData, day: string) => {
  const habits = data.habits.filter((habit) => isScheduled(habit, day))
  if (!habits.length) return null
  return habits.reduce((sum, habit) => sum + completionRatio(data, habit, day), 0) / habits.length
}
