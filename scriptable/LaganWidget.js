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

const CATEGORIES = ["Physical", "Social", "Discipline", "Mental", "Finance", "Ambition"]
const CATEGORY_COLORS = ["#ff624d", "#53a8ff", "#f4d35e", "#ff9f43", "#46e58c", "#a97cff"]
const CATEGORY_SYMBOLS = [
  "figure.strengthtraining.traditional",
  "person.2.fill",
  "pencil",
  "brain",
  "dollarsign",
  "figure.stairs",
]

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

function dateRange(start, end) {
  const result = []
  for (let day = start; day <= end; day = shiftDate(day, 1)) result.push(day)
  return result
}

function categoryScore(data, category, today = dateKey()) {
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
  return scheduled ? Math.round((completed / scheduled) * 100) : 0
}

function categoryScores(data) {
  return CATEGORIES.map((category) => categoryScore(data, category))
}

function radarPoint(index, amount, center, radius) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / CATEGORIES.length
  return new Point(
    center.x + Math.cos(angle) * radius * amount,
    center.y + Math.sin(angle) * radius * amount,
  )
}

function polygonPath(points) {
  const path = new Path()
  path.move(points[0])
  for (const point of points.slice(1)) path.addLine(point)
  path.closeSubpath()
  return path
}

function strokeLine(context, start, end) {
  const path = new Path()
  path.move(start)
  path.addLine(end)
  context.addPath(path)
  context.strokePath()
}

function drawCategoryIcon(context, index, point) {
  const color = new Color(CATEGORY_COLORS[index])
  context.setFillColor(color)
  context.setStrokeColor(color)
  context.setLineWidth(1.8)

  if (index === 0) {
    // Physical: dumbbell
    strokeLine(context, new Point(point.x - 6, point.y), new Point(point.x + 6, point.y))
    context.setLineWidth(2.6)
    strokeLine(context, new Point(point.x - 4.5, point.y - 4), new Point(point.x - 4.5, point.y + 4))
    strokeLine(context, new Point(point.x + 4.5, point.y - 4), new Point(point.x + 4.5, point.y + 4))
  } else if (index === 1) {
    // Social: two people
    context.fillEllipse(new Rect(point.x - 5.5, point.y - 5, 5, 5))
    context.fillEllipse(new Rect(point.x + 0.5, point.y - 5, 5, 5))
    context.fillEllipse(new Rect(point.x - 6, point.y + 0.5, 6, 5))
    context.fillEllipse(new Rect(point.x, point.y + 0.5, 6, 5))
  } else if (index === 2) {
    // Discipline: pencil
    context.setLineWidth(3)
    strokeLine(context, new Point(point.x - 4.5, point.y + 4.5), new Point(point.x + 4, point.y - 4))
    context.setLineWidth(1.4)
    strokeLine(context, new Point(point.x - 6, point.y + 6), new Point(point.x - 3, point.y + 5))
  } else if (index === 3) {
    // Mental: brain
    context.fillEllipse(new Rect(point.x - 6, point.y - 4, 7, 7))
    context.fillEllipse(new Rect(point.x - 5, point.y + 0.5, 7, 6))
    context.fillEllipse(new Rect(point.x - 1, point.y - 5, 7, 7))
    context.fillEllipse(new Rect(point.x - 1, point.y + 0.5, 7, 6))
    context.setStrokeColor(COLORS.background)
    context.setLineWidth(1)
    strokeLine(context, new Point(point.x, point.y - 4), new Point(point.x, point.y + 5))
  } else if (index === 4) {
    // Finance: dollar sign
    context.setTextColor(color)
    context.setFont(Font.boldSystemFont(16))
    context.setTextAlignedCenter()
    context.drawTextInRect("$", new Rect(point.x - 8, point.y - 9, 16, 18))
  } else {
    // Ambition: ladder
    context.setLineWidth(1.8)
    strokeLine(context, new Point(point.x - 5, point.y + 6), new Point(point.x - 2, point.y - 6))
    strokeLine(context, new Point(point.x + 2, point.y + 6), new Point(point.x + 5, point.y - 6))
    for (const offset of [-3, 1, 5]) {
      strokeLine(
        context,
        new Point(point.x - 4 + offset / 4, point.y + offset),
        new Point(point.x + 4 + offset / 4, point.y + offset),
      )
    }
  }
}

function radarImage(scores) {
  const context = new DrawContext()
  context.size = new Size(130, 96)
  context.opaque = false
  context.respectScreenScale = true
  const center = new Point(65, 49)
  const radius = 29

  context.setStrokeColor(COLORS.line)
  context.setLineWidth(0.7)
  for (const level of [0.25, 0.5, 0.75, 1]) {
    context.addPath(polygonPath(CATEGORIES.map((_, index) => radarPoint(index, level, center, radius))))
    context.strokePath()
  }
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const axis = new Path()
    axis.move(center)
    axis.addLine(radarPoint(index, 1, center, radius))
    context.addPath(axis)
    context.strokePath()
  }

  const dataPoints = scores.map((score, index) => radarPoint(index, score / 100, center, radius))
  context.setFillColor(new Color("#b8ff5a", 0.18))
  context.addPath(polygonPath(dataPoints))
  context.fillPath()
  context.setStrokeColor(COLORS.lime)
  context.setLineWidth(1.5)
  context.addPath(polygonPath(dataPoints))
  context.strokePath()

  const iconRadius = 41
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const point = radarPoint(index, 1, center, iconRadius)
    drawCategoryIcon(context, index, point)
  }

  context.setFillColor(new Color("#0b0d0e", 0.94))
  context.fillEllipse(new Rect(center.x - 16, center.y - 16, 32, 32))
  const overall = Math.round(scores.reduce((sum, score) => sum + score, 0) / CATEGORIES.length)
  context.setTextColor(COLORS.text)
  context.setFont(Font.boldSystemFont(15))
  context.drawTextInRect(String(overall), new Rect(center.x - 20, center.y - 11, 40, 19))
  context.setTextColor(COLORS.muted)
  context.setFont(Font.boldSystemFont(4.5))
  context.drawTextInRect("OVERALL", new Rect(center.x - 20, center.y + 6, 40, 7))
  return context.getImage()
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

function createSmallWidget(data) {
  const streak = currentStreak(data)
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.background
  widget.setPadding(9, 10, 7, 10)
  widget.url = APP_URL
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)

  const header = widget.addStack()
  header.centerAlignContent()
  header.addSpacer()
  const streakText = header.addText(`🔥 ${streak} ${streak === 1 ? "day" : "days"}`)
  streakText.font = Font.boldSystemFont(streak >= 100 ? 26 : 30)
  streakText.textColor = COLORS.text
  streakText.minimumScaleFactor = 0.7
  streakText.centerAlignText()
  header.addSpacer()

  const chart = widget.addImage(radarImage(categoryScores(data)))
  chart.imageSize = new Size(130, 96)
  chart.centerAlignImage()
  return widget
}

function createWidget(data) {
  const family = config.widgetFamily || "medium"
  const isSmall = family === "small"
  if (isSmall) return createSmallWidget(data)

  const summary = dailySummary(data)
  const streak = currentStreak(data)
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

function createAccessoryWidget(data, family) {
  const streak = currentStreak(data)
  const scores = categoryScores(data)
  const overall = Math.round(scores.reduce((sum, score) => sum + score, 0) / CATEGORIES.length)
  const widget = new ListWidget()
  widget.url = APP_URL
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)

  if (family === "accessoryInline") {
    const text = widget.addText(`🔥 ${streak} days · Overall ${overall}`)
    text.font = Font.semiboldSystemFont(12)
    return widget
  }

  widget.addAccessoryWidgetBackground = true
  if (family === "accessoryCircular") {
    widget.setPadding(5, 5, 5, 5)
    widget.addSpacer()
    const title = widget.addText("LAGAN")
    title.font = Font.boldSystemFont(7)
    title.centerAlignText()
    const value = widget.addText(String(overall))
    value.font = Font.boldSystemFont(18)
    value.centerAlignText()
    widget.addSpacer()
    return widget
  }

  widget.setPadding(6, 8, 5, 8)
  const header = widget.addStack()
  const streakText = header.addText(`🔥 ${streak} ${streak === 1 ? "DAY" : "DAYS"}`)
  streakText.font = Font.boldSystemFont(10)
  header.addSpacer()
  const overallText = header.addText(`${overall} OVERALL`)
  overallText.font = Font.semiboldSystemFont(8)
  widget.addSpacer(4)

  const iconRow = widget.addStack()
  iconRow.centerAlignContent()
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const cell = iconRow.addStack()
    cell.layoutVertically()
    cell.centerAlignContent()
    const symbol = SFSymbol.named(CATEGORY_SYMBOLS[index])
    symbol.applyFont(Font.boldSystemFont(10))
    const icon = cell.addImage(symbol.image)
    icon.imageSize = new Size(11, 11)
    icon.tintColor = new Color(CATEGORY_COLORS[index])
    const value = cell.addText(String(scores[index]))
    value.font = Font.boldSystemFont(7)
    value.centerAlignText()
    if (index < CATEGORIES.length - 1) iconRow.addSpacer()
  }
  return widget
}

function createErrorWidget(message, family) {
  const widget = new ListWidget()
  const isAccessory = family?.startsWith("accessory")
  if (family === "accessoryInline") {
    const text = widget.addText("LAGAN · Open Scriptable")
    text.font = Font.semiboldSystemFont(12)
    return widget
  }
  if (isAccessory) widget.addAccessoryWidgetBackground = true
  else widget.backgroundColor = COLORS.background
  widget.setPadding(isAccessory ? 8 : 14, isAccessory ? 8 : 14, isAccessory ? 8 : 14, isAccessory ? 8 : 14)
  const title = widget.addText("LAGAN")
  title.font = Font.boldSystemFont(11)
  if (!isAccessory) title.textColor = COLORS.lime
  widget.addSpacer(isAccessory ? 4 : 10)
  const text = widget.addText(message)
  text.font = Font.mediumSystemFont(isAccessory ? 9 : 11)
  if (!isAccessory) text.textColor = COLORS.text
  text.lineLimit = isAccessory ? 2 : 4
  widget.url = APP_URL
  widget.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)
  return widget
}

const family = config.widgetFamily || "medium"
const isAccessory = family.startsWith("accessory")
let widget
try {
  const session = await refreshSession()
  const data = await loadLaganData(session)
  widget = isAccessory ? createAccessoryWidget(data, family) : createWidget(data)
} catch (error) {
  widget = createErrorWidget(String(error.message || error), family)
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
