import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import type { AppData, AppMode } from './types'
import { supabase } from './supabase'

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
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!supabase || !userId || mode !== 'real') {
      readyForUser.current = null
      queueMicrotask(() => setSyncState('idle'))
      return
    }
    const client = supabase
    let active = true
    readyForUser.current = null
    queueMicrotask(() => setSyncState('loading'))
    const load = async () => {
      const { data: row, error } = await client.from('level_data').select('data').eq('user_id', userId).maybeSingle()
      if (!active) return
      if (error) {
        setSyncState('error')
        return
      }
      if (row?.data) {
        setData(row.data as AppData)
      } else {
        const { error: saveError } = await client.from('level_data').upsert({ user_id: userId, data })
        if (saveError) {
          setSyncState('error')
          return
        }
      }
      readyForUser.current = userId
      setSyncState('saved')
    }
    void load()
    return () => { active = false }
    // Data is intentionally captured once: remote state wins on initial account load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mode, setData])

  useEffect(() => {
    if (!supabase || !userId || mode !== 'real' || readyForUser.current !== userId) return
    const client = supabase
    const timeout = window.setTimeout(async () => {
      setSyncState('loading')
      const { error } = await client.from('level_data').upsert({
        user_id: userId,
        data,
        updated_at: new Date().toISOString(),
      })
      setSyncState(error ? 'error' : 'saved')
    }, 450)
    return () => window.clearTimeout(timeout)
  }, [data, mode, userId])

  return syncState
}
