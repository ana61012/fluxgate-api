import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import bgImage from './assets/download.jpg'
import ShinyEdgeBackground from './ShinyEdgeBackground'
import './fluxgate.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const GLYPHS = '01{}<>/#$%&*ABCDEF'

// "Decrypt" effect: random glyphs resolve into the real key
function useScramble(text) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    if (!text) return setOut('')
    let i = 0
    const id = setInterval(() => {
      i += 2
      setOut(text.split('').map((c, n) => (n < i ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''))
      if (i >= text.length) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [text])
  return out
}

const Brand = () => <div className="brand"><i />FluxGate</div>

function Backdrop() {
  return (
    <div className="fx-bg">
      <div className="fx-grid" /><div className="fx-orb a" /><div className="fx-orb b" /><div className="fx-scan" />
    </div>
  )
}

function Landing({ onStart }) {
  return (
    <div className="lp">
      {/* your brick animation, tinted purple with CSS so the component stays untouched */}
      <div className="lp-bg"><ShinyEdgeBackground imageSrc={bgImage} /></div>
      <div className="lp-veil" />
      <nav className="lp-nav">
        <Brand />
        <button className="btn ghost" onClick={onStart}>Sign in</button>
      </nav>
      <div className="lp-hero">
        <h1 className="lp-title">FluxGate</h1>
        <p>The enterprise API gateway. Secure your endpoints, manage developer access, and stop abuse with real-time rate limiting.</p>
        <button className="btn lp-cta" onClick={onStart}>Get started</button>
        <div className="lane lp-lane" aria-hidden="true">
          <div className="gate" /><div className="pkt" /><div className="pkt" /><div className="pkt" /><div className="pkt" />
        </div>
        <ul className="chips">
          <li>Redis token bucket</li><li>bcrypt-hashed keys</li><li>JWT sessions</li>
        </ul>
      </div>
    </div>
  )
}

function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', good: false })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg({ text: '', good: false })
    try {
      if (mode === 'signup') {
        await axios.post(`${API}/signup`, null, { params: { email, password } })
        setMode('login'); setMsg({ text: 'Account created. Log in to continue.', good: true })
      } else {
        const body = new URLSearchParams({ username: email, password })
        const res = await axios.post(`${API}/login`, body)
        onLogin(res.data.access_token, email)
      }
    } catch (err) {
      const d = err.response?.data?.detail
      setMsg({ text: typeof d === 'string' ? d : 'Authentication failed. Check your credentials, or wait 30s if the server is waking up.', good: false })
    } finally { setLoading(false) }
  }

  return (
    <div className="auth">
      <div className="hero">
        <h1>Every request,<br /><span>rate-limited</span><br />in microseconds.</h1>
        <p>FluxGate puts a Redis token bucket in front of your API. Sign in, create a key, and watch requests get through or get blocked.</p>
        <div className="lane" aria-hidden="true">
          <div className="gate" /><div className="pkt" /><div className="pkt" /><div className="pkt" /><div className="pkt" />
        </div>
      </div>
      <form className="card" onSubmit={submit}>
        <h3>{mode === 'login' ? 'Log in' : 'Create account'}</h3>
        <p className="sub">{mode === 'login' ? 'Welcome back, developer.' : 'Free, takes ten seconds.'}</p>
        <input className="field" type="email" placeholder="test@best.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field" type="password" placeholder="1234" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {msg.text && <p className={`err ${msg.good ? 'good' : ''}`} key={msg.text}>{msg.text}</p>}
        <div className="row">
          <button className="btn" disabled={loading}>{loading ? 'Working…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg({ text: '', good: false }) }}>
            {mode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Dashboard({ token, email, onLogout }) {
  const [apiKey, setApiKey] = useState('')
  const [inputKey, setInputKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [max, setMax] = useState(5)
  const [remaining, setRemaining] = useState(5)
  const [log, setLog] = useState([])
  const [lastData, setLastData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('curl')
  const shown = useScramble(apiKey)
  const termRef = useRef(null)

  // Visual refill between responses; every server reply re-syncs the real number
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.min(max, r + 1)), 60000 / max)
    return () => clearInterval(id)
  }, [max])
  useEffect(() => { termRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [log])

  const push = (status, msg) => setLog((l) => [...l.slice(-40), { id: crypto.randomUUID(), status, msg, t: new Date().toLocaleTimeString() }])

  const mint = async () => {
    try {
      const res = await axios.post(`${API}/generate-key`, {}, { headers: { Authorization: `Bearer ${token}` } })
      setApiKey(res.data.api_key); setInputKey(res.data.api_key)
      setMax(res.data.rate_limit); setRemaining(res.data.rate_limit); setCopied(false)
    } catch (err) { push(0, err.response?.data?.detail || 'Could not create a key. Try logging in again.') }
  }
  const copy = () => { navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const fire = async () => {
    if (!inputKey) return push(0, 'Create or paste an API key first.')
    const t0 = performance.now()
    try {
      const res = await axios.get(`${API}/secure-data`, {
        params: { _t: Date.now() },
        headers: { 'x-api-key': inputKey, 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' },
        validateStatus: () => true,
      })
      const ms = Math.round(performance.now() - t0)
      if (res.status === 200) {
        setRemaining(res.data.remaining_quota); setLastData(res.data.data)
        push(200, `Allowed, ${res.data.remaining_quota} left, ${ms}ms`)
      } else if (res.status === 429) { setRemaining(0); push(429, 'Rate limit exceeded. Wait for the bucket to refill.') }
      else if (res.status === 401) push(401, 'Invalid API key.')
      else push(res.status, 'Unexpected error from the server.')
    } catch { push(0, 'Network error. The backend may still be waking up.') }
  }
  const burst = async () => {
    setBusy(true)
    for (let i = 0; i < max + 3; i++) { await fire(); await new Promise((r) => setTimeout(r, 180)) }
    setBusy(false)
  }

  const k = apiKey || 'YOUR_API_KEY'
  const snippets = {
    curl: `curl -X GET ${API}/secure-data \\\n  -H "x-api-key: ${k}"`,
    python: `import requests\n\nres = requests.get(\n    "${API}/secure-data",\n    headers={"x-api-key": "${k}"},\n)\nprint(res.json())`,
    node: `const res = await fetch("${API}/secure-data", {\n  headers: { "x-api-key": "${k}" },\n});\nconsole.log(await res.json());`,
  }

  return (
    <>
      <div className="topbar">
        <Brand />
        <div className="row"><span className="mono dim hide-sm">{email}</span><button className="btn ghost" onClick={onLogout}>Log out</button></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Your API key</h3>
          <p className="sub">Shown once. Copy it before you leave this page.</p>
          <div className="keybox mono" key={apiKey}>{apiKey ? shown : 'No key yet. Create one to start sending requests.'}</div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={mint}>{apiKey ? 'Replace key' : 'Create key'}</button>
            <button className="btn ghost" onClick={copy} disabled={!apiKey}>{copied ? 'Copied' : 'Copy key'}</button>
          </div>
          <p className="note">Creating a new key replaces the old one. Send it as the <span className="mono">x-api-key</span> header.</p>
        </div>

        <div className="card">
          <h3>Quota</h3>
          <p className="sub">Each request spends one token. Tokens refill through the Redis token bucket.</p>
          <div className={`bucket ${remaining === 0 ? 'empty' : ''}`} role="img" aria-label={`${remaining} of ${max} requests left`}>
            {Array.from({ length: max }, (_, i) => <div key={i} className={`cell ${i < remaining ? 'full' : ''}`} />)}
          </div>
          <div className="meter"><span><b>{remaining}</b> / {max} left</span><span>{remaining === 0 ? 'Rate limited' : 'Healthy'}</span></div>
          <input className="field mono" style={{ marginTop: 16 }} placeholder="Paste an API key (x-api-key)" value={inputKey} onChange={(e) => setInputKey(e.target.value)} />
          <div className="row">
            <button className="btn" onClick={fire} disabled={busy}>Send request</button>
            <button className="btn ghost" onClick={burst} disabled={busy}>Send {max + 3} at once</button>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Live responses</h3>
          <p className="sub">200 means the gateway let it through. 429 means the bucket was empty.</p>
          <div className="term mono" ref={termRef}>
            {log.length === 0 && <div className="empty cursor">Waiting for the first request</div>}
            {log.map((l) => (
              <div className="line" key={l.id}>
                <span className="t">{l.t}</span>
                <span className={`badge ${l.status === 200 ? 'ok' : 'bad'}`}>{l.status || 'ERR'}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
          {lastData && <pre className="json mono">{JSON.stringify(lastData, null, 2)}</pre>}
        </div>

        <div className="card">
          <h3>Use it in your code</h3>
          <p className="sub">Copy a snippet. Your key is filled in once you create one.</p>
          <div className="tabs">
            {['curl', 'python', 'node'].map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'node' ? 'Node.js' : t === 'curl' ? 'cURL' : 'Python'}</button>
            ))}
          </div>
          <pre className="code mono" key={tab}>{snippets[tab]}</pre>
        </div>
      </div>
    </>
  )
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [session, setSession] = useState(null) // { token, email }, in memory only

  if (!session && showLanding) return <Landing onStart={() => setShowLanding(false)} />

  return (
    <>
      <Backdrop />
      <div className="shell">
        {session
          ? <Dashboard token={session.token} email={session.email} onLogout={() => { setSession(null); setShowLanding(true) }} />
          : <><div className="topbar"><Brand /></div><Auth onLogin={(token, email) => setSession({ token, email })} /></>}
      </div>
    </>
  )
}
