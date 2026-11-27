import {
  Archive, ArrowLeft, BarChart3, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Brain, DoorStairwell, Download, Dumbbell, Flame, Focus, Gauge, Home, Minus, Pencil, Plus,
  RotateCcw, Settings, Sparkles, Target, Trash2, Upload,
  UserRound, UsersRound, X, LogOut, Cloud, History as HistoryIcon, RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AuthScreen } from './AuthScreen'
import { useAccount, useCloudSync } from './lib/account'
import { createPresetHabit, HABIT_PRESETS, uid } from './lib/data'
import {
  addHabit as addHabitToData,
  archiveHabit as archiveHabitInData,
  deleteHabit as deleteHabitFromData,
  editHabit as editHabitInData,
  restartHabit as restartHabitInData,
  type HabitDraft,
} from './lib/habits'
import {
  completionKey, completionRatio, dailyRatio, dateKey, dateRange, habitStreak, isScheduled,
  overallScore, scoreBreakdownFor, scoresFor, shiftDate, streaksFor, totalCompletions, versionOn, xpFor,
} from './lib/scoring'
import { isAppData, useLevelStore } from './lib/store'
import {
  CATEGORIES, CATEGORY_META, type AppData, type Category, type Habit,
} from './lib/types'

type Tab = 'home' | 'today' | 'history' | 'habits' | 'settings'
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FULL_WEEK = [0, 1, 2, 3, 4, 5, 6]

const CATEGORY_ICONS: Record<Category, typeof Dumbbell> = {
  Physical: Dumbbell, Social: UsersRound, Discipline: Pencil,
  Mental: Brain, Finance: CircleDollarSign, Ambition: DoorStairwell,
}

function CategoryIcon({ category, size = 18 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICONS[category]
  return <span className="category-icon" style={{ color: CATEGORY_META[category].color, background: CATEGORY_META[category].soft }}><Icon size={size} strokeWidth={2.2} /></span>
}

function RadarChart({ scores }: { scores: Record<Category, number | null> }) {
  const center = 160
  const radius = 112
  const pointAt = (index: number, amount: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 6
    return [center + Math.cos(angle) * radius * amount, center + Math.sin(angle) * radius * amount]
  }
  const pointsFor = (amount: number) => CATEGORIES.map((_, index) => pointAt(index, amount).join(',')).join(' ')
  const dataPoints = CATEGORIES.map((category, index) => pointAt(index, .34 + ((scores[category] ?? 0) / 100) * .66))
  const smoothPath = dataPoints.map((point, index) => {
    const previous = dataPoints[(index - 1 + dataPoints.length) % dataPoints.length]
    const next = dataPoints[(index + 1) % dataPoints.length]
    const afterNext = dataPoints[(index + 2) % dataPoints.length]
    const control1 = [point[0] + (next[0] - previous[0]) * .12, point[1] + (next[1] - previous[1]) * .12]
    const control2 = [next[0] - (afterNext[0] - point[0]) * .12, next[1] - (afterNext[1] - point[1]) * .12]
    return `${index === 0 ? `M ${point[0]} ${point[1]}` : ''} C ${control1[0]} ${control1[1]}, ${control2[0]} ${control2[1]}, ${next[0]} ${next[1]}`
  }).join(' ') + ' Z'
  const overall = overallScore(scores)
  return <svg className="radar" viewBox="0 0 320 320" role="img" aria-label={`Overall attribute score ${overall} out of 100`}>
    <defs>
      <filter id="radarGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <radialGradient id="radarFill"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#fff" stopOpacity=".08" /></radialGradient>
    </defs>
    {[.25, .5, .75, 1].map((level) => <polygon key={level} points={pointsFor(level)} className="radar-grid" />)}
    {CATEGORIES.map((category, index) => { const [x, y] = pointAt(index, 1); return <line key={category} x1={center} y1={center} x2={x} y2={y} className="radar-axis" /> })}
    <path d={smoothPath} className="radar-data" filter="url(#radarGlow)" />
    {CATEGORIES.map((category, index) => {
      const [x, y] = pointAt(index, 1.21)
      const Icon = CATEGORY_ICONS[category]
      return <Icon key={category} x={x - 9} y={y - 9} width={18} height={18} color={CATEGORY_META[category].color} strokeWidth={2.4} aria-label={category} />
    })}
    <circle cx={center} cy={center} r="38" className="radar-center" />
    <text x={center} y={center + 5} className="radar-score" textAnchor="middle">{overall}</text>
    <text x={center} y={center + 22} className="radar-score-label" textAnchor="middle">OVERALL</text>
  </svg>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-handle" /><div className="modal-title"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}
    </section>
  </div>
}

function HabitForm({ habit, onSave, onCancel }: { habit?: Habit; onSave: (draft: HabitDraft) => void; onCancel: () => void }) {
  const current = habit ? versionOn(habit, dateKey()) ?? habit.versions[habit.versions.length - 1] : undefined
  const [draft, setDraft] = useState<HabitDraft>({
    name: current?.name ?? '', category: current?.category ?? 'Physical',
    weekdays: current?.weekdays ?? FULL_WEEK, kind: current?.kind ?? 'checkbox',
    target: current?.target ?? 1, unit: current?.unit ?? 'time',
  })
  const toggleDay = (day: number) => setDraft((value) => ({ ...value, weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort() }))
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim() && draft.weekdays.length) onSave({ ...draft, name: draft.name.trim() }) }}>
    {!habit && <div><span className="field-label">QUICK PRESETS</span><div className="preset-grid">{HABIT_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => setDraft({ ...preset, weekdays: FULL_WEEK })}>{preset.name}</button>)}</div></div>}
    <label className="field-label">HABIT NAME<input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="What will you do?" /></label>
    <label className="field-label">ATTRIBUTE<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
    <div><span className="field-label">SCHEDULE</span><div className="weekday-row">{WEEKDAYS.map((day, index) => <button type="button" key={`${day}-${index}`} className={draft.weekdays.includes(index) ? 'selected' : ''} onClick={() => toggleDay(index)}>{day}</button>)}</div></div>
    <div><span className="field-label">TARGET TYPE</span><div className="segmented"><button type="button" className={draft.kind === 'checkbox' ? 'selected' : ''} onClick={() => setDraft({ ...draft, kind: 'checkbox', target: 1, unit: 'time' })}>Complete once</button><button type="button" className={draft.kind === 'numeric' ? 'selected' : ''} onClick={() => setDraft({ ...draft, kind: 'numeric', target: 20, unit: 'minutes' })}>Numeric</button></div></div>
    {draft.kind === 'numeric' && <div className="target-fields"><label className="field-label">TARGET<input type="number" min="1" value={draft.target} onChange={(event) => setDraft({ ...draft, target: Math.max(1, Number(event.target.value)) })} /></label><label className="field-label">UNIT<input value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="minutes" /></label></div>}
    <div className="form-actions"><button type="button" className="button ghost" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">{habit ? 'Save changes' : 'Create habit'}</button></div>
  </form>
}

function Onboarding({ onFinish, onDemo }: { onFinish: (data: AppData) => void; onDemo: () => void }) {
  const [name, setName] = useState('')
  const [focus, setFocus] = useState<Category[]>(['Physical', 'Discipline', 'Mental'])
  const [starters, setStarters] = useState<string[]>(() => HABIT_PRESETS.map((preset) => preset.name))
  const toggle = (list: Category[], item: Category, setter: (next: Category[]) => void) => setter(list.includes(item) ? list.filter((value) => value !== item) : [...list, item])
  const finish = (skip = false) => {
    const today = dateKey()
    const selected = skip ? HABIT_PRESETS : HABIT_PRESETS.filter((preset) => starters.includes(preset.name))
    onFinish({ version: 1, defaultsVersion: 2, name: skip ? '' : name.trim(), onboarded: true, focusAreas: skip ? [] : focus, habits: selected.map((preset) => createPresetHabit(preset, today)), completions: {}, challenges: {} })
  }
  return <main className="onboarding">
    <div className="brand-mark"><img src="/lagan-icon-192.png" alt="LAGAN" /></div><p className="eyebrow">BUILD YOUR CHARACTER</p><h1>Level up your<br />real life.</h1>
    <p className="onboarding-copy">Turn daily actions into visible progress across the six attributes that shape who you become.</p>
    <label className="field-label onboarding-name">WHAT SHOULD WE CALL YOU?<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
    <span className="field-label">CHOOSE YOUR FOCUS</span><div className="choice-grid">{CATEGORIES.map((category) => <button key={category} className={focus.includes(category) ? 'selected' : ''} onClick={() => toggle(focus, category, setFocus)}><CategoryIcon category={category} />{category}<Check size={15} /></button>)}</div>
    <span className="field-label starter-label">YOUR DEFAULT HABITS</span><div className="starter-list">{HABIT_PRESETS.map((preset) => <button key={preset.name} className={starters.includes(preset.name) ? 'selected' : ''} onClick={() => setStarters((current) => current.includes(preset.name) ? current.filter((name) => name !== preset.name) : [...current, preset.name])}><span><CategoryIcon category={preset.category} /><span><strong>{preset.name}</strong><small>{preset.kind === 'numeric' ? `${preset.target} ${preset.unit}` : 'Complete once'} · {preset.category}</small></span></span><span className="check-box"><Check size={15} /></span></button>)}</div>
    <button className="button primary full" onClick={() => finish()}>Start leveling up <ChevronRight size={18} /></button><button className="button demo full" onClick={onDemo}><Sparkles size={17} /> Try demo</button><button className="text-button" onClick={() => finish(true)}>Skip for now</button>
  </main>
}

function Header({ data, mode }: { data: AppData; mode: 'real' | 'demo' }) {
  const xp = xpFor(data), level = Math.floor(xp / 200) + 1, levelXp = xp % 200
  return <header className="top-header"><div className="brand-small"><img src="/lagan-icon-192.png" alt="" /></div><div className="level-status"><div><span>LEVEL {level}</span><span>{levelXp} / 200 XP</span></div><div className="xp-track"><span style={{ width: `${(levelXp / 200) * 100}%` }} /></div></div>{mode === 'demo' && <span className="demo-badge">DEMO</span>}</header>
}

function EmptyState({ icon, title, body, action, onAction }: { icon: ReactNode; title: string; body: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{body}</p><button className="button ghost" onClick={onAction}>{action}</button></div>
}

function TodayScreen({ data, setData, goHabits }: { data: AppData; setData: (updater: (data: AppData) => AppData) => void; goHabits: () => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refreshClock = () => setNow(new Date())
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshClock()
    }
    const interval = window.setInterval(refreshClock, 60_000)
    window.addEventListener('focus', refreshClock)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshClock)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])
  const today = dateKey(now)
  const habits = data.habits.filter((habit) => isScheduled(habit, today))
  const ratio = habits.length ? habits.reduce((sum, habit) => sum + completionRatio(data, habit, today), 0) / habits.length : 0
  const streaks = streaksFor(data)
  const [adding, setAdding] = useState(false)
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const updateHabit = (habit: Habit, value: number) => setData((current) => {
    const actionDay = dateKey()
    const key = completionKey(habit.id, actionDay), completions = { ...current.completions }
    if (value <= 0) delete completions[key]; else completions[key] = { value, updatedAt: new Date().toISOString() }
    return { ...current, completions }
  })
  const addHabit = (draft: HabitDraft) => {
    const actionDay = dateKey()
    setData((current) => addHabitToData(current, draft, actionDay, uid()))
    setAdding(false)
  }
  return <div className="screen">
    <section className="today-heading"><div><p className="date-label">{dateLabel.toUpperCase()}</p><h1>{greeting}{data.name ? `, ${data.name}` : ''}.</h1><p>Keep the momentum alive.</p></div><div className="streak-pill"><Flame size={17} fill="currentColor" /><strong>{streaks.current}</strong></div></section>
    <section className="daily-card compact"><div className="daily-progress-line"><span className="eyebrow">TODAY</span><span>{habits.filter((habit) => completionRatio(data, habit, today) >= 1).length} / {habits.length} habits</span><strong>{Math.round(ratio * 100)}%</strong></div><div className="completion-track"><span style={{ width: `${ratio * 100}%` }} /></div></section>
    <div className="section-title"><div><h2>Daily habits</h2><span>{habits.length} scheduled</span></div><button className="icon-button accent" onClick={() => setAdding(true)} aria-label="Quick add habit"><Plus size={20} /></button></div>
    {habits.length === 0 ? <EmptyState icon={<CalendarDays />} title="Your day is wide open" body="Add a habit to start building your character." action="Add a habit" onAction={() => setAdding(true)} /> : <div className="habit-list">{habits.map((habit) => {
      const version = versionOn(habit, today)!, value = data.completions[completionKey(habit.id, today)]?.value ?? 0, complete = value >= version.target
      return <article key={habit.id} className={`habit-row ${complete ? 'complete' : ''}`}><CategoryIcon category={version.category} /><div className="habit-main"><strong>{version.name}</strong><span>{version.category} · {version.kind === 'numeric' ? `${version.target} ${version.unit}` : 'Complete once'}</span></div>{version.kind === 'numeric' && !complete && <div className="numeric-control"><button onClick={() => updateHabit(habit, Math.max(0, value - Math.max(1, Math.round(version.target / 4))))} aria-label="Decrease"><Minus size={15} /></button><span>{value}</span><button onClick={() => updateHabit(habit, Math.min(version.target, value + Math.max(1, Math.round(version.target / 4))))} aria-label="Increase"><Plus size={15} /></button></div>}<button className={`complete-button ${complete ? 'done' : ''}`} onClick={() => updateHabit(habit, complete ? 0 : version.target)} aria-label={complete ? `Undo ${version.name}` : `Complete ${version.name}`}><Check size={19} /></button></article>
    })}</div>}
    <button className="manage-link" onClick={goHabits}>Manage all habits <ChevronRight size={16} /></button>
    {adding && <Modal title="Quick add habit" onClose={() => setAdding(false)}><HabitForm onSave={addHabit} onCancel={() => setAdding(false)} /></Modal>}
  </div>
}

function HabitsScreen({ data, setData }: { data: AppData; setData: (updater: (data: AppData) => AppData) => void }) {
  const [filter, setFilter] = useState<Category | 'All'>('All')
  const [editing, setEditing] = useState<Habit | null | 'new'>(null)
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null)
  const filtered = data.habits.filter((habit) => !habit.archivedDate).filter((habit) => filter === 'All' || versionOn(habit, dateKey())?.category === filter)
  const save = (draft: HabitDraft) => {
    const today = dateKey()
    setData((current) => editing && editing !== 'new'
      ? editHabitInData(current, editing.id, draft, today)
      : addHabitToData(current, draft, today, uid()))
    setEditing(null)
  }
  const archive = (habit: Habit) => {
    if (!confirm('Archive this habit? Its history will be kept.')) return
    setData((current) => archiveHabitInData(current, habit.id, dateKey()))
    setHistoryHabit(null)
  }
  const remove = (habit: Habit) => {
    if (!confirm('Permanently delete this habit and its completion history?')) return
    setData((current) => deleteHabitFromData(current, habit.id))
    setHistoryHabit(null)
  }
  const edit = (habit: Habit) => {
    setHistoryHabit(null)
    setEditing(habit)
  }
  return <div className="screen">
    <section className="page-heading"><p className="eyebrow">YOUR ROUTINE</p><h1>Habits</h1><p>Small actions. Permanent upgrades.</p></section>
    <div className="filter-scroll"><button className={filter === 'All' ? 'selected' : ''} onClick={() => setFilter('All')}>All</button>{CATEGORIES.map((category) => <button key={category} className={filter === category ? 'selected' : ''} style={filter === category ? { borderColor: CATEGORY_META[category].color, color: CATEGORY_META[category].color } : {}} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="section-title"><div><h2>Active habits</h2><span>{filtered.length} shown</span></div><button className="icon-button accent" onClick={() => setEditing('new')} aria-label="Create habit"><Plus size={20} /></button></div>
    {filtered.length === 0 ? <EmptyState icon={<Target />} title="No habits here yet" body={filter === 'All' ? 'Create your first repeatable action.' : `Add a ${filter.toLowerCase()} habit to build this attribute.`} action="Create habit" onAction={() => setEditing('new')} /> : <div className="manage-list">{filtered.map((habit) => {
      const version = versionOn(habit, dateKey())!, streak = habitStreak(data, habit)
      return <article key={habit.id} className="manage-card"><button className="manage-card-main" onClick={() => setHistoryHabit(habit)}><CategoryIcon category={version.category} /><span><strong>{version.name}</strong><small>{version.weekdays.length === 7 ? 'Every day' : `${version.weekdays.length} days/week`} · {version.kind === 'numeric' ? `${version.target} ${version.unit}` : 'Once'}</small></span><ChevronRight size={17} /></button><div className="habit-card-footer"><span><Flame size={14} /> {streak} day streak</span><div><button onClick={() => edit(habit)} aria-label={`Edit ${version.name}`}><Pencil size={14} /> Edit</button><button onClick={() => archive(habit)} aria-label={`Archive ${version.name}`}><Archive size={14} /> Archive</button><button onClick={() => remove(habit)} aria-label={`Delete ${version.name}`}><Trash2 size={14} /> Delete</button></div></div></article>
    })}</div>}
    {data.habits.some((habit) => habit.archivedDate) && <details className="archived"><summary>Archived habits ({data.habits.filter((habit) => habit.archivedDate).length})</summary>{data.habits.filter((habit) => habit.archivedDate).map((habit) => <div key={habit.id}><span>{versionOn(habit, shiftDate(habit.archivedDate!, -1))?.name}</span><span><button onClick={() => setData((current) => restartHabitInData(current, habit.id, dateKey(), uid()))}>Restart</button><button className="delete" onClick={() => remove(habit)}>Delete</button></span></div>)}</details>}
    {editing && <Modal title={editing === 'new' ? 'Create a habit' : 'Edit habit'} onClose={() => setEditing(null)}><HabitForm habit={editing === 'new' ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} /></Modal>}
    {historyHabit && <HabitHistory data={data} habit={historyHabit} onClose={() => setHistoryHabit(null)} onEdit={() => edit(historyHabit)} onDelete={() => remove(historyHabit)} />}
  </div>
}

function HistoryScreen({ data }: { data: AppData }) {
  const streaks = streaksFor(data)
  const week = dateRange(shiftDate(dateKey(), -6), dateKey())
  const activity = dateRange(shiftDate(dateKey(), -34), dateKey())
  const weeklyScores = Array.from({ length: 8 }, (_, index) => {
    const end = shiftDate(dateKey(), index * -7)
    const scores = scoresFor(data, end)
    return { end, start: shiftDate(end, -6), scores, overall: overallScore(scores) }
  })
  return <div className="screen history-screen">
    <section className="page-heading"><p className="eyebrow">YOUR TIMELINE</p><h1>History</h1><p>Compare the character you’re building.</p></section>
    <section className="stats-row"><div><Flame /><strong>{streaks.current}</strong><span>Current streak</span></div><div><Gauge /><strong>{streaks.longest}</strong><span>Longest streak</span></div><div><Check /><strong>{totalCompletions(data)}</strong><span>Completions</span></div></section>
    <section className="chart-card"><div className="card-title"><div><h2>Weekly completion</h2><span>Last 7 days</span></div><BarChart3 size={19} /></div><div className="weekly-chart">{week.map((day) => { const ratio = dailyRatio(data, day); return <div key={day}><span className="bar-value">{ratio === null ? '—' : `${Math.round(ratio * 100)}`}</span><div className="bar-track"><span style={{ height: `${Math.max(3, (ratio ?? 0) * 100)}%` }} /></div><small>{new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(`${day}T12:00:00`))}</small></div> })}</div></section>
    <section className="chart-card"><div className="card-title"><div><h2>Activity</h2><span>Last 5 weeks</span></div><CalendarDays size={19} /></div><div className="activity-grid">{activity.map((day) => { const ratio = dailyRatio(data, day); return <div key={day} title={`${day}${ratio === null ? ': rest day' : `: ${Math.round(ratio * 100)}%`}`} className={ratio === null ? 'rest' : ratio >= 1 ? 'a4' : ratio >= .66 ? 'a3' : ratio > 0 ? 'a2' : 'a1'} /> })}</div></section>
    <section className="history-weeks"><div className="section-title"><div><h2>Weekly scores</h2><span>Last 8 weeks</span></div></div><div className="weekly-score-list">{weeklyScores.map((item, index) => {
      const previous = weeklyScores[index + 1]
      const change = previous ? item.overall - previous.overall : 0
      return <article className="weekly-score-card" key={item.end}><div className="week-score-heading"><span><strong>{index === 0 ? 'This week' : `${index} week${index === 1 ? '' : 's'} ago`}</strong><small>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${item.start}T12:00:00`))} – {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${item.end}T12:00:00`))}</small></span><span className="week-overall"><strong>{item.overall}</strong>{previous && <small className={change > 0 ? 'up' : change < 0 ? 'down' : ''}>{change > 0 ? '+' : ''}{change}</small>}</span></div><div className="week-attributes">{CATEGORIES.map((category) => <div key={category} title={`${category}: ${item.scores[category] ?? 'No data'}`}><span style={{ background: CATEGORY_META[category].color, width: `${item.scores[category] ?? 0}%` }} /></div>)}</div></article>
    })}</div></section>
  </div>
}

function HabitHistory({ data, habit, onClose, onEdit, onDelete }: {
  data: AppData
  habit: Habit
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const current = versionOn(habit, dateKey()) ?? habit.versions[habit.versions.length - 1]
  const days = dateRange(shiftDate(dateKey(), -27), dateKey())
  return <Modal title={current.name} onClose={onClose}><div className="history-summary"><CategoryIcon category={current.category} size={22} /><div><strong>{habitStreak(data, habit)} day streak</strong><span>Current run</span></div></div><p className="field-label">LAST 28 DAYS</p><div className="history-grid">{days.map((day) => { const scheduled = isScheduled(habit, day), ratio = completionRatio(data, habit, day); return <div key={day} title={`${day}: ${scheduled ? `${Math.round(ratio * 100)}%` : 'not scheduled'}`} className={!scheduled ? 'empty' : ratio >= 1 ? 'done' : ratio > 0 ? 'partial' : 'missed'} /> })}</div><div className="history-legend"><span><i className="done" />Complete</span><span><i className="partial" />Partial</span><span><i className="missed" />Missed</span></div><div className="habit-history-actions"><button className="button ghost" onClick={onEdit}><Pencil size={15} /> Edit habit</button><button className="button danger" onClick={onDelete}><Trash2 size={15} /> Delete</button></div><button className="button primary full" onClick={onClose}>Done</button></Modal>
}

function ProgressScreen({ data }: { data: AppData }) {
  const scores = scoresFor(data)
  const [detail, setDetail] = useState<Category | null>(null)
  return <div className="screen progress-screen">
    <section className="page-heading"><p className="eyebrow">CHARACTER STATS</p><h1>Your progress</h1><p>Built from your last 7 days.</p></section>
    <section className="radar-card"><div className="card-noise" /><RadarChart scores={scores} /></section>
    <div className="score-grid">{CATEGORIES.map((category) => <button key={category} className="score-card" style={{ '--category': CATEGORY_META[category].color, '--soft': CATEGORY_META[category].soft } as CSSProperties} onClick={() => setDetail(category)}><CategoryIcon category={category} size={19} /><span className="score-value">{scores[category] ?? '—'}</span><span className="score-label">{category}</span><small>{scores[category] === null ? 'No data' : 'Last 7 days'}</small><ChevronRight size={15} /></button>)}</div>
    {detail && <AttributeDetail data={data} category={detail} score={scores[detail]} onClose={() => setDetail(null)} />}
  </div>
}

function AttributeDetail({ data, category, score, onClose }: { data: AppData; category: Category; score: number | null; onClose: () => void }) {
  const today = dateKey(), days = dateRange(shiftDate(today, -6), today)
  const habits = data.habits.filter((habit) => days.some((day) => versionOn(habit, day)?.category === category && isScheduled(habit, day)))
  const breakdown = scoreBreakdownFor(data, category, today)
  return <Modal title={category} onClose={onClose}><div className="attribute-hero" style={{ '--category': CATEGORY_META[category].color, '--soft': CATEGORY_META[category].soft } as CSSProperties}><CategoryIcon category={category} size={24} /><strong>{score ?? '—'}</strong><span>{score === null ? 'No scheduled data' : 'Consistency score'}</span></div><p className="calculation-copy">Score = completed target progress across the last 7 days. New habits are normalized against their full weekly schedule after their first scheduled day.</p><div className="calculation"><span><strong>{breakdown.completed.toFixed(1)}</strong> targets completed</span><span>÷</span><span><strong>{breakdown.scheduled}</strong> weekly opportunities</span><span>=</span><strong>{score ?? 0}%</strong></div><p className="field-label">CONTRIBUTING HABITS</p>{habits.length ? <div className="detail-habits">{habits.map((habit) => <div key={habit.id}><CategoryIcon category={category} /><span>{versionOn(habit, today)?.name ?? habit.versions.at(-1)?.name}</span></div>)}</div> : <p className="muted">No habits were scheduled for this attribute.</p>}<button className="button primary full" onClick={onClose}>Done</button></Modal>
}

function SettingsScreen({ data, setData, mode, onDemo, onFresh, onImport, goHabits, accountEmail, username, syncState, onSignOut }: { data: AppData; setData: (updater: (data: AppData) => AppData) => void; mode: 'real' | 'demo'; onDemo: () => void; onFresh: () => void; onImport: (raw: string) => void; goHabits: () => void; accountEmail?: string; username: string; syncState: 'idle' | 'loading' | 'saved' | 'error'; onSignOut: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null), [name, setName] = useState(data.name)
  const [refreshing, setRefreshing] = useState(false)
  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `lagan-backup-${dateKey()}.json`; link.click(); URL.revokeObjectURL(link.href) }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error('This backup is too large to import.')
      const raw = await file.text()
      const parsed: unknown = JSON.parse(raw)
      if (!isAppData(parsed)) throw new Error('This is not a valid LAGAN backup.')
      const confirmed = confirm(`Replace your current data with this backup containing ${parsed.habits.length} habits? The imported data will sync to your account.`)
      if (confirmed) onImport(raw)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not import this file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const reset = () => {
    if (confirm('Reset LAGAN? This permanently removes your real habits, history, and XP from this device and your synced account.')) onFresh()
  }
  const refreshApp = async () => {
    setRefreshing(true)
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.update()
      }
    } finally {
      window.location.reload()
    }
  }
  return <div className="screen">
    <section className="page-heading"><p className="eyebrow">CONFIGURATION</p><h1>Settings</h1><p>Make LAGAN yours.</p></section>
    {mode === 'demo' && <section className="demo-panel"><Sparkles /><div><strong>You’re exploring demo mode</strong><p>Demo history is separate from your real progress.</p></div><button onClick={onFresh}>Sign in</button></section>}
    {accountEmail && <section className="settings-group"><h2>Account</h2><div className="settings-card"><div className="account-row"><div className="account-avatar">{(username || accountEmail).slice(0, 1).toUpperCase()}</div><span><strong>{username || 'LAGAN player'}</strong><small>{accountEmail}</small></span><div className={`sync-badge ${syncState}`}><Cloud size={12} />{syncState === 'loading' ? 'Syncing' : syncState === 'error' ? 'Offline' : 'Synced'}</div></div><button className="setting-row" onClick={onSignOut}><LogOut /><span><strong>Sign out</strong><small>Your local data stays on this device</small></span><ChevronRight /></button></div></section>}
    <section className="settings-group"><h2>Profile</h2><div className="settings-card"><div className="setting-name"><UserRound /><label><span>YOUR NAME</span><input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => setData((current) => ({ ...current, name: name.trim() }))} /></label></div><button className="setting-row" onClick={goHabits}><Target /><span><strong>Manage habits</strong><small>{data.habits.filter((habit) => !habit.archivedDate).length} active habits</small></span><ChevronRight /></button></div></section>
    <section className="settings-group"><h2>Your data</h2><div className="settings-card"><button className="setting-row" onClick={exportData}><Download /><span><strong>Export backup</strong><small>Download your data as JSON</small></span><ChevronRight /></button><button className="setting-row" onClick={() => fileRef.current?.click()}><Upload /><span><strong>Import backup</strong><small>Restore a LAGAN JSON file</small></span><ChevronRight /></button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => importFile(event.target.files?.[0])} /></div></section>
    <section className="settings-group"><h2>App</h2><div className="settings-card"><button className="setting-row" onClick={refreshApp} disabled={refreshing}><RefreshCw className={refreshing ? 'spinning' : ''} /><span><strong>{refreshing ? 'Refreshing…' : 'Refresh app'}</strong><small>Fetch the newest version without deleting your data</small></span><ChevronRight /></button></div></section>
    <section className="settings-group"><h2>Modes</h2><div className="settings-card"><button className="setting-row" onClick={onDemo}><Sparkles /><span><strong>Try demo</strong><small>Explore with believable sample history</small></span><ChevronRight /></button>{mode === 'demo' && <button className="setting-row" onClick={onFresh}><ArrowLeft /><span><strong>Return to real tracking</strong><small>Your real data is waiting</small></span><ChevronRight /></button>}</div></section>
    <section className="settings-group danger-zone"><h2>Danger zone</h2><button className="setting-row" onClick={reset}><RotateCcw /><span><strong>Reset all real data</strong><small>This cannot be undone</small></span><ChevronRight /></button></section>
    <div className="about"><div className="brand-small"><img src="/lagan-icon-192.png" alt="" /></div><strong>LAGAN</strong><span>Version 1.1 · Secure cloud sync</span><p>{accountEmail ? 'Your progress is synced to your account.' : 'Demo data stays on this device.'}</p></div>
  </div>
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: typeof Home }[] = [{ id: 'home', label: 'Home', icon: Home }, { id: 'today', label: 'Today', icon: CalendarDays }, { id: 'history', label: 'History', icon: HistoryIcon }, { id: 'habits', label: 'Habits', icon: Focus }, { id: 'settings', label: 'Settings', icon: Settings }]
  return <nav className="bottom-nav" aria-label="Main navigation">{items.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={21} strokeWidth={tab === item.id ? 2.5 : 1.8} /><span>{item.label}</span></button> })}</nav>
}

export default function LevelApp() {
  const { data, setData, mode, setMode, refreshDemo, resetReal, importData } = useLevelStore()
  const { session, username, loading, signOut } = useAccount()
  const syncStatus = useCloudSync(data, setData, session?.user.id, mode)
  const syncState = syncStatus.state
  const [tab, setTab] = useState<Tab>('home')
  const scores = useMemo(() => scoresFor(data), [data])
  useEffect(() => {
    if (session && mode !== 'real') setMode('real')
  }, [mode, session, setMode])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])
  useEffect(() => {
    if (!data.onboarded || (data.defaultsVersion ?? 0) >= 2) return
    queueMicrotask(() => setData((current) => {
      if (!current.onboarded || (current.defaultsVersion ?? 0) >= 2) return current
      const today = dateKey()
      const habits = current.habits.map((habit) => {
        const version = versionOn(habit, today) ?? habit.versions.at(-1)
        if (version?.name.toLowerCase() !== 'journal' || version.category === 'Discipline') return habit
        return {
          ...habit,
          versions: [...habit.versions.filter((item) => item.effectiveDate !== today), { ...version, effectiveDate: today, category: 'Discipline' as const }],
        }
      })
      return { ...current, defaultsVersion: 2, habits }
    }))
  }, [data.defaultsVersion, data.onboarded, setData])
  const loadingAccountData = Boolean(session && mode === 'real' && syncStatus.userId !== session.user.id)
  if (loading || loadingAccountData) return <div className="auth-loading"><div className="brand-mark"><img src="/lagan-icon-192.png" alt="LAGAN" /></div><span>Loading your character…</span></div>
  if (!session && mode !== 'demo') return <AuthScreen onDemo={refreshDemo} />
  if (!data.onboarded && mode === 'real') return <Onboarding onFinish={setData} onDemo={refreshDemo} />
  return <div className="app-shell"><Header data={data} mode={mode} /><div className="ambient-orb" style={{ opacity: Math.max(.12, overallScore(scores) / 250) }} /><main>{tab === 'home' && <ProgressScreen data={data} />}{tab === 'today' && <TodayScreen data={data} setData={setData} goHabits={() => setTab('habits')} />}{tab === 'history' && <HistoryScreen data={data} />}{tab === 'habits' && <HabitsScreen data={data} setData={setData} />}{tab === 'settings' && <SettingsScreen data={data} setData={setData} mode={mode} onDemo={refreshDemo} onFresh={resetReal} onImport={importData} goHabits={() => setTab('habits')} accountEmail={session?.user.email} username={username} syncState={syncState} onSignOut={signOut} />}</main><BottomNav tab={tab} setTab={setTab} /></div>
}
