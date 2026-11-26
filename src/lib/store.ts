import { useCallback, useEffect, useState } from 'react'
import { createDemoData, emptyData } from './data'
import { CATEGORIES, type AppData, type AppMode } from './types'

const MODE_KEY = 'level:mode'
const keyFor = (mode: AppMode) => `level:data:${mode}`

const isAppData = (value: unknown): value is AppData => {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<AppData>
  return data.version === 1 && Array.isArray(data.habits) && typeof data.completions === 'object'
}

const loadMode = (): AppMode => localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real'

const loadData = (mode: AppMode): AppData => {
  const saved = localStorage.getItem(keyFor(mode))
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved)
      if (isAppData(parsed)) return parsed
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
    if (!isAppData(parsed)) throw new Error('This is not a valid LAGAN backup.')
    const normalized: AppData = {
      ...parsed,
      focusAreas: parsed.focusAreas.filter((area) => CATEGORIES.includes(area)),
    }
    setModeState('real')
    localStorage.setItem(MODE_KEY, 'real')
    setDataState(normalized)
  }, [])

  return { data, setData, mode, setMode, refreshDemo, resetReal, importData }
}
