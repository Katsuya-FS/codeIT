import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, refreshSession, setAccessToken as setClientToken } from './api';
import { ArrowRight, BookOpen, Braces, ChartNoAxesColumnIncreasing, Check, ChevronDown, CircleHelp, Code2, Flame, GraduationCap, Hexagon, LockKeyhole, LogOut, Menu, Play, Plus, Search, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';

type User = { displayName: string; email: string };
const api = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { void refreshSession().then(session => { if (session) { setUser({ displayName: session.user.displayName, email: session.user.email }); setAccessToken(session.accessToken); } }); }, []);
  const saveUser = (next: User, token: string) => { setUser(next); setAccessToken(token); setClientToken(token); };
  const logout = async () => { try { await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' }); } finally { setUser(null); setAccessToken(null); setClientToken(null); } };
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark"><Braces size={20}/></span><span>code<span className="brand-accent">it</span></span></Link>
      <nav className="main-nav"><a className="nav-active" href="#overview">Overview</a><a href="#continue">My learning</a><a href="#practice">Practice</a><a href="#classroom">Classroom</a></nav>
      <div className="top-actions">{user ? <><button className="icon-button search-button" aria-label="Search"><Search size={18}/></button><button className="profile-button" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><ChevronDown size={15}/></button>{menuOpen && <div className="profile-menu"><div className="profile-menu-name">{user.displayName}</div><div className="profile-menu-email">{user.email}</div><button onClick={logout}><LogOut size={15}/> Sign out</button></div>}</> : <Link className="button button-primary" to="/login">Sign in <ArrowRight size={16}/></Link>}</div>
      <button className="mobile-menu icon-button" aria-label="Open menu"><Menu/></button>
    </header>
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" onAuthenticated={saveUser} setNotice={setNotice}/>} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticated={saveUser} setNotice={setNotice}/>} />
      <Route path="/lessons/:id" element={<LessonPage token={accessToken} setNotice={setNotice}/>} />
      <Route path="/challenges" element={<ChallengePage token={accessToken} setNotice={setNotice}/>} />
      <Route path="*" element={<Dashboard user={user} accessToken={accessToken} setNotice={setNotice}/>} />
    </Routes>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
    <footer className="footer"><span>© 2026 CodeIT Learning</span><span>Built for curious minds <Sparkles size={14}/></span><a href="#help">Help center <CircleHelp size={14}/></a></footer>
  </div>;
}

function AuthPage({ mode, onAuthenticated, setNotice }: { mode: 'login' | 'register'; onAuthenticated: (user: User, token: string) => void; setNotice: (message: string) => void }) {
  const navigate = useNavigate(); const [busy, setBusy] = useState(false); const isRegister = mode === 'register';
  const [values, setValues] = useState({ displayName: '', email: '', password: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const validation = (field: string, value: string) => {
    if (field === 'displayName' && isRegister && value.trim().length < 2) return 'Enter at least 2 characters.';
    if (field === 'email' && !value) return 'Email address is required.';
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    if (field === 'password' && !value) return 'Password is required.';
    if (field === 'password' && isRegister && value.length < 10) return 'Use at least 10 characters.';
    if (field === 'password' && value.length > 128) return 'Use no more than 128 characters.';
    return '';
  };
  const change = (field: string, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError('');
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validation(field, value) }));
  };
  const blur = (field: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validation(field, values[field as keyof typeof values]) }));
  };
  const field = (name: 'displayName' | 'email' | 'password', label: string, input: ReactNode) => <label className="auth-field">{label}{input}{touched[name] && (errors[name] || (values[name] ? 'Looks good.' : '')) && <small className={`field-validation ${errors[name] ? 'field-error' : 'field-valid'}`} role="status">{errors[name] || 'Looks good.'}</small>}</label>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const nextErrors = Object.fromEntries((isRegister ? ['displayName', 'email', 'password'] : ['email', 'password']).map((name) => [name, validation(name, values[name as keyof typeof values])]).filter(([, message]) => message));
    setErrors(nextErrors); setTouched((current) => ({ ...current, displayName: true, email: true, password: true }));
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      const payload = isRegister ? values : { email: values.email, password: values.password };
      const response = await fetch(`${api}/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) {
        const messages = Array.isArray(result.message) ? result.message as string[] : [result.message || 'Unable to continue. Please try again.'];
        if (mode === 'login' && response.status === 401) {
          setFormError('Email or password is incorrect. Check the account details and try again.');
          return;
        }
        const fieldErrors: Record<string, string> = {};
        for (const message of messages) {
          const fieldName = message.toLowerCase().includes('email') ? 'email' : message.toLowerCase().includes('password') ? 'password' : message.toLowerCase().includes('displayname') ? 'displayName' : '';
          if (fieldName) fieldErrors[fieldName] = message;
        }
        setErrors(fieldErrors);
        if (!Object.keys(fieldErrors).length) setNotice(messages.join(' '));
        return;
      }
      onAuthenticated({ displayName: result.user.displayName, email: result.user.email }, result.accessToken); navigate('/');
    } catch { setFormError('Could not reach CodeIT. Start the API with npm run dev, then try again.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-wrap"><div className="auth-card"><div className="auth-icon"><LockKeyhole size={22}/></div><p className="eyebrow">YOUR LEARNING SPACE</p><h1>{isRegister ? 'Start building' : 'Welcome back'}</h1><p className="auth-subtitle">{isRegister ? 'Create your account and begin your Java journey.' : 'Sign in and pick up where you left off.'}</p><form className="auth-form" onSubmit={submit} noValidate>{isRegister && field('displayName', 'Full name', <input name="displayName" autoComplete="name" placeholder="Alex Morgan" value={values.displayName} onChange={(event) => change('displayName', event.target.value)} onBlur={() => blur('displayName')} required minLength={2} maxLength={80} aria-invalid={!!errors.displayName}/>)}{field('email', 'Email address', <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={(event) => change('email', event.target.value)} onBlur={() => blur('email')} required aria-invalid={!!errors.email}/>)}{field('password', 'Password', <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} value={values.password} onChange={(event) => change('password', event.target.value)} onBlur={() => blur('password')} required minLength={isRegister ? 10 : 1} maxLength={128} aria-invalid={!!errors.password}/>)}{formError && <p className="auth-form-error" role="alert">{formError}</p>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16}/></button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to CodeIT?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></div></main>;
}

function Dashboard({ user, accessToken, setNotice }: { user: User | null; accessToken: string | null; setNotice: (message: string) => void }) {
  const [completedCount, setCompletedCount] = useState(0);
  const [completedChallengeCount, setCompletedChallengeCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  useEffect(() => {
    if (!accessToken) return;
    const loadProgress = () => { void apiFetch('/me/progress').then(async response => { if (response.ok) { const progress = await response.json() as { total: number; completedChallengeCount: number; totalPoints: number }; setCompletedCount(progress.total); setCompletedChallengeCount(progress.completedChallengeCount); setTotalPoints(progress.totalPoints); } }); };
    loadProgress(); window.addEventListener('codeit-progress-updated', loadProgress);
    return () => window.removeEventListener('codeit-progress-updated', loadProgress);
  }, [accessToken]);
  return <main id="overview" className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="eyebrow-dot"/> JAVA FOUNDATIONS</p><h1>{user ? `Good to see you, ${user.displayName.split(' ')[0]}.` : 'Make your next idea compile.'}</h1><p className="welcome-subtitle">Small steps. Real skills. One line of code at a time.</p></div><div className="streak-pill"><span className="streak-icon"><Flame size={17} fill="currentColor"/></span><span><strong>0 day streak</strong><small>Start a learning streak</small></span></div></div>
    <section id="continue" className="continue-card"><div className="continue-copy"><div className="lesson-meta"><span className="lesson-tag"><span className="live-dot"/> YOUR NEXT LESSON</span><span className="lesson-time">8 MIN</span></div><h2>Meet the Java<br/>environment</h2><p>Get your tools ready and write your first line of Java.</p><div className="lesson-progress"><span>YOUR PROGRESS</span><div><i/></div><b>{completedCount ? 'IN PROGRESS' : '0%'}</b></div><button className="button button-light" onClick={() => accessToken ? document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' }) : setNotice('Sign in to see your learning content.')}>Continue learning <ArrowRight size={16}/></button></div><div className="code-art" aria-hidden="true"><div className="code-window"><div className="window-top"><span/><span/><span/><small>Welcome.java</small></div><div className="code-lines"><div><i>1</i><code><em>public class</em> <b>Welcome</b> {'{'}</code></div><div><i>2</i><code>  <em>public static void</em> main(String[] args) {'{'}</code></div><div><i>3</i><code>    System.out.println(<strong>"Hello, world!"</strong>);</code></div><div><i>4</i><code>  {'}'}</code></div><div><i>5</i><code>{'}'}</code></div></div><div className="terminal-line"><span>›</span> javac Welcome.java <Check size={13}/></div></div><div className="code-orbit orbit-one"/><div className="code-orbit orbit-two"/><span className="art-brace brace-left">{'{'}</span><span className="art-brace brace-right">{"}"}</span></div></section>
    {accessToken && <LearningCatalog token={accessToken}/>}
    <section id="practice" className="stats-grid"><Stat icon={<Trophy/>} label="POINTS EARNED" value={String(totalPoints)} detail="5 points per completion" color="gold"/><Stat icon={<BookOpen/>} label="LESSONS DONE" value={String(completedCount)} detail="Every concept counts" color="blue"/><Stat icon={<Code2/>} label="CHALLENGES DONE" value={`${completedChallengeCount}/5`} detail="Problems solved" color="green"/><Stat icon={<Flame/>} label="DAY STREAK" value="0" detail="Come back tomorrow" color="orange"/></section>
    <section className="lower-grid"><div className="panel" id="classroom"><div className="panel-heading"><div><p className="eyebrow">KEEP THE MOMENTUM</p><h2>Your learning path</h2></div><button className="text-button" onClick={() => document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' })}>View all <ArrowRight size={15}/></button></div><div className="path-item"><span className="path-icon icon-java"><Braces size={19}/></span><div className="path-info"><strong>Java Foundations</strong><span>Start with the essentials</span><div className="mini-progress"><i/></div></div><span className="path-percent">0%</span><Link className="circle-action" to="/lessons/7d412583-d134-4c38-8c32-47116befd46e" aria-label="Start Java Foundations"><Play size={14} fill="currentColor"/></Link></div><div className="path-item path-locked"><span className="path-icon icon-oop"><Hexagon size={19}/></span><div className="path-info"><strong>Object-Oriented Java</strong><span>Classes, objects & more</span></div><span className="locked-label"><LockKeyhole size={12}/> UP NEXT</span></div><div className="path-item path-locked"><span className="path-icon icon-advanced"><ChartNoAxesColumnIncreasing size={19}/></span><div className="path-info"><strong>Working with Data</strong><span>Collections & algorithms</span></div><span className="locked-label"><LockKeyhole size={12}/> LOCKED</span></div></div>
      <div className="side-stack"><div className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK PRACTICE</p><h2>Try a challenge</h2></div><span className="practice-icon"><Code2 size={18}/></span></div><div className="challenge-card"><div className="challenge-top"><span className="difficulty"><i/> BEGINNER</span><span>5 CHALLENGES</span></div><h3>Hello, Java!</h3><p>Practice Java with a code editor and starter challenges.</p><Link className="challenge-button" to="/challenges">Explore challenges <ArrowRight size={15}/></Link></div></div><div className="panel classroom-prompt"><span className="classroom-symbol"><GraduationCap size={18}/></span><div><strong>Learning with a class?</strong><p>Your teacher can share a classroom code with you.</p></div><button aria-label="Join classroom" onClick={() => setNotice('Classroom enrollment will be available in a later delivery phase.')}><Plus size={17}/></button></div></div></section>
    <section className="bottom-note"><div className="note-icon"><ShieldCheck size={17}/></div><span><strong>Your progress belongs to you.</strong> It saves as you learn, and your answers stay private.</span><span className="note-decoration"><Users size={16}/></span></section>
  </main>;
}

type PublishedLesson = { id: string; title: string; sequence: number; currentVersion: { id: string; versionNumber: number } | null };
type PublishedModule = { id: string; title: string; sequence: number; lessons: PublishedLesson[] };
type LessonDetail = { id: string; title: string; module: { title: string }; version: { id: string; versionNumber: number; content: string } };

function LearningCatalog({ token }: { token: string }) {
  const [modules, setModules] = useState<PublishedModule[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (!token) return; void apiFetch('/lessons').then(async response => { if (response.ok) setModules(await response.json() as PublishedModule[]); }).finally(() => setLoaded(true)); }, [token]);
  if (!loaded || !modules.length) return null;
  return <section id="curriculum" className="catalog-card"><div className="panel-heading"><div><p className="eyebrow">YOUR CURRICULUM</p><h2>Pick up a new concept</h2></div><BookOpen size={20} color="#6985e1"/></div>{modules.map(module => <div className="catalog-module" key={module.id}><h3>{module.title}</h3>{module.lessons.map(lesson => <Link className="catalog-lesson" to={`/lessons/${lesson.id}`} key={lesson.id}><span><BookOpen size={16}/></span><strong>{lesson.title}</strong><small>Lesson {lesson.sequence}</small><ArrowRight size={16}/></Link>)}</div>)}</section>;
}

function LessonPage({ token, setNotice }: { token: string | null; setNotice: (message: string) => void }) {
  const { id } = useParams(); const [lesson, setLesson] = useState<LessonDetail | null>(null); const [busy, setBusy] = useState(false); const [complete, setComplete] = useState(false);
  useEffect(() => { if (!token) return; void apiFetch(`/lessons/${id}`).then(async response => { if (!response.ok) throw new Error('This lesson is not available.'); setLesson(await response.json() as LessonDetail); }).catch(error => setNotice(error instanceof Error ? error.message : 'Unable to load this lesson.')); void apiFetch('/me/progress').then(async response => { if (response.ok) { const progress = await response.json() as { completedLessons: { lessonId: string }[] }; setComplete(progress.completedLessons.some((item) => item.lessonId === id)); } }); }, [id, token, setNotice]);
  async function markComplete() { if (!token || !lesson) return; setBusy(true); try { const response = await apiFetch(`/lessons/${lesson.id}/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonVersionId: lesson.version.id }) }); if (!response.ok) throw new Error('Unable to save lesson progress.'); const result = await response.json() as { pointsAwarded: number }; setComplete(true); setNotice(result.pointsAwarded ? 'Lesson completed! You earned 5 points.' : 'Lesson completed. Points for this lesson were already awarded.'); window.dispatchEvent(new Event('codeit-progress-updated')); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save lesson progress.'); } finally { setBusy(false); } }
  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to continue</h1><Link to="/login" className="button button-primary">Sign in <ArrowRight size={16}/></Link></div></main>;
  if (!lesson) return <main className="page-content"><p className="welcome-subtitle">Loading lesson…</p></main>;
  return <main className="lesson-page"><Link to="/" className="back-link">← Back to learning</Link><p className="eyebrow">{lesson.module.title.toUpperCase()} <span className="eyebrow-dot"/> LESSON {lesson.version.versionNumber}</p><h1>{lesson.title}</h1><article className="lesson-body">{lesson.version.content}</article><button className="button button-primary" onClick={markComplete} disabled={busy || complete}>{complete ? <><Check size={16}/> Lesson completed</> : busy ? 'Saving…' : 'Mark lesson complete'} {!complete && <ArrowRight size={16}/>}</button></main>;
}

type Challenge = { id: string; title: string; statement: string; difficulty: string; starterCode: string; sampleInput: string; sampleOutput: string; sequence: number; completed: boolean | number };
function ChallengePage({ token, setNotice }: { token: string | null; setNotice: (message: string) => void }) {
  const [items, setItems] = useState<Challenge[]>([]); const [selected, setSelected] = useState<Challenge | null>(null);
  const [code, setCode] = useState(''); const [sending, setSending] = useState(false); const [message, setMessage] = useState(''); const [output, setOutput] = useState('');
  useEffect(() => { if (!token) return; void apiFetch('/challenges').then(async (response) => { if (!response.ok) throw new Error('Unable to load challenges.'); const data = await response.json() as Challenge[]; setItems(data); setSelected(data[0] ?? null); setCode(data[0]?.starterCode ?? ''); }).catch((error) => setNotice(error instanceof Error ? error.message : 'Unable to load challenges.')); }, [token, setNotice]);
  function choose(item: Challenge) { setSelected(item); setCode(item.starterCode); setMessage(''); setOutput(''); }
  async function submit() { if (!selected || !token) return; setSending(true); setMessage(''); setOutput(''); try { const response = await apiFetch(`/challenges/${selected.id}/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, input: selected.sampleInput }) }); const body = await response.json() as { status: string; message?: string; output?: string; completed?: boolean }; setMessage(body.message ?? 'Unable to run this submission.'); if (body.output !== undefined) setOutput(body.output); if (body.completed) { setItems((current) => current.map((item) => item.id === selected.id ? { ...item, completed: true } : item)); setSelected((current) => current?.id === selected.id ? { ...current, completed: true } : current); window.dispatchEvent(new Event('codeit-progress-updated')); } } catch { setMessage('Could not reach the API. Check that the server is running.'); } finally { setSending(false); } }
  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to practice</h1><Link to="/login" className="button button-primary">Sign in <ArrowRight size={16}/></Link></div></main>;
  return <main className="challenge-page"><Link to="/" className="back-link">← Back to learning</Link><p className="eyebrow">JAVA PRACTICE</p><h1>Code challenges</h1><p className="welcome-subtitle">Choose a task, edit the Java starter, and review the sample input and output.</p><div className="challenge-layout"><aside className="challenge-list">{items.map((item) => <button key={item.id} className={`challenge-choice ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => choose(item)}><span>{item.sequence}. {item.title}</span><small>{item.difficulty}{item.completed ? ' · Completed ✓' : ''}</small></button>)}{!items.length && <p>Loading challenges…</p>}</aside>{selected && <section className="challenge-workspace"><div className="panel challenge-instructions"><p className="eyebrow">READ ONLY · CHALLENGE {selected.sequence} · {selected.difficulty.toUpperCase()}</p><h2>{selected.title}</h2><p>{selected.statement}</p><div className="sample-io"><div><strong>Example input</strong><pre>{selected.sampleInput || '(no input)'}</pre></div><div><strong>Expected output</strong><pre>{selected.sampleOutput}</pre></div></div></div><div className="ide-panel"><div className="ide-bar"><span>● ● ●</span><strong>Your Java code · Main.java</strong><span>Java subset</span></div><textarea aria-label="Java source code" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} /><div className="ide-actions"><span>Run uses the example input shown above.</span><button className="button button-primary" onClick={submit} disabled={sending}>{sending ? 'Running…' : <><Play size={14}/> Run code</>}</button></div>{message && <p className="runner-message" role="status">{message}</p>}{output !== '' && <div className="run-output"><strong>Program output</strong><pre>{output}</pre></div>}</div></section>}</div></main>;
}
function Stat({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: string }) { return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>; }

export default App;
