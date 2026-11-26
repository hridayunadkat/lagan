// LAGAN for Scriptable
// Run once inside Scriptable to sign in, then add it as a Home Screen widget.

const SUPABASE_URL = "https://fmdqywvgdswboxvmtnti.supabase.co"
const SUPABASE_KEY = "sb_publishable_481pX4LZN2UOR6YIhp2AmQ_p3_t4y2_"
const REFRESH_TOKEN_KEY = "lagan.supabase.refreshToken"
const APP_URL = "https://lagan-hriday.vercel.app"

const COLORS = {
  background: new Color("#0b0d0e"),
  card: new Color("#151719"),
  line: new Color("#292d30"),
  text: new Color("#f4f5f7"),
  muted: new Color("#858b93"),
  lime: new Color("#b8ff5a"),
}

async function requestJSON(url, options = {}) {
  const request = new Request(url)
  request.method = options.method || "GET"
  request.headers = options.headers || {}
  if (options.body) request.body = JSON.stringify(options.body)
  const result = await request.loadJSON()
  const status = request.response?.statusCode || 0
  if (status >= 400) {
    throw new Error(result.error_description || result.msg || result.message || `Request failed (${status})`)
  }
  return result
}

async function signIn() {
  const alert = new Alert()
  alert.title = "Connect LAGAN"
  alert.message = "Sign in with the same account you use in LAGAN. Your password goes directly to Supabase and is not saved."
  alert.addTextField("Email")
  alert.addSecureTextField("Password")
  alert.addAction("Sign in")
  alert.addCancelAction("Cancel")
  const choice = await alert.presentAlert()
  if (choice === -1) throw new Error("Sign-in cancelled")

  const email = alert.textFieldValue(0).trim()
  const password = alert.textFieldValue(1)
  const session = await requestJSON(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: { email, password },
  })
  Keychain.set(REFRESH_TOKEN_KEY, session.refresh_token)
  return session
}

async function refreshSession() {
  if (!Keychain.contains(REFRESH_TOKEN_KEY)) {
    if (config.runsInWidget) throw new Error("Open the LAGAN script once to sign in")
    return signIn()
  }
  try {
    const session = await requestJSON(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: { refresh_token: Keychain.get(REFRESH_TOKEN_KEY) },
    })
    Keychain.set(REFRESH_TOKEN_KEY, session.refresh_token)
    return session
  } catch {
    Keychain.remove(REFRESH_TOKEN_KEY)
    if (config.runsInWidget) throw new Error("Session expired. Open the LAGAN script to sign in again")
    return signIn()
  }
}

async function loadLaganData(session) {
  const userId = session.user?.id
  if (!userId) throw new Error("Supabase did not return a user")
  const rows = await requestJSON(
    `${SUPABASE_URL}/rest/v1/level_data?select=data&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  )
  if (!rows.length) throw new Error("Open LAGAN once so it can sync your progress")
  return rows[0].data
}

function dateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function shiftDate(key, amount) {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}

function versionOn(habit, day) {
  return [...habit.versions]
    .filter((version) => version.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]
}

function isScheduled(habit, day) {
  if (day < habit.createdDate || (habit.archivedDate && day >= habit.archivedDate)) return false
  const version = versionOn(habit, day)
  return Boolean(version && version.weekdays.includes(fromDateKey(day).getDay()))
}

function completionRatio(data, habit, day) {
  const version = versionOn(habit, day)
  if (!version) return 0
  const completion = data.completions[`${habit.id}:${day}`]
  return Math.min(1, Math.max(0, (completion?.value || 0) / version.target))
}

function dailySummary(data, day = dateKey()) {
  const habits = data.habits.filter((habit) => isScheduled(habit, day))
  const items = habits.map((habit) => {
    const version = versionOn(habit, day)
    const ratio = completionRatio(data, habit, day)
    return { name: version.name, ratio, complete: ratio >= 1 }
  })
  const progress = items.length ? items.reduce((sum, item) => sum + item.ratio, 0) / items.length : 0
  return {
    items,
    progress,
    completed: items.filter((item) => item.complete).length,
    total: items.length,
  }
}

function currentStreak(data, today = dateKey()) {
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

function addProgressBar(parent, progress, width) {
  const track = parent.addStack()
  track.size = new Size(width, 7)
  track.cornerRadius = 4
  track.backgroundColor = COLORS.line
  if (progress > 0) {
    const fill = track.addStack()
    fill.size = new Size(Math.max(4, width * Math.min(1, progress)), 7)
    fill.cornerRadius = 4
    fill.backgroundColor = COLORS.lime
  }
  track.addSpacer()
}

function addHeader(widget, streak) {
  const header = widget.addStack()
  header.centerAlignContent()
  const title = header.addText("LAGAN")
  title.font = Font.boldSystemFont(11)
  title.textColor = COLORS.lime
  title.textOpacity = 0.95
  header.addSpacer()
  const streakText = header.addText(`🔥 ${streak}`)
  streakText.font = Font.boldSystemFont(10)
  streakText.textColor = COLORS.muted
}

function createWidget(data) {
  const summary = dailySummary(data)
  const streak = currentStreak(data)
  const family = config.widgetFamily || "medium"
  const isSmall = family === "small"
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.background
  widget.setPadding(14, 14, 14, 14)
  widget.url = APP_URL
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)

  addHeader(widget, streak)
  widget.addSpacer(isSmall ? 10 : 8)

  const scoreLine = widget.addStack()
  scoreLine.bottomAlignContent()
  const score = scoreLine.addText(`${Math.round(summary.progress * 100)}%`)
  score.font = Font.boldSystemFont(isSmall ? 32 : 36)
  score.textColor = COLORS.text
  scoreLine.addSpacer()
  const count = scoreLine.addText(`${summary.completed}/${summary.total}`)
  count.font = Font.semiboldSystemFont(11)
  count.textColor = COLORS.muted

  widget.addSpacer(7)
  addProgressBar(widget, summary.progress, isSmall ? 112 : 285)
  widget.addSpacer(8)

  const caption = widget.addText(summary.total ? "TODAY'S HABITS" : "NO HABITS SCHEDULED")
  caption.font = Font.boldSystemFont(8)
  caption.textColor = COLORS.muted

  if (!isSmall) {
    widget.addSpacer(7)
    const remaining = summary.items.filter((item) => !item.complete).slice(0, 3)
    const visible = remaining.length ? remaining : summary.items.slice(0, 3)
    for (const item of visible) {
      const row = widget.addStack()
      row.centerAlignContent()
      const marker = row.addText(item.complete ? "✓" : "○")
      marker.font = Font.boldSystemFont(10)
      marker.textColor = item.complete ? COLORS.lime : COLORS.muted
      row.addSpacer(7)
      const name = row.addText(item.name)
      name.font = Font.mediumSystemFont(10)
      name.textColor = COLORS.text
      name.lineLimit = 1
      row.addSpacer()
      if (item.ratio > 0 && !item.complete) {
        const partial = row.addText(`${Math.round(item.ratio * 100)}%`)
        partial.font = Font.mediumSystemFont(9)
        partial.textColor = COLORS.muted
      }
      widget.addSpacer(4)
    }
  }
  return widget
}

function createErrorWidget(message) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.background
  widget.setPadding(14, 14, 14, 14)
  const title = widget.addText("LAGAN")
  title.font = Font.boldSystemFont(11)
  title.textColor = COLORS.lime
  widget.addSpacer(10)
  const text = widget.addText(message)
  text.font = Font.mediumSystemFont(11)
  text.textColor = COLORS.text
  text.lineLimit = 4
  widget.url = APP_URL
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)
  return widget
}

let widget
try {
  const session = await refreshSession()
  const data = await loadLaganData(session)
  widget = createWidget(data)
} catch (error) {
  widget = createErrorWidget(String(error.message || error))
  if (!config.runsInWidget) {
    const alert = new Alert()
    alert.title = "LAGAN Widget"
    alert.message = String(error.message || error)
    alert.addAction("OK")
    await alert.presentAlert()
  }
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentMedium()
}
Script.complete()
