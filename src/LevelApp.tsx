import {
  Archive, ArrowLeft, BarChart3, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Download, Dumbbell, Flame, Focus, Gauge, Home, Lightbulb, Minus, Pencil, Plus,
  RotateCcw, Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload,
  UserRound, UsersRound, X, LogOut, Cloud, History as HistoryIcon, RefreshCw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AuthScreen } from './AuthScreen'
import { useAccount, useCloudSync } from './lib/account'
import { createStarterHabit, HABIT_PRESETS, uid } from './lib/data'
import {
  completionKey, completionRatio, dailyRatio, dateKey, dateRange, habitStreak, isScheduled,
  overallScore, scoresFor, shiftDate, streaksFor, totalCompletions, versionOn, xpFor,
} from './lib/scoring'
import { useLevelStore } from './lib/store'
import {
  CATEGORIES, CATEGORY_META, type AppData, type Category, type Habit, type HabitKind,
} from './lib/types'

type Tab = 'home' | 'today' | 'history' | 'habits' | 'settings'
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FULL_WEEK = [0, 1, 2, 3, 4, 5, 6]

const CATEGORY_ICONS: Record<Category, typeof Dumbbell> = {
  Physical: Dumbbell, Social: UsersRound, Discipline: ShieldCheck,
  Mental: Lightbulb, Finance: CircleDollarSign, Ambition: TrendingUp,
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
  const dataPoints = CATEGORIES.map((category, index) => pointAt(index, (scores[category] ?? 0) / 100).join(',')).join(' ')
  const overall = overallScore(scores)
  return <svg className="radar" viewBox="0 0 320 320" role="img" aria-label={`Overall attribute score ${overall} out of 100`}>
    <defs>
      <filter id="radarGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <radialGradient id="radarFill"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#fff" stopOpacity=".08" /></radialGradient>
    </defs>
    {[.25, .5, .75, 1].map((level) => <polygon key={level} points={pointsFor(level)} className="radar-grid" />)}
    {CATEGORIES.map((category, index) => { const [x, y] = pointAt(index, 1); return <line key={category} x1={center} y1={center} x2={x} y2={y} className="radar-axis" /> })}
    <polygon points={dataPoints} className="radar-data" filter="url(#radarGlow)" />
    {CATEGORIES.map((category, index) => {
      const [x, y] = pointAt(index, 1.21)
      return <g key={category}><circle cx={x} cy={y - 4} r="3" fill={CATEGORY_META[category].color} /><text x={x} y={y + 10} className="radar-label" textAnchor="middle">{category.toUpperCase()}</text></g>
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

interface HabitDraft { name: string; category: Category; weekdays: number[]; kind: HabitKind; target: number; unit: string }

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
  const [starters, setStarters] = useState<Category[]>(['Physical', 'Mental'])
  const toggle = (list: Category[], item: Category, setter: (next: Category[]) => void) => setter(list.includes(item) ? list.filter((value) => value !== item) : [...list, item])
  const finish = (skip = false) => {
    const today = dateKey()
    onFinish({ version: 1, name: skip ? '' : name.trim(), onboarded: true, focusAreas: skip ? [] : focus, habits: (skip ? [] : starters).map((category) => createStarterHabit(category, today)), completions: {}, challenges: {} })
  }
  const starterName = (category: Category) => category === 'Physical' ? 'Exercise for 30 minutes' : category === 'Social' ? 'Reach out to a friend' : category === 'Discipline' ? 'Complete a focused work session' : category === 'Mental' ? 'Read for 20 minutes' : category === 'Finance' ? 'Review spending' : 'Take one step toward a goal'
  return <main className="onboarding">
    <div className="brand-mark"><span>LA</span></div><p className="eyebrow">BUILD YOUR CHARACTER</p><h1>Level up your<br />real life.</h1>
    <p className="onboarding-copy">Turn daily actions into visible progress across the six attributes that shape who you become.</p>
    <label className="field-label onboarding-name">WHAT SHOULD WE CALL YOU?<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
    <span className="field-label">CHOOSE YOUR FOCUS</span><div className="choice-grid">{CATEGORIES.map((category) => <button key={category} className={focus.includes(category) ? 'selected' : ''} onClick={() => toggle(focus, category, setFocus)}><CategoryIcon category={category} />{category}<Check size={15} /></button>)}</div>
    <span className="field-label starter-label">START WITH THESE HABITS</span><div className="starter-list">{CATEGORIES.map((category) => <button key={category} className={starters.includes(category) ? 'selected' : ''} onClick={() => toggle(starters, category, setStarters)}><span><CategoryIcon category={category} /><span><strong>{starterName(category)}</strong><small>{category}</small></span></span><span className="check-box"><Check size={15} /></span></button>)}</div>
    <button className="button primary full" onClick={() => finish()}>Start leveling up <ChevronRight size={18} /></button><button className="button demo full" onClick={onDemo}><Sparkles size={17} /> Try demo</button><button className="text-button" onClick={() => finish(true)}>Skip for now</button>
  </main>
}

function Header({ data, mode }: { data: AppData; mode: 'real' | 'demo' }) {
  const xp = xpFor(data), level = Math.floor(xp / 200) + 1, levelXp = xp % 200
  return <header className="top-header"><div className="brand-small">LA</div><div className="level-status"><div><span>LEVEL {level}</span><span>{levelXp} / 200 XP</span></div><div className="xp-track"><span style={{ width: `${(levelXp / 200) * 100}%` }} /></div></div>{mode === 'demo' && <span className="demo-badge">DEMO</span>}</header>
}

function EmptyState({ icon, title, body, action, onAction }: { icon: ReactNode; title: string; body: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{body}</p><button className="button ghost" onClick={onAction}>{action}</button></div>
}

function TodayScreen({ data, setData, goHabits }: { data: AppData; setData: (updater: (data: AppData) => AppData) => void; goHabits: () => void }) {
  const today = dateKey()
  const habits = data.habits.filter((habit) => isScheduled(habit, today))
  const ratio = habits.length ? habits.reduce((sum, habit) => sum + completionRatio(data, habit, today), 0) / habits.length : 0
  const streaks = streaksFor(data)
  const [adding, setAdding] = useState(false)
  const [openedAt] = useState(() => new Date())
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(openedAt)
  const greeting = openedAt.getHours() < 12 ? 'Good morning' : openedAt.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const updateHabit = (habit: Habit, value: number) => setData((current) => {
    const key = completionKey(habit.id, today), completions = { ...current.completions }
    if (value <= 0) delete completions[key]; else completions[key] = { value, updatedAt: new Date().toISOString() }
    return { ...current, completions }
  })
  const addHabit = (draft: HabitDraft) => { setData((current) => ({ ...current, habits: [...current.habits, { id: uid(), createdDate: today, versions: [{ ...draft, effectiveDate: today }] }] })); setAdding(false) }
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
    setData((current) => ({ ...current, habits: editing && editing !== 'new' ? current.habits.map((habit) => habit.id === editing.id ? { ...habit, versions: [...habit.versions.filter((version) => version.effectiveDate !== today), { ...draft, effectiveDate: today }] } : habit) : [...current.habits, { id: uid(), createdDate: today, versions: [{ ...draft, effectiveDate: today }] }] }))
    setEditing(null)
  }
  const archive = (habit: Habit) => { if (confirm('Archive this habit? Its history will be kept.')) setData((current) => ({ ...current, habits: current.habits.map((item) => item.id === habit.id ? { ...item, archivedDate: dateKey() } : item) })) }
  const remove = (habit: Habit) => {
    if (!confirm('Permanently delete this habit and its completion history?')) return
    setData((current) => ({ ...current, habits: current.habits.filter((item) => item.id !== habit.id), completions: Object.fromEntries(Object.entries(current.completions).filter(([key]) => !key.startsWith(`${habit.id}:`))) }))
  }
  return <div className="screen">
    <section className="page-heading"><p className="eyebrow">YOUR ROUTINE</p><h1>Habits</h1><p>Small actions. Permanent upgrades.</p></section>
    <div className="filter-scroll"><button className={filter === 'All' ? 'selected' : ''} onClick={() => setFilter('All')}>All</button>{CATEGORIES.map((category) => <button key={category} className={filter === category ? 'selected' : ''} style={filter === category ? { borderColor: CATEGORY_META[category].color, color: CATEGORY_META[category].color } : {}} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="section-title"><div><h2>Active habits</h2><span>{filtered.length} shown</span></div><button className="icon-button accent" onClick={() => setEditing('new')} aria-label="Create habit"><Plus size={20} /></button></div>
    {filtered.length === 0 ? <EmptyState icon={<Target />} title="No habits here yet" body={filter === 'All' ? 'Create your first repeatable action.' : `Add a ${filter.toLowerCase()} habit to build this attribute.`} action="Create habit" onAction={() => setEditing('new')} /> : <div className="manage-list">{filtered.map((habit) => {
      const version = versionOn(habit, dateKey())!, streak = habitStreak(data, habit)
      return <article key={habit.id} className="manage-card"><button className="manage-card-main" onClick={() => setHistoryHabit(habit)}><CategoryIcon category={version.category} /><span><strong>{version.name}</strong><small>{version.weekdays.length === 7 ? 'Every day' : `${version.weekdays.length} days/week`} · {version.kind === 'numeric' ? `${version.target} ${version.unit}` : 'Once'}</small></span><ChevronRight size={17} /></button><div className="habit-card-footer"><span><Flame size={14} /> {streak} day streak</span><div><button onClick={() => setEditing(habit)} aria-label={`Edit ${version.name}`}><Pencil size={16} /></button><button onClick={() => archive(habit)} aria-label={`Archive ${version.name}`}><Archive size={16} /></button><button onClick={() => remove(habit)} aria-label={`Delete ${version.name}`}><Trash2 size={16} /></button></div></div></article>
    })}</div>}
    {data.habits.some((habit) => habit.archivedDate) && <details className="archived"><summary>Archived habits ({data.habits.filter((habit) => habit.archivedDate).length})</summary>{data.habits.filter((habit) => habit.archivedDate).map((habit) => <div key={habit.id}><span>{versionOn(habit, shiftDate(habit.archivedDate!, -1))?.name}</span><button onClick={() => setData((current) => ({ ...current, habits: current.habits.map((item) => item.id === habit.id ? { ...item, archivedDate: undefined } : item) }))}>Restore</button></div>)}</details>}
    {editing && <Modal title={editing === 'new' ? 'Create a habit' : 'Edit habit'} onClose={() => setEditing(null)}><HabitForm habit={editing === 'new' ? undefined : editing} onSave={save} onCancel={() => setEditing(null)} /></Modal>}
    {historyHabit && <HabitHistory data={data} habit={historyHabit} onClose={() => setHistoryHabit(null)} />}
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

function HabitHistory({ data, habit, onClose }: { data: AppData; habit: Habit; onClose: () => void }) {
  const current = versionOn(habit, dateKey()) ?? habit.versions[habit.versions.length - 1]
  const days = dateRange(shiftDate(dateKey(), -27), dateKey())
  return <Modal title={current.name} onClose={onClose}><div className="history-summary"><CategoryIcon category={current.category} size={22} /><div><strong>{habitStreak(data, habit)} day streak</strong><span>Current run</span></div></div><p className="field-label">LAST 28 DAYS</p><div className="history-grid">{days.map((day) => { const scheduled = isScheduled(habit, day), ratio = completionRatio(data, habit, day); return <div key={day} title={`${day}: ${scheduled ? `${Math.round(ratio * 100)}%` : 'not scheduled'}`} className={!scheduled ? 'empty' : ratio >= 1 ? 'done' : ratio > 0 ? 'partial' : 'missed'} /> })}</div><div className="history-legend"><span><i className="done" />Complete</span><span><i className="partial" />Partial</span><span><i className="missed" />Missed</span></div><button className="button primary full" onClick={onClose}>Done</button></Modal>
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
  let scheduled = 0, earned = 0
  habits.forEach((habit) => days.forEach((day) => { if (versionOn(habit, day)?.category === category && isScheduled(habit, day)) { scheduled += 1; earned += completionRatio(data, habit, day) } }))
  return <Modal title={category} onClose={onClose}><div className="attribute-hero" style={{ '--category': CATEGORY_META[category].color, '--soft': CATEGORY_META[category].soft } as CSSProperties}><CategoryIcon category={category} size={24} /><strong>{score ?? '—'}</strong><span>{score === null ? 'No scheduled data' : 'Consistency score'}</span></div><p className="calculation-copy">Score = completed target progress across scheduled {category.toLowerCase()} habits in the last 7 calendar days.</p><div className="calculation"><span><strong>{earned.toFixed(1)}</strong> targets completed</span><span>÷</span><span><strong>{scheduled}</strong> targets scheduled</span><span>=</span><strong>{score ?? 0}%</strong></div><p className="field-label">CONTRIBUTING HABITS</p>{habits.length ? <div className="detail-habits">{habits.map((habit) => <div key={habit.id}><CategoryIcon category={category} /><span>{versionOn(habit, today)?.name ?? habit.versions.at(-1)?.name}</span></div>)}</div> : <p className="muted">No habits were scheduled for this attribute.</p>}<button className="button primary full" onClick={onClose}>Done</button></Modal>
}

function SettingsScreen({ data, setData, mode, onDemo, onFresh, onImport, goHabits, accountEmail, username, syncState, onSignOut }: { data: AppData; setData: (updater: (data: AppData) => AppData) => void; mode: 'real' | 'demo'; onDemo: () => void; onFresh: () => void; onImport: (raw: string) => void; goHabits: () => void; accountEmail?: string; username: string; syncState: 'idle' | 'loading' | 'saved' | 'error'; onSignOut: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null), [name, setName] = useState(data.name)
  const [refreshing, setRefreshing] = useState(false)
  const exportData = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `lagan-backup-${dateKey()}.json`; link.click(); URL.revokeObjectURL(link.href) }
  const importFile = async (file?: File) => { if (!file) return; try { onImport(await file.text()) } catch (error) { alert(error instanceof Error ? error.message : 'Could not import this file.') } if (fileRef.current) fileRef.current.value = '' }
  const reset = () => { if (confirm('Reset LAGAN? This permanently removes your real habits, history, and XP from this device.')) onFresh() }
  const refreshApp = async () => {
    setRefreshing(true)
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.update()))
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map((cacheName) => caches.delete(cacheName)))
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
    <div className="about"><div className="brand-small">LA</div><strong>LAGAN</strong><span>Version 1.1 · Secure cloud sync</span><p>{accountEmail ? 'Your progress is synced to your account.' : 'Demo data stays on this device.'}</p></div>
  </div>
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: typeof Home }[] = [{ id: 'home', label: 'Home', icon: Home }, { id: 'today', label: 'Today', icon: CalendarDays }, { id: 'history', label: 'History', icon: HistoryIcon }, { id: 'habits', label: 'Habits', icon: Focus }, { id: 'settings', label: 'Settings', icon: Settings }]
  return <nav className="bottom-nav" aria-label="Main navigation">{items.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><Icon size={21} strokeWidth={tab === item.id ? 2.5 : 1.8} /><span>{item.label}</span></button> })}</nav>
}

export default function LevelApp() {
  const { data, setData, mode, setMode, refreshDemo, resetReal, importData } = useLevelStore()
  const { session, username, loading, signOut } = useAccount()
  const syncState = useCloudSync(data, setData, session?.user.id, mode)
  const [tab, setTab] = useState<Tab>('home')
  const scores = useMemo(() => scoresFor(data), [data])
  useEffect(() => {
    if (session && mode !== 'real') setMode('real')
  }, [mode, session, setMode])
  if (loading) return <div className="auth-loading"><div className="brand-mark"><span>LA</span></div><span>Loading your character…</span></div>
  if (!session && mode !== 'demo') return <AuthScreen onDemo={refreshDemo} />
  if (!data.onboarded && mode === 'real') return <Onboarding onFinish={setData} onDemo={refreshDemo} />
  return <div className="app-shell"><Header data={data} mode={mode} /><div className="ambient-orb" style={{ opacity: Math.max(.12, overallScore(scores) / 250) }} /><main>{tab === 'home' && <ProgressScreen data={data} />}{tab === 'today' && <TodayScreen data={data} setData={setData} goHabits={() => setTab('habits')} />}{tab === 'history' && <HistoryScreen data={data} />}{tab === 'habits' && <HabitsScreen data={data} setData={setData} />}{tab === 'settings' && <SettingsScreen data={data} setData={setData} mode={mode} onDemo={refreshDemo} onFresh={resetReal} onImport={importData} goHabits={() => setTab('habits')} accountEmail={session?.user.email} username={username} syncState={syncState} onSignOut={signOut} />}</main><BottomNav tab={tab} setTab={setTab} /></div>
}
