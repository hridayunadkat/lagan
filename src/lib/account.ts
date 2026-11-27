import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { emptyData } from './data'
import { normalizeAppData } from './store'
import type { AppData, AppMode } from './types'
import { supabase } from './supabase'

const REAL_DATA_OWNER_KEY = 'level:real-owner'
const dirtyKeyFor = (userId: string) => `level:sync-dirty:${userId}`
type SyncState = 'idle' | 'loading' | 'saved' | 'error'

export function useAccount() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setLoading(false))
      return
    }
    const client = supabase
    client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      queueMicrotask(() => setUsername(''))
      return
    }
    const client = supabase
    let active = true
    const loadProfile = async () => {
      const fallback = String(session.user.user_metadata.username ?? '').trim()
      const { data } = await client.from('profiles').select('username').eq('user_id', session.user.id).maybeSingle()
      if (data?.username) {
        if (active) setUsername(data.username)
        return
      }
      if (fallback) {
        const { error } = await client.from('profiles').upsert({ user_id: session.user.id, username: fallback })
        if (!error && active) setUsername(fallback)
      }
    }
    void loadProfile()
    return () => { active = false }
  }, [session])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  return { session, username, loading, signOut }
}

export function useCloudSync(
  data: AppData,
  setData: (update: AppData | ((current: AppData) => AppData)) => void,
  userId: string | undefined,
  mode: AppMode,
) {
  const readyForUser = useRef<string | null>(null)
  const saveQueue = useRef(Promise.resolve())
  const saveRevision = useRef(0)
  const skipSaveForData = useRef<AppData | null>(null)
  const [status, setStatus] = useState<{ state: SyncState; userId?: string }>({ state: 'idle' })

  useEffect(() => {
    saveRevision.current += 1
    if (!supabase || !userId || mode !== 'real') {
      readyForUser.current = null
      queueMicrotask(() => setStatus({ state: 'idle' }))
      return
    }
    const client = supabase
    let active = true
    readyForUser.current = null
    const localOwner = localStorage.getItem(REAL_DATA_OWNER_KEY)
    const switchedAccounts = Boolean(localOwner && localOwner !== userId)
    if (switchedAccounts) setData(emptyData())
    queueMicrotask(() => setStatus({ state: 'loading', userId }))
    const load = async () => {
      const { data: row, error } = await client.from('level_data').select('data, updated_at').eq('user_id', userId).maybeSingle()
      if (!active) return
      if (error) {
        setStatus({ state: 'error', userId })
        return
      }
      if (row?.data) {
        const normalized = normalizeAppData(row.data)
        if (!normalized) {
          setStatus({ state: 'error', userId })
          return
        }
        const dirtyAt = localOwner === userId ? localStorage.getItem(dirtyKeyFor(userId)) : null
        const remoteUpdatedAt = typeof row.updated_at === 'string' ? Date.parse(row.updated_at) : 0
        const localChangedAt = dirtyAt ? Date.parse(dirtyAt) : 0
        if (localChangedAt > remoteUpdatedAt) {
          const updatedAt = new Date().toISOString()
          const { error: saveError } = await client.from('level_data').upsert({
            user_id: userId,
            data,
            updated_at: updatedAt,
          })
          if (saveError) {
            setStatus({ state: 'error', userId })
            return
          }
          localStorage.removeItem(dirtyKeyFor(userId))
        } else {
          skipSaveForData.current = normalized
          setData(normalized)
          localStorage.removeItem(dirtyKeyFor(userId))
        }
      } else {
        const initialData = switchedAccounts ? emptyData() : data
        setData(initialData)
        const { error: saveError } = await client.from('level_data').upsert({ user_id: userId, data: initialData })
        if (saveError) {
          setStatus({ state: 'error', userId })
          return
        }
        localStorage.removeItem(dirtyKeyFor(userId))
      }
      localStorage.setItem(REAL_DATA_OWNER_KEY, userId)
      readyForUser.current = userId
      setStatus({ state: 'saved', userId })
    }
    void load()
    return () => { active = false }
    // Data is intentionally captured once: remote state wins on initial account load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, setData])

  useEffect(() => {
    if (!supabase || !userId || mode !== 'real' || readyForUser.current !== userId) return
    if (skipSaveForData.current === data) {
      skipSaveForData.current = null
      return
    }
    const client = supabase
    const revision = ++saveRevision.current
    localStorage.setItem(dirtyKeyFor(userId), new Date().toISOString())
    const timeout = window.setTimeout(() => {
      setStatus({ state: 'loading', userId })
      saveQueue.current = saveQueue.current.then(async () => {
        if (revision !== saveRevision.current || readyForUser.current !== userId) return
        const { error } = await client.from('level_data').upsert({
          user_id: userId,
          data,
          updated_at: new Date().toISOString(),
        })
        if (revision === saveRevision.current && readyForUser.current === userId) {
          if (!error) localStorage.removeItem(dirtyKeyFor(userId))
          setStatus({ state: error ? 'error' : 'saved', userId })
        }
      })
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [data, mode, userId])

  return status
}
