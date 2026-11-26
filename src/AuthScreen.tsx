import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) {
      setMessage({ type: 'error', text: 'Account service is not configured yet.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const cleanUsername = username.trim()
        if (cleanUsername.length < 2) throw new Error('Username must be at least 2 characters.')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: cleanUsername } },
        })
        if (error) throw error
        if (data.session) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            user_id: data.user!.id,
            username: cleanUsername,
          })
          if (profileError) throw profileError
        } else {
          setMessage({ type: 'success', text: 'Check your email to confirm your account, then sign in.' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' })
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-screen">
    <div className="auth-brand"><img src="/lagan-icon-192.png" alt="LAGAN" /></div>
    <p className="eyebrow">BUILD YOUR CHARACTER</p>
    <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
    <p className="auth-copy">{mode === 'login' ? 'Your progress is waiting for you.' : 'Sync your habits and progress securely across devices.'}</p>

    {!isSupabaseConfigured && <div className="auth-config-note"><LockKeyhole size={17} /><span>Cloud accounts need Supabase environment variables. Demo mode remains available.</span></div>}

    <div className="auth-tabs">
      <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(null) }}>Sign in</button>
      <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage(null) }}>Create account</button>
    </div>

    <form className="auth-form" onSubmit={submit}>
      {mode === 'signup' && <label><span>USERNAME</span><div><UserRound size={18} /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="How you’ll appear" required minLength={2} maxLength={32} /></div></label>}
      <label><span>EMAIL</span><div><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div></label>
      <label><span>PASSWORD</span><div><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      {message && <p className={`auth-message ${message.type}`}>{message.text}</p>}
      <button className="button primary full auth-submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
    </form>

    <div className="auth-divider"><span>OR</span></div>
    <button className="button demo full" onClick={onDemo}><Sparkles size={17} /> Explore with demo data</button>
    <p className="auth-privacy">Your password is handled by Supabase Auth and is never stored in LAGAN data.</p>
  </main>
}
