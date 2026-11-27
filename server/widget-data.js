const dateParts = (key) => key.split('-').map(Number)

export const dateKeyInTimeZone = (timeZone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

const shiftDate = (key, amount) => {
  const [year, month, day] = dateParts(key)
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const weekdayFor = (key) => {
  const [year, month, day] = dateParts(key)
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

const versionOn = (habit, day) =>
  [...habit.versions]
    .filter((version) => version.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]

const isScheduled = (habit, day) => {
  if (day < habit.createdDate || (habit.archivedDate && day >= habit.archivedDate)) return false
  const version = versionOn(habit, day)
  return Boolean(version?.weekdays.includes(weekdayFor(day)))
}

const completionRatio = (data, habit, day) => {
  const version = versionOn(habit, day)
  if (!version || version.target <= 0) return 0
  const completion = data.completions[`${habit.id}:${day}`]
  return Math.min(1, Math.max(0, (completion?.value ?? 0) / version.target))
}

const currentStreak = (data, today) => {
  const firstDate = data.habits.map((habit) => habit.createdDate).sort()[0]
  if (!firstDate) return 0

  let streak = 0
  for (let day = firstDate; day <= today; day = shiftDate(day, 1)) {
    const scheduled = data.habits.filter((habit) => isScheduled(habit, day))
    if (!scheduled.length) continue
    const complete = scheduled.every((habit) => completionRatio(data, habit, day) >= 1)
    if (complete) streak += 1
    else if (day !== today) streak = 0
  }
  return streak
}

export const widgetSummary = (data, today) => {
  if (!data || !Array.isArray(data.habits) || !data.completions) {
    throw new Error('The saved LAGAN data is invalid')
  }

  const scheduled = data.habits.filter((habit) => isScheduled(habit, today))
  const habits = scheduled.map((habit) => {
    const version = versionOn(habit, today)
    const ratio = completionRatio(data, habit, today)
    return {
      name: version.name,
      progress: Math.round(ratio * 100),
      complete: ratio >= 1,
    }
  })
  const average = habits.length
    ? habits.reduce((sum, habit) => sum + habit.progress, 0) / habits.length
    : 0

  return {
    date: today,
    progress: Math.round(average),
    completed: habits.filter((habit) => habit.complete).length,
    total: habits.length,
    streak: currentStreak(data, today),
    habits,
  }
}
