import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch, refreshSession, setAccessToken as setClientToken } from './api';
import { ArrowRight, BookOpen, Braces, ChartNoAxesColumnIncreasing, Check, ChevronDown, CircleHelp, Code2, Flame, GraduationCap, Hexagon, LockKeyhole, LogOut, Menu, Play, Plus, Search, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';

type User = { id: string; displayName: string; email: string; role: string };
const api = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { void refreshSession().then(session => { if (session) { setUser({ id: session.user.id, displayName: session.user.displayName, email: session.user.email, role: session.user.role }); setAccessToken(session.accessToken); } }).finally(() => setSessionReady(true)); }, []);
  const saveUser = (next: User, token: string) => { setUser(next); setAccessToken(token); setClientToken(token); };
  const logout = async () => { try { await fetch(`${api}/auth/logout`, { method: 'POST', credentials: 'include' }); } finally { setUser(null); setAccessToken(null); setClientToken(null); } };
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark"><Braces size={20}/></span><span>code<span className="brand-accent">it</span></span></Link>
      <nav className="main-nav">{user?.role === 'Administrator' ? <Link className="nav-active" to="/admin">Admin dashboard</Link> : <><Link className="nav-active" to="/">Overview</Link><a href="/#continue">My learning</a><a href="/#practice">Practice</a><Link to="/classrooms">Classroom</Link></>}</nav>
      <div className="top-actions">{user ? <><button className="profile-button" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><ChevronDown size={15}/></button>{menuOpen && <div className="profile-menu"><div className="profile-menu-name">{user.displayName}</div><div className="profile-menu-email">{user.email}</div><Link to="/profile" onClick={() => setMenuOpen(false)}>View and edit profile</Link><button onClick={logout}><LogOut size={15}/> Sign out</button></div>}</> : <Link className="button button-primary" to="/login">Sign in <ArrowRight size={16}/></Link>}</div>
      <button className="mobile-menu icon-button" aria-label="Open menu"><Menu/></button>
    </header>
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" onAuthenticated={saveUser} setNotice={setNotice}/>} />
      <Route path="/register" element={<AuthPage mode="register" onAuthenticated={saveUser} setNotice={setNotice}/>} />
      <Route path="/lessons/:id" element={<LessonPage token={accessToken} setNotice={setNotice}/>} />
      <Route path="/challenges" element={<ChallengePage token={accessToken} setNotice={setNotice}/>} />
      <Route path="/classrooms" element={<ClassroomPage user={user} token={accessToken} setNotice={setNotice}/>} />
      <Route path="/profile" element={<ProfilePage user={user} token={accessToken} onUpdated={setUser} setNotice={setNotice}/>} />
      <Route path="/profiles/:id" element={<ProfilePage user={user} token={accessToken} onUpdated={setUser} setNotice={setNotice}/>} />
      <Route path="/admin" element={<AdminPage ready={sessionReady} user={user} token={accessToken} setNotice={setNotice}/>} />
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
      onAuthenticated({ id: result.user.id, displayName: result.user.displayName, email: result.user.email, role: result.user.role }, result.accessToken); navigate(result.user.role === 'Administrator' ? '/admin' : '/');
    } catch { setFormError('Could not reach CodeIT. Start the API with npm run dev, then try again.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-wrap"><div className="auth-card"><div className="auth-icon"><LockKeyhole size={22}/></div><p className="eyebrow">YOUR LEARNING SPACE</p><h1>{isRegister ? 'Start building' : 'Welcome back'}</h1><p className="auth-subtitle">{isRegister ? 'Create your account and begin your Java journey.' : 'Sign in and pick up where you left off.'}</p><form className="auth-form" onSubmit={submit} noValidate>{isRegister && field('displayName', 'Full name', <input name="displayName" autoComplete="name" placeholder="Alex Morgan" value={values.displayName} onChange={(event) => change('displayName', event.target.value)} onBlur={() => blur('displayName')} required minLength={2} maxLength={80} aria-invalid={!!errors.displayName}/>)}{field('email', 'Email address', <input name="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={(event) => change('email', event.target.value)} onBlur={() => blur('email')} required aria-invalid={!!errors.email}/>)}{field('password', 'Password', <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} value={values.password} onChange={(event) => change('password', event.target.value)} onBlur={() => blur('password')} required minLength={isRegister ? 10 : 1} maxLength={128} aria-invalid={!!errors.password}/>)}{formError && <p className="auth-form-error" role="alert">{formError}</p>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16}/></button></form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to CodeIT?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></div></main>;
}

type ProfileData = { id: string; displayName: string; bio: string; role: string; email?: string };

function ProfilePage({ user, token, onUpdated, setNotice }: { user: User | null; token: string | null; onUpdated: (user: User) => void; setNotice: (message: string) => void }) {
  const { id } = useParams();
  const ownProfile = !id;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [level, setLevel] = useState<{ level: number; totalPoints: number; levelProgressPercent: number; expToNextLevel: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    void Promise.all([
      apiFetch(ownProfile ? '/me' : `/profiles/${encodeURIComponent(id!)}`),
      ownProfile && user?.role === 'Student' ? apiFetch('/me/progress') : Promise.resolve(null),
    ]).then(async ([response, progressResponse]) => {
      if (!response.ok) throw new Error(response.status === 404 ? 'This profile could not be found.' : 'Could not load this profile.');
      const result = await response.json() as ProfileData;
      if (!active) return;
      setProfile(result); setDisplayName(result.displayName); setBio(result.bio ?? '');
      if (progressResponse?.ok) setLevel(await progressResponse.json() as typeof level);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load profile.'); });
    return () => { active = false; };
  }, [token, id, ownProfile, user?.role]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await apiFetch('/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, bio }) });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Could not save your profile.');
      const updated = result as ProfileData;
      setProfile((current) => current ? { ...current, ...updated } : updated);
      if (user) onUpdated({ ...user, displayName: updated.displayName });
      setNotice('Profile saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your profile.'); }
    finally { setBusy(false); }
  }

  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to view profiles</h1><Link className="button button-primary" to="/login">Sign in <ArrowRight size={16}/></Link></div></main>;
  if (error && !profile) return <main className="profile-page"><p className="profile-error" role="alert">{error}</p><Link to="/classrooms" className="text-button">Back to classrooms</Link></main>;
  if (!profile) return <main className="profile-page"><p>Loading profile…</p></main>;
  const editable = ownProfile && ['Student', 'Teacher'].includes(profile.role);
  return <main className="profile-page"><section className="panel profile-card"><div className="profile-heading"><span className="profile-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</span><div><p className="eyebrow">{profile.role.toUpperCase()} PROFILE</p><h1>{profile.displayName}</h1><span className="profile-role">{profile.role}</span></div></div>
    {editable ? <form className="profile-form" onSubmit={save}><label>Display name<input required minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>About me <textarea maxLength={500} rows={5} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Share a little about your learning journey."/><small>{bio.length}/500 characters</small></label>{error && <p className="profile-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy || displayName.trim().length < 2}>{busy ? 'Saving…' : 'Save profile'}</button></form> : <p className="profile-bio">{profile.bio || 'This learner has not added a bio yet.'}</p>}
    {profile.role === 'Student' && level && <div className="profile-level"><div><p className="eyebrow">LEARNING LEVEL</p><strong>Level {level.level}</strong><span>{level.totalPoints} total EXP · {level.expToNextLevel} EXP to next level</span></div><div className="level-progress-track"><i style={{ width: `${level.levelProgressPercent}%` }}/></div></div>}
    {ownProfile && user && <p className="profile-private-note">Your email address is private and is not shown on your public profile.</p>}
  </section></main>;
}

function Dashboard({ user, accessToken, setNotice }: { user: User | null; accessToken: string | null; setNotice: (message: string) => void }) {
  const [completedCount, setCompletedCount] = useState(0);
  const [completedChallengeCount, setCompletedChallengeCount] = useState(0);
  const [availableLessonCount, setAvailableLessonCount] = useState(0);
  const [availableChallengeCount, setAvailableChallengeCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelProgress, setLevelProgress] = useState(0);
  useEffect(() => {
    if (!accessToken) return;
    const loadProgress = () => { void apiFetch('/me/progress').then(async response => { if (response.ok) { const progress = await response.json() as { total: number; completedChallengeCount: number; totalPoints: number; level: number; levelProgressPercent: number; availableLessonCount: number; availableChallengeCount: number }; setCompletedCount(progress.total); setCompletedChallengeCount(progress.completedChallengeCount); setAvailableLessonCount(progress.availableLessonCount); setAvailableChallengeCount(progress.availableChallengeCount); setTotalPoints(progress.totalPoints); setLevel(progress.level); setLevelProgress(progress.levelProgressPercent); } }); };
    loadProgress(); window.addEventListener('codeit-progress-updated', loadProgress);
    return () => window.removeEventListener('codeit-progress-updated', loadProgress);
  }, [accessToken]);
  const completedActivities = Math.min(completedCount, availableLessonCount) + Math.min(completedChallengeCount, availableChallengeCount);
  const availableActivities = availableLessonCount + availableChallengeCount;
  const overallProgress = availableActivities ? Math.round(completedActivities / availableActivities * 100) : 0;
  const lessonProgress = availableLessonCount ? Math.round(Math.min(completedCount, availableLessonCount) / availableLessonCount * 100) : 0;
  return <main id="overview" className="page-content">
    <div className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()} <span className="eyebrow-dot"/> JAVA FOUNDATIONS</p><h1>{user ? `Good to see you, ${user.displayName.split(' ')[0]}.` : 'Make your next idea compile.'}</h1><p className="welcome-subtitle">Small steps. Real skills. One line of code at a time.</p></div><div className="streak-pill"><span className="streak-icon"><Flame size={17} fill="currentColor"/></span><span><strong>0 day streak</strong><small>Start a learning streak</small></span></div></div>
    <section id="continue" className="continue-card"><div className="continue-copy"><div className="lesson-meta"><span className="lesson-tag"><span className="live-dot"/> YOUR NEXT LESSON</span><span className="lesson-time">8 MIN</span></div><h2>Meet the Java<br/>environment</h2><p>Get your tools ready and write your first line of Java.</p><div className="lesson-progress"><span>YOUR PROGRESS</span><div><i/></div><b>{completedCount ? 'IN PROGRESS' : '0%'}</b></div><button className="button button-light" onClick={() => accessToken ? document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' }) : setNotice('Sign in to see your learning content.')}>Continue learning <ArrowRight size={16}/></button></div><div className="code-art" aria-hidden="true"><div className="code-window"><div className="window-top"><span/><span/><span/><small>Welcome.java</small></div><div className="code-lines"><div><i>1</i><code><em>public class</em> <b>Welcome</b> {'{'}</code></div><div><i>2</i><code>  <em>public static void</em> main(String[] args) {'{'}</code></div><div><i>3</i><code>    System.out.println(<strong>"Hello, world!"</strong>);</code></div><div><i>4</i><code>  {'}'}</code></div><div><i>5</i><code>{'}'}</code></div></div><div className="terminal-line"><span>›</span> javac Welcome.java <Check size={13}/></div></div><div className="code-orbit orbit-one"/><div className="code-orbit orbit-two"/><span className="art-brace brace-left">{'{'}</span><span className="art-brace brace-right">{"}"}</span></div></section>
    {accessToken && <LearningCatalog token={accessToken}/>}
    {user?.role === 'Student' && <section className="student-level-card panel"><div><p className="eyebrow">YOUR JAVA JOURNEY</p><strong>Level {level}</strong><span>{levelProgress} / 100 EXP to next level</span></div><div className="level-progress-track"><i style={{ width: `${levelProgress}%` }}/></div><Link to="/profile" className="text-button">View profile <ArrowRight size={15}/></Link></section>}
    <section id="practice" className="stats-grid"><Stat icon={<Trophy/>} label="POINTS EARNED" value={String(totalPoints)} detail="5 points per completion" color="gold"/><Stat icon={<BookOpen/>} label="LESSONS DONE" value={String(completedCount)} detail="Every concept counts" color="blue"/><Stat icon={<Code2/>} label="CHALLENGES DONE" value={`${completedChallengeCount}/5`} detail="Problems solved" color="green"/><Stat icon={<Flame/>} label="DAY STREAK" value="0" detail="Come back tomorrow" color="orange"/></section>
    <section className="lower-grid"><div className="panel" id="classroom"><div className="panel-heading"><div><p className="eyebrow">KEEP THE MOMENTUM</p><h2>Your learning path</h2></div><button className="text-button" onClick={() => document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' })}>View all <ArrowRight size={15}/></button></div><div className="path-item"><span className="path-icon icon-java"><Braces size={19}/></span><div className="path-info"><strong>Java Foundations</strong><span>Start with the essentials</span><div className="mini-progress"><i/></div></div><span className="path-percent">0%</span><Link className="circle-action" to="/lessons/7d412583-d134-4c38-8c32-47116befd46e" aria-label="Start Java Foundations"><Play size={14} fill="currentColor"/></Link></div><div className="path-item path-locked"><span className="path-icon icon-oop"><Hexagon size={19}/></span><div className="path-info"><strong>Object-Oriented Java</strong><span>Classes, objects & more</span></div><span className="locked-label"><LockKeyhole size={12}/> UP NEXT</span></div><div className="path-item path-locked"><span className="path-icon icon-advanced"><ChartNoAxesColumnIncreasing size={19}/></span><div className="path-info"><strong>Working with Data</strong><span>Collections & algorithms</span></div><span className="locked-label"><LockKeyhole size={12}/> LOCKED</span></div></div>
      <div className="side-stack"><div className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK PRACTICE</p><h2>Try a challenge</h2></div><span className="practice-icon"><Code2 size={18}/></span></div><div className="challenge-card"><div className="challenge-top"><span className="difficulty"><i/> BEGINNER</span><span>5 CHALLENGES</span></div><h3>Hello, Java!</h3><p>Practice Java with a code editor and starter challenges.</p><Link className="challenge-button" to="/challenges">Explore challenges <ArrowRight size={15}/></Link></div></div><div className="panel classroom-prompt"><span className="classroom-symbol"><GraduationCap size={18}/></span><div><strong>Learning with a class?</strong><p>Join with a teacher’s code or manage your class.</p></div><Link aria-label="Open classrooms" to="/classrooms"><ArrowRight size={17}/></Link></div></div></section>
    <section className="bottom-note"><div className="note-icon"><ShieldCheck size={17}/></div><span><strong>Your progress belongs to you.</strong> It saves as you learn, and your answers stay private.</span><span className="note-decoration"><Users size={16}/></span></section>
  </main>;
}

type AdminSummary = { students: number; teachers: number; publishedLessons: number; publishedChallenges: number };
type AdminAccount = { id: string; displayName: string; email: string; roleName: string; status: string; createdAt: string };
type AdminLesson = { id: string; title: string; sequence: number; moduleTitle: string; moduleStatus: string; publishedVersion: number };
type AdminChallenge = { id: string; title: string; difficulty: string; sequence: number; status: string };
type AdminSubmission = { id: string; title: string; description: string; status: string; fileName: string; fileSize: number; rejectionReason: string | null; createdAt: string; moduleId: string; moduleTitle: string; teacherId: string; teacherName: string; teacherEmail: string };
type AdminPageResult<T> = { data: T[]; page: number; limit: number; total: number };
const ADMIN_PAGE_SIZE = 25;

async function getAdminData<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error('Could not load the administrator dashboard.');
  return response.json() as Promise<T>;
}

function adminListPath(path: string, page: number, search = '', role?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(ADMIN_PAGE_SIZE) });
  if (search.trim()) params.set('search', search.trim());
  if (role) params.set('role', role);
  return `${path}?${params.toString()}`;
}

function AdminPage({ ready, user, token, setNotice }: { ready: boolean; user: User | null; token: string | null; setNotice: (message: string) => void }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [accounts, setAccounts] = useState<AdminPageResult<AdminAccount> | null>(null);
  const [lessons, setLessons] = useState<AdminPageResult<AdminLesson> | null>(null);
  const [challenges, setChallenges] = useState<AdminPageResult<AdminChallenge> | null>(null);
  const [submissions, setSubmissions] = useState<AdminPageResult<AdminSubmission> | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false); const [error, setError] = useState('');
  const [accountPage, setAccountPage] = useState(1); const [accountRole, setAccountRole] = useState('all'); const [accountDraft, setAccountDraft] = useState(''); const [accountSearch, setAccountSearch] = useState(''); const [accountsBusy, setAccountsBusy] = useState(false);
  const [lessonPage, setLessonPage] = useState(1); const [lessonDraft, setLessonDraft] = useState(''); const [lessonSearch, setLessonSearch] = useState(''); const [lessonsBusy, setLessonsBusy] = useState(false);
  const [challengePage, setChallengePage] = useState(1); const [challengeDraft, setChallengeDraft] = useState(''); const [challengeSearch, setChallengeSearch] = useState(''); const [challengesBusy, setChallengesBusy] = useState(false);
  const [submissionPage, setSubmissionPage] = useState(1); const [submissionStatus, setSubmissionStatus] = useState('pending'); const [submissionDraft, setSubmissionDraft] = useState(''); const [submissionSearch, setSubmissionSearch] = useState(''); const [submissionsBusy, setSubmissionsBusy] = useState(false);
  const [reviewing, setReviewing] = useState<AdminSubmission | null>(null); const [previewUrl, setPreviewUrl] = useState(''); const [reviewBusy, setReviewBusy] = useState(false); const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (!token || user?.role !== 'Administrator') return;
    let active = true;
    void Promise.all([
      getAdminData<AdminSummary>('/admin/dashboard'),
      getAdminData<AdminPageResult<AdminAccount>>(adminListPath('/admin/users', 1, '', 'all')),
      getAdminData<AdminPageResult<AdminLesson>>(adminListPath('/admin/dashboard/lessons', 1)),
      getAdminData<AdminPageResult<AdminChallenge>>(adminListPath('/admin/dashboard/challenges', 1)),
      getAdminData<AdminPageResult<AdminSubmission>>('/admin/dashboard/submissions?page=1&limit=25&status=pending'),
    ]).then(([nextSummary, nextAccounts, nextLessons, nextChallenges, nextSubmissions]) => {
      if (!active) return;
      setSummary(nextSummary); setAccounts(nextAccounts); setLessons(nextLessons); setChallenges(nextChallenges); setSubmissions(nextSubmissions);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load dashboard data.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [token, user?.role]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function loadAccounts(page: number, role: string, search: string) {
    setAccountsBusy(true); setError('');
    try { const result = await getAdminData<AdminPageResult<AdminAccount>>(adminListPath('/admin/users', page, search, role)); setAccounts(result); setAccountPage(result.page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load accounts.'); }
    finally { setAccountsBusy(false); }
  }
  async function updateAccountRole(account: AdminAccount) {
    const roleName = roleDrafts[account.id] ?? account.roleName;
    if (account.roleName === 'Administrator' || roleName === account.roleName) return;
    setRoleBusy(account.id); setError('');
    try {
      const response = await apiFetch(`/admin/users/${account.id}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: roleName }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Could not update this account role.');
      setAccounts((current) => current ? { ...current, data: current.data.map((row) => row.id === account.id ? { ...row, roleName } : row) } : current);
      setRoleDrafts((current) => { const next = { ...current }; delete next[account.id]; return next; });
      try { setSummary(await getAdminData<AdminSummary>('/admin/dashboard')); } catch { /* The account role has already been saved; keep the current totals until the next dashboard refresh. */ }
      setNotice(`${account.displayName} is now a ${roleName}.`);
    } catch (reason) {
      setRoleDrafts((current) => ({ ...current, [account.id]: account.roleName }));
      setError(reason instanceof Error ? reason.message : 'Could not update this account role.');
    } finally { setRoleBusy(null); }
  }
  async function loadLessons(page: number, search: string) {
    setLessonsBusy(true); setError('');
    try { const result = await getAdminData<AdminPageResult<AdminLesson>>(adminListPath('/admin/dashboard/lessons', page, search)); setLessons(result); setLessonPage(result.page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load lessons.'); }
    finally { setLessonsBusy(false); }
  }
  async function loadChallenges(page: number, search: string) {
    setChallengesBusy(true); setError('');
    try { const result = await getAdminData<AdminPageResult<AdminChallenge>>(adminListPath('/admin/dashboard/challenges', page, search)); setChallenges(result); setChallengePage(result.page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load challenges.'); }
    finally { setChallengesBusy(false); }
  }
  async function loadSubmissions(page: number, status: string, search: string) {
    setSubmissionsBusy(true); setError('');
    try { const params = new URLSearchParams({ page: String(page), limit: String(ADMIN_PAGE_SIZE), status }); if (search.trim()) params.set('search', search.trim()); const result = await getAdminData<AdminPageResult<AdminSubmission>>(`/admin/dashboard/submissions?${params.toString()}`); setSubmissions(result); setSubmissionPage(result.page); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load lesson submissions.'); }
    finally { setSubmissionsBusy(false); }
  }
  async function openSubmission(submission: AdminSubmission) {
    setReviewing(submission); setRejectionReason(''); setPreviewUrl('');
    try { const response = await apiFetch(`/admin/dashboard/submissions/${submission.id}/file`); if (!response.ok) throw new Error('Could not open the uploaded PDF.'); setPreviewUrl(URL.createObjectURL(await response.blob())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open the uploaded PDF.'); }
  }
  async function decideSubmission(decision: 'approve' | 'reject') {
    if (!reviewing || (decision === 'reject' && rejectionReason.trim().length < 5)) return;
    setReviewBusy(true); setError('');
    try {
      const response = await apiFetch(`/admin/dashboard/submissions/${reviewing.id}/${decision}`, { method: 'POST', headers: decision === 'reject' ? { 'Content-Type': 'application/json' } : undefined, body: decision === 'reject' ? JSON.stringify({ reason: rejectionReason }) : undefined });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? `Could not ${decision} this submission.`);
      if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setReviewing(null); setRejectionReason('');
      await loadSubmissions(submissionPage, submissionStatus, submissionSearch);
      if (decision === 'approve') {
        const [nextSummary, nextLessons] = await Promise.all([
          getAdminData<AdminSummary>('/admin/dashboard'),
          getAdminData<AdminPageResult<AdminLesson>>(adminListPath('/admin/dashboard/lessons', lessonPage, lessonSearch)),
        ]);
        setSummary(nextSummary); setLessons(nextLessons);
      }
      setNotice(decision === 'approve' ? 'Lesson approved and published in the selected module.' : 'Lesson rejected. The teacher can see your feedback.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : `Could not ${decision} this submission.`); }
    finally { setReviewBusy(false); }
  }
  function accountSearchSubmit(event: FormEvent) { event.preventDefault(); setAccountSearch(accountDraft); void loadAccounts(1, accountRole, accountDraft); }
  function lessonSearchSubmit(event: FormEvent) { event.preventDefault(); setLessonSearch(lessonDraft); void loadLessons(1, lessonDraft); }
  function challengeSearchSubmit(event: FormEvent) { event.preventDefault(); setChallengeSearch(challengeDraft); void loadChallenges(1, challengeDraft); }
  function submissionSearchSubmit(event: FormEvent) { event.preventDefault(); setSubmissionSearch(submissionDraft); void loadSubmissions(1, submissionStatus, submissionDraft); }

  if (!ready) return <main className="admin-page"><div className="panel admin-message">Loading your account…</div></main>;
  if (!user) return <main className="admin-page"><div className="panel admin-message"><h1>Administrator sign-in required</h1><p>Sign in with an Administrator account to view this dashboard.</p><Link className="button button-primary" to="/login">Sign in <ArrowRight size={15}/></Link></div></main>;
  if (user.role !== 'Administrator') return <Navigate to="/" replace/>;
  if (!loaded) return <main className="admin-page"><div className="panel admin-message">Loading administrator dashboard…</div></main>;

  return <main className="admin-page">
    <div className="admin-heading"><div><p className="eyebrow">ADMINISTRATOR CONSOLE</p><h1>Dashboard</h1><p className="welcome-subtitle">Account totals and published learning content.</p></div><ShieldCheck size={28}/></div>
    {error && <div className="admin-error" role="alert">{error}<button onClick={() => setNotice(error)} aria-label="Show dashboard error">Details</button></div>}
    <section className="admin-stats" aria-label="Platform totals">
      <Stat icon={<Users/>} label="REGISTERED STUDENTS" value={(summary?.students ?? 0).toLocaleString()} detail="All account statuses" color="blue"/>
      <Stat icon={<GraduationCap/>} label="REGISTERED TEACHERS" value={(summary?.teachers ?? 0).toLocaleString()} detail="All account statuses" color="green"/>
      <Stat icon={<BookOpen/>} label="PUBLISHED LESSONS" value={(summary?.publishedLessons ?? 0).toLocaleString()} detail="With a published version" color="gold"/>
      <Stat icon={<Code2/>} label="PUBLISHED CHALLENGES" value={(summary?.publishedChallenges ?? 0).toLocaleString()} detail="Available to learners" color="orange"/>
    </section>

    <section className="panel admin-list-panel">
      <div className="admin-section-heading"><div><p className="eyebrow">TEACHER PROPOSALS</p><h2>Lesson submissions <small>{submissions?.total ?? 0}</small></h2></div>
        <form className="admin-filters" onSubmit={submissionSearchSubmit}><label className="admin-search"><Search size={15}/><input value={submissionDraft} onChange={(event) => setSubmissionDraft(event.target.value)} placeholder="Search title or teacher" aria-label="Search lesson submissions"/></label><select value={submissionStatus} aria-label="Filter lesson submissions" onChange={(event) => { const status = event.target.value; setSubmissionStatus(status); setReviewing(null); setPreviewUrl(''); void loadSubmissions(1, status, submissionSearch); }}><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All submissions</option></select><button className="button button-primary" type="submit">Search</button></form>
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Lesson</th><th>Teacher</th><th>Module</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead><tbody>{submissions?.data.map((submission) => <tr key={submission.id}><td>{submission.title}</td><td>{submission.teacherName}<small className="admin-cell-subtitle">{submission.teacherEmail}</small></td><td>{submission.moduleTitle}</td><td>{new Date(submission.createdAt).toLocaleDateString()}</td><td><span className={`admin-status status-${submission.status}`}>{submission.status}</span></td><td><button className="admin-table-action" onClick={() => void openSubmission(submission)}>{submission.status === 'pending' ? 'Review PDF' : 'View PDF'}</button></td></tr>)}</tbody></table>{!submissionsBusy && !submissions?.data.length && <p className="admin-empty">No lesson submissions in this view.</p>}{submissionsBusy && <p className="admin-empty">Loading lesson submissions…</p>}</div>
      <AdminPager page={submissionPage} limit={submissions?.limit ?? ADMIN_PAGE_SIZE} total={submissions?.total ?? 0} busy={submissionsBusy} onPage={(page) => void loadSubmissions(page, submissionStatus, submissionSearch)}/>
      {reviewing && <div className="submission-review"><div className="submission-review-copy"><div><p className="eyebrow">LESSON PROPOSAL · {reviewing.status.toUpperCase()}</p><h3>{reviewing.title}</h3><p>By {reviewing.teacherName} · {reviewing.moduleTitle}</p><p>{reviewing.description}</p><small>{reviewing.fileName} · {(reviewing.fileSize / 1024 / 1024).toFixed(2)} MiB</small></div><button className="text-button" onClick={() => { setReviewing(null); setPreviewUrl(''); }}>Close</button></div>{previewUrl ? <iframe className="submission-pdf-preview" src={previewUrl} title={`PDF preview for ${reviewing.title}`}/> : <p className="admin-empty">Loading PDF preview…</p>}{reviewing.status === 'pending' && <div className="submission-review-actions"><button className="button button-primary" disabled={reviewBusy} onClick={() => void decideSubmission('approve')}>{reviewBusy ? 'Saving…' : 'Approve and publish'}</button><label>Rejection reason<textarea required minLength={5} maxLength={2000} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain what the teacher should revise."/></label><button className="button button-secondary" disabled={reviewBusy || rejectionReason.trim().length < 5} onClick={() => void decideSubmission('reject')}>Reject submission</button></div>}{reviewing.status === 'rejected' && reviewing.rejectionReason && <p className="submission-rejection-note"><strong>Feedback sent to teacher:</strong> {reviewing.rejectionReason}</p>}</div>}
    </section>

    <section className="panel admin-list-panel">
      <div className="admin-section-heading"><div><p className="eyebrow">PEOPLE</p><h2>All accounts <small>{accounts?.total ?? 0}</small></h2></div>
        <form className="admin-filters" onSubmit={accountSearchSubmit}><label className="admin-search"><Search size={15}/><input value={accountDraft} onChange={(event) => setAccountDraft(event.target.value)} placeholder="Search name or email" aria-label="Search accounts"/></label><select value={accountRole} aria-label="Filter accounts by role" onChange={(event) => { const role = event.target.value; setAccountRole(role); void loadAccounts(1, role, accountSearch); }}><option value="all">All roles</option><option value="Student">Students</option><option value="Teacher">Teachers</option><option value="Administrator">Administrators</option></select><button className="button button-primary" type="submit">Search</button></form>
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Registered</th></tr></thead><tbody>{accounts?.data.map((account) => <tr key={account.id}><td>{account.displayName}</td><td>{account.email}</td><td>{account.roleName === 'Administrator' ? <span className={`admin-role role-${account.roleName.toLowerCase()}`}>Administrator</span> : <div className="account-role-control"><select aria-label={`Role for ${account.displayName}`} value={roleDrafts[account.id] ?? account.roleName} onChange={(event) => setRoleDrafts((current) => ({ ...current, [account.id]: event.target.value }))}><option value="Student">Student</option><option value="Teacher">Teacher</option></select><button className="admin-table-action" disabled={roleBusy !== null || (roleDrafts[account.id] ?? account.roleName) === account.roleName} onClick={() => void updateAccountRole(account)}>{roleBusy === account.id ? 'Saving…' : 'Save'}</button></div>}</td><td><span className={`admin-status status-${account.status}`}>{account.status}</span></td><td>{new Date(account.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!accountsBusy && !accounts?.data.length && <p className="admin-empty">No accounts match this search.</p>}{accountsBusy && <p className="admin-empty">Loading accounts…</p>}</div>
      <AdminPager page={accountPage} limit={accounts?.limit ?? ADMIN_PAGE_SIZE} total={accounts?.total ?? 0} busy={accountsBusy} onPage={(page) => void loadAccounts(page, accountRole, accountSearch)}/>
    </section>

    <div className="admin-content-grid">
      <section className="panel admin-list-panel">
        <div className="admin-section-heading"><div><p className="eyebrow">LEARNING CONTENT</p><h2>Published lessons <small>{lessons?.total ?? 0}</small></h2></div><form className="admin-filters admin-content-filter" onSubmit={lessonSearchSubmit}><label className="admin-search"><Search size={15}/><input value={lessonDraft} onChange={(event) => setLessonDraft(event.target.value)} placeholder="Search lessons" aria-label="Search published lessons"/></label><button className="button button-primary" type="submit">Search</button></form></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Lesson</th><th>Module</th><th>Version</th><th>Module status</th></tr></thead><tbody>{lessons?.data.map((lesson) => <tr key={lesson.id}><td>{lesson.title}</td><td>{lesson.moduleTitle}</td><td>v{lesson.publishedVersion}</td><td><span className={`admin-status status-${lesson.moduleStatus}`}>{lesson.moduleStatus}</span></td></tr>)}</tbody></table>{!lessonsBusy && !lessons?.data.length && <p className="admin-empty">No published lessons found.</p>}{lessonsBusy && <p className="admin-empty">Loading lessons…</p>}</div>
        <AdminPager page={lessonPage} limit={lessons?.limit ?? ADMIN_PAGE_SIZE} total={lessons?.total ?? 0} busy={lessonsBusy} onPage={(page) => void loadLessons(page, lessonSearch)}/>
      </section>
      <section className="panel admin-list-panel">
        <div className="admin-section-heading"><div><p className="eyebrow">PRACTICE</p><h2>Published challenges <small>{challenges?.total ?? 0}</small></h2></div><form className="admin-filters admin-content-filter" onSubmit={challengeSearchSubmit}><label className="admin-search"><Search size={15}/><input value={challengeDraft} onChange={(event) => setChallengeDraft(event.target.value)} placeholder="Search challenges" aria-label="Search published challenges"/></label><button className="button button-primary" type="submit">Search</button></form></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Challenge</th><th>Difficulty</th><th>Sequence</th></tr></thead><tbody>{challenges?.data.map((challenge) => <tr key={challenge.id}><td>{challenge.title}</td><td><span className="admin-difficulty">{challenge.difficulty}</span></td><td>{challenge.sequence}</td></tr>)}</tbody></table>{!challengesBusy && !challenges?.data.length && <p className="admin-empty">No published challenges found.</p>}{challengesBusy && <p className="admin-empty">Loading challenges…</p>}</div>
        <AdminPager page={challengePage} limit={challenges?.limit ?? ADMIN_PAGE_SIZE} total={challenges?.total ?? 0} busy={challengesBusy} onPage={(page) => void loadChallenges(page, challengeSearch)}/>
      </section>
    </div>
  </main>;
}

function AdminPager({ page, limit, total, busy, onPage }: { page: number; limit: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="admin-pager"><span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0 results'}</span><div><button disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Previous</button><strong>Page {page} of {pages}</strong><button disabled={busy || page >= pages} onClick={() => onPage(page + 1)}>Next</button></div></div>;
}

type PublishedLesson = { id: string; title: string; sequence: number; currentVersion: { id: string; versionNumber: number } | null };
type PublishedModule = { id: string; title: string; sequence: number; lessons: PublishedLesson[] };
type LessonDetail = { id: string; title: string; module: { title: string }; version: { id: string; versionNumber: number; content: string }; attachment: { fileName: string; url: string } | null };

function LearningCatalog({ token }: { token: string }) {
  const [modules, setModules] = useState<PublishedModule[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (!token) return; void apiFetch('/lessons').then(async response => { if (response.ok) setModules(await response.json() as PublishedModule[]); }).finally(() => setLoaded(true)); }, [token]);
  if (!loaded || !modules.length) return null;
  return <section id="curriculum" className="catalog-card"><div className="panel-heading"><div><p className="eyebrow">YOUR CURRICULUM</p><h2>Pick up a new concept</h2></div><BookOpen size={20} color="#6985e1"/></div>{modules.map(module => <div className="catalog-module" key={module.id}><h3>{module.title}</h3>{module.lessons.map(lesson => <Link className="catalog-lesson" to={`/lessons/${lesson.id}`} key={lesson.id}><span><BookOpen size={16}/></span><strong>{lesson.title}</strong><small>Lesson {lesson.sequence}</small><ArrowRight size={16}/></Link>)}</div>)}</section>;
}

type ClassroomActivity = { id: string; challengeId: string; title: string; difficulty: string; assignedAt?: string };
type ClassroomSummary = { id: string; name: string; joinCode: string; activeMemberCount: number; pendingRequestCount: number; activities: ClassroomActivity[] };
type ClassroomDetails = ClassroomSummary & {
  members: { id: string; displayName: string; email: string; joinedAt: string }[];
  pendingRequests: { id: string; displayName: string; email: string; requestedAt: string }[];
};
type StudentClassrooms = {
  memberships: { id: string; name: string; teacherId: string; teacherName: string; joinedAt: string; activities: ClassroomActivity[] }[];
  requests: { id: string; classroomName: string; status: string; requestedAt: string }[];
};

function ClassroomPage({ user, token, setNotice }: { user: User | null; token: string | null; setNotice: (message: string) => void }) {
  const [teacherClasses, setTeacherClasses] = useState<ClassroomSummary[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassroomDetails | null>(null);
  const [studentData, setStudentData] = useState<StudentClassrooms>({ memberships: [], requests: [] });
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState('');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadTeacher(preferredId?: string) {
    const response = await apiFetch('/classrooms/teacher');
    if (!response.ok) throw new Error('Unable to load your classrooms.');
    const classes = await response.json() as ClassroomSummary[];
    setTeacherClasses(classes);
    const targetId = preferredId ?? selectedClass?.id ?? classes[0]?.id;
    if (targetId && classes.some((item) => item.id === targetId)) {
      const detailResponse = await apiFetch(`/classrooms/${targetId}`);
      if (detailResponse.ok) setSelectedClass(await detailResponse.json() as ClassroomDetails);
    } else setSelectedClass(null);
    const challengeResponse = await apiFetch('/challenges');
    if (challengeResponse.ok) setChallenges(await challengeResponse.json() as Challenge[]);
  }

  async function loadStudent() {
    const response = await apiFetch('/classrooms/student');
    if (!response.ok) throw new Error('Unable to load your classroom information.');
    setStudentData(await response.json() as StudentClassrooms);
  }

  useEffect(() => {
    if (!token || !user) { setLoaded(true); return; }
    setLoaded(false);
    const load = user.role === 'Teacher' ? loadTeacher() : user.role === 'Student' ? loadStudent() : Promise.resolve();
    void load.catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Unable to load classrooms.')).finally(() => setLoaded(true));
  }, [token, user?.role]);

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await apiFetch('/classrooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: className }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not create classroom.');
      setClassName(''); await loadTeacher(result.id); setNotice(`Classroom created. Share join code ${result.joinCode} with your students.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create classroom.'); }
    finally { setBusy(false); }
  }

  async function submitJoinRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await apiFetch('/classrooms/join-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classCode: joinCode }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not request classroom access.');
      setJoinCode(''); await loadStudent(); setNotice(result.alreadyRequested ? 'Your request is already awaiting teacher approval.' : `Join request sent to ${result.classroomName}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not request classroom access.'); }
    finally { setBusy(false); }
  }

  async function decideRequest(requestId: string, decision: 'approve' | 'reject') {
    if (!selectedClass) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/classrooms/${selectedClass.id}/join-requests/${requestId}/${decision}`, { method: 'POST' });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not update this request.');
      await loadTeacher(selectedClass.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update this request.'); }
    finally { setBusy(false); }
  }

  async function assignChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedClass || !selectedChallenge) return; setBusy(true);
    try {
      const response = await apiFetch(`/classrooms/${selectedClass.id}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: selectedChallenge }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not assign this challenge.');
      setSelectedChallenge(''); await loadTeacher(selectedClass.id); setNotice('Challenge assigned to the classroom.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not assign this challenge.'); }
    finally { setBusy(false); }
  }

  async function leaveClassroom(classroomId: string) {
    setBusy(true);
    try {
      const response = await apiFetch(`/classrooms/${classroomId}/leave`, { method: 'POST' });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not leave this classroom.');
      await loadStudent();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not leave this classroom.'); }
    finally { setBusy(false); }
  }

  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to use classrooms</h1><p className="auth-subtitle">Teachers manage classes and students join with a code.</p><Link to="/login" className="button button-primary">Sign in <ArrowRight size={16}/></Link></div></main>;
  if (!loaded) return <main className="classroom-page"><p>Loading classrooms…</p></main>;
  if (user?.role === 'Teacher') return <main className="classroom-page"><p className="eyebrow">TEACHER SPACE</p><h1>Your classrooms</h1><p className="welcome-subtitle">Create a class, review join requests, and assign Java challenges.</p><TeacherLessonSubmissionPanel token={token} setNotice={setNotice}/><form className="classroom-create panel" onSubmit={createClass}><label>Classroom name<input required minLength={2} maxLength={120} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Java 101 · Section A"/></label><button className="button button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create classroom'} <Plus size={16}/></button></form><div className="classroom-columns"><aside className="classroom-list">{teacherClasses.map((classroom) => <button key={classroom.id} className={`classroom-select ${selectedClass?.id === classroom.id ? 'selected' : ''}`} onClick={() => void loadTeacher(classroom.id).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not load classroom.'))}><strong>{classroom.name}</strong><small>{classroom.activeMemberCount} members · {classroom.pendingRequestCount} pending</small><span>Join code: {classroom.joinCode}</span></button>)}{!teacherClasses.length && <div className="panel classroom-empty">Create your first classroom above.</div>}</aside>{selectedClass && <section className="classroom-detail panel"><div className="panel-heading"><div><p className="eyebrow">CLASSROOM</p><h2>{selectedClass.name}</h2></div><button className="text-button" onClick={() => { void navigator.clipboard?.writeText(selectedClass.joinCode); setNotice('Join code copied.'); }}>Copy join code</button></div><div className="join-code-card"><span>STUDENT JOIN CODE</span><strong>{selectedClass.joinCode}</strong></div><h3>Join requests <small>{selectedClass.pendingRequests.length}</small></h3>{selectedClass.pendingRequests.map((request) => <div className="classroom-person" key={request.id}><span><strong>{request.displayName}</strong><small>{request.email}</small></span><button className="button button-primary" disabled={busy} onClick={() => void decideRequest(request.id, 'approve')}>Approve</button><button className="button button-secondary" disabled={busy} onClick={() => void decideRequest(request.id, 'reject')}>Reject</button></div>)}{!selectedClass.pendingRequests.length && <p className="classroom-muted">No pending join requests.</p>}<h3>Current students <small>{selectedClass.members.length}</small></h3>{selectedClass.members.map((member) => <div className="classroom-person" key={member.id}><span><Link className="classroom-profile-link" to={`/profiles/${member.id}`}><strong>{member.displayName}</strong></Link><small>{member.email}</small></span></div>)}{!selectedClass.members.length && <p className="classroom-muted">Approved students appear here.</p>}<h3>Assigned challenges</h3><form className="classroom-assign" onSubmit={assignChallenge}><select required value={selectedChallenge} onChange={(event) => setSelectedChallenge(event.target.value)}><option value="">Choose a published challenge</option>{challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}</select><button className="button button-primary" disabled={busy || !selectedChallenge}>Assign</button></form>{selectedClass.activities.map((activity) => <div className="classroom-assignment" key={activity.id}><Code2 size={16}/><span><strong>{activity.title}</strong><small>{activity.difficulty}</small></span></div>)}{!selectedClass.activities.length && <p className="classroom-muted">No challenges assigned yet.</p>}</section>}</div></main>;
  if (user?.role === 'Student') return <main className="classroom-page"><p className="eyebrow">STUDENT SPACE</p><h1>Your classrooms</h1><p className="welcome-subtitle">Enter the join code your teacher shared. You’ll appear in the class after they approve your request.</p><form className="classroom-create panel" onSubmit={submitJoinRequest}><label>Classroom join code<input required minLength={8} maxLength={24} value={joinCode} onChange={(event) => setJoinCode(event.target.value.trim())} placeholder="Enter your teacher’s code"/></label><button className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Request to join'} <ArrowRight size={16}/></button></form><h2 className="classroom-section-title">Pending requests</h2>{studentData.requests.map((request) => <div className="classroom-status-row" key={request.id}><strong>{request.classroomName}</strong><span>Waiting for teacher approval</span></div>)}{!studentData.requests.length && <p className="classroom-muted">No pending requests.</p>}<h2 className="classroom-section-title">Joined classes</h2><div className="student-class-grid">{studentData.memberships.map((classroom) => <article className="panel student-class-card" key={classroom.id}><div className="panel-heading"><div><p className="eyebrow">CLASSROOM</p><h2>{classroom.name}</h2></div><Users size={18} color="#6985e1"/></div><p className="classroom-muted">Teacher: <Link className="classroom-profile-link" to={`/profiles/${classroom.teacherId}`}>{classroom.teacherName}</Link></p><h3>Assigned challenges</h3>{classroom.activities.map((activity) => <div className="classroom-assignment" key={activity.id}><Code2 size={16}/><span><strong>{activity.title}</strong><small>{activity.difficulty}</small></span><Link className="assignment-open" to={`/challenges?challenge=${activity.challengeId}`}>Open</Link></div>)}{!classroom.activities.length && <p className="classroom-muted">No challenges assigned yet.</p>}<div className="student-class-actions"><button className="text-button" disabled={busy} onClick={() => void leaveClassroom(classroom.id)}>Leave classroom</button></div></article>)}</div>{!studentData.memberships.length && <div className="panel classroom-empty">When a teacher approves your request, the class will appear here.</div>}</main>;
  return <main className="classroom-page"><p className="eyebrow">CLASSROOMS</p><h1>Classroom tools</h1><p className="welcome-subtitle">Classroom access is available to active Student and approved Teacher accounts.</p></main>;
}

type SubmissionModule = { id: string; title: string; sequence: number };
type TeacherSubmission = { id: string; title: string; description: string; status: string; fileName: string; fileSize: number; rejectionReason: string | null; createdAt: string; publishedLessonId: string | null; moduleTitle: string };

function TeacherLessonSubmissionPanel({ token, setNotice }: { token: string; setNotice: (message: string) => void }) {
  const [modules, setModules] = useState<SubmissionModule[]>([]); const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [moduleId, setModuleId] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    void Promise.all([apiFetch('/teacher/lesson-submissions/modules'), apiFetch('/teacher/lesson-submissions')]).then(async ([moduleResponse, submissionResponse]) => {
      if (!moduleResponse.ok || !submissionResponse.ok) throw new Error('Could not load lesson submission options.');
      const [moduleRows, submissionRows] = await Promise.all([moduleResponse.json() as Promise<SubmissionModule[]>, submissionResponse.json() as Promise<TeacherSubmission[]>]);
      setModules(moduleRows); setSubmissions(submissionRows); setModuleId(moduleRows[0]?.id ?? '');
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not load lesson submission options.')).finally(() => setLoaded(true));
  }, [token, setNotice]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    if (!file || !moduleId) { setNotice('Choose a published module and a PDF lesson file.'); return; }
    setBusy(true);
    try {
      const body = new FormData(); body.append('title', title); body.append('description', description); body.append('moduleId', moduleId); body.append('file', file);
      const response = await apiFetch('/teacher/lesson-submissions', { method: 'POST', body });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Could not submit this lesson.');
      const refresh = await apiFetch('/teacher/lesson-submissions');
      if (refresh.ok) setSubmissions(await refresh.json() as TeacherSubmission[]);
      setTitle(''); setDescription(''); setFile(null); form.reset();
      setNotice('Lesson submitted for administrator review.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not submit this lesson.'); }
    finally { setBusy(false); }
  }
  return <section className="panel teacher-submission-panel"><div className="admin-section-heading"><div><p className="eyebrow">SHARE YOUR MATERIAL</p><h2>Upload a lesson</h2><p className="classroom-muted">An administrator reviews and approves each PDF before it appears for students.</p></div><BookOpen size={21} color="#6985e1"/></div>
    <form className="teacher-submission-form" onSubmit={(event) => void submit(event)}><label>Lesson title<input required minLength={2} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Introduction to loops"/></label><label>Published module<select required value={moduleId} onChange={(event) => setModuleId(event.target.value)} disabled={!modules.length}><option value="">{modules.length ? 'Choose a module' : 'No published modules available'}</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><label className="teacher-description-field">Lesson description<textarea required minLength={10} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Summarize what students will learn from this material."/></label><label className="teacher-file-field">PDF lesson file<input required type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/><small>PDF only · up to 10 MiB</small></label><button className="button button-primary" disabled={busy || !loaded || !modules.length}>{busy ? 'Uploading…' : 'Submit for review'} <ArrowRight size={15}/></button></form>
    <div className="teacher-submission-history"><div className="panel-heading"><h3>Your submissions</h3><span>{submissions.length}</span></div>{!loaded && <p className="admin-empty">Loading submissions…</p>}{loaded && !submissions.length && <p className="admin-empty">You haven’t submitted a lesson yet.</p>}{submissions.map((submission) => <article className="teacher-submission-row" key={submission.id}><div><strong>{submission.title}</strong><small>{submission.moduleTitle} · {new Date(submission.createdAt).toLocaleDateString()}</small><small>{submission.fileName}</small>{submission.rejectionReason && <p className="submission-rejection-note"><strong>Admin feedback:</strong> {submission.rejectionReason}</p>}</div><span className={`admin-status status-${submission.status}`}>{submission.status}</span></article>)}</div>
  </section>;
}

function LessonPage({ token, setNotice }: { token: string | null; setNotice: (message: string) => void }) {
  const { id } = useParams(); const [lesson, setLesson] = useState<LessonDetail | null>(null); const [pdfUrl, setPdfUrl] = useState(''); const [busy, setBusy] = useState(false); const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (!token) return;
    let active = true; let objectUrl = '';
    void apiFetch(`/lessons/${id}`).then(async response => {
      if (!response.ok) throw new Error('This lesson is not available.');
      const data = await response.json() as LessonDetail;
      if (active) setLesson(data);
      if (data.attachment) {
        const fileResponse = await apiFetch(data.attachment.url);
        if (!fileResponse.ok) throw new Error('Could not load the lesson PDF.');
        objectUrl = URL.createObjectURL(await fileResponse.blob());
        if (active) setPdfUrl(objectUrl); else URL.revokeObjectURL(objectUrl);
      }
    }).catch(error => { if (active) setNotice(error instanceof Error ? error.message : 'Unable to load this lesson.'); });
    void apiFetch('/me/progress').then(async response => { if (response.ok) { const progress = await response.json() as { completedLessons: { lessonId: string }[] }; if (active) setComplete(progress.completedLessons.some((item) => item.lessonId === id)); } });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, token, setNotice]);
  async function markComplete() { if (!token || !lesson) return; setBusy(true); try { const response = await apiFetch(`/lessons/${lesson.id}/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonVersionId: lesson.version.id }) }); if (!response.ok) throw new Error('Unable to save lesson progress.'); const result = await response.json() as { pointsAwarded: number }; setComplete(true); setNotice(result.pointsAwarded ? 'Lesson completed! You earned 5 points.' : 'Lesson completed. Points for this lesson were already awarded.'); window.dispatchEvent(new Event('codeit-progress-updated')); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save lesson progress.'); } finally { setBusy(false); } }
  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to continue</h1><Link to="/login" className="button button-primary">Sign in <ArrowRight size={16}/></Link></div></main>;
  if (!lesson) return <main className="page-content"><p className="welcome-subtitle">Loading lesson…</p></main>;
  return <main className="lesson-page"><Link to="/" className="back-link">← Back to learning</Link><p className="eyebrow">{lesson.module.title.toUpperCase()} <span className="eyebrow-dot"/> LESSON {lesson.version.versionNumber}</p><h1>{lesson.title}</h1><article className="lesson-body">{lesson.version.content}</article>{lesson.attachment && <section className="lesson-pdf-section"><div className="panel-heading"><div><p className="eyebrow">LESSON MATERIAL</p><h2>{lesson.attachment.fileName}</h2></div><a className="button button-secondary" href={pdfUrl || undefined} target="_blank" rel="noreferrer">Open PDF</a></div>{pdfUrl ? <iframe className="lesson-pdf-preview" src={pdfUrl} title={`Lesson material: ${lesson.attachment.fileName}`}/> : <p className="admin-empty">Loading lesson PDF…</p>}</section>}<button className="button button-primary" onClick={markComplete} disabled={busy || complete}>{complete ? <><Check size={16}/> Lesson completed</> : busy ? 'Saving…' : 'Mark lesson complete'} {!complete && <ArrowRight size={16}/>}</button></main>;
}

type Challenge = { id: string; title: string; statement: string; difficulty: string; starterCode: string; sampleInput: string; sampleOutput: string; sequence: number; completed: boolean | number };
function ChallengePage({ token, setNotice }: { token: string | null; setNotice: (message: string) => void }) {
  const [searchParams] = useSearchParams(); const requestedChallenge = searchParams.get('challenge');
  const [items, setItems] = useState<Challenge[]>([]); const [selected, setSelected] = useState<Challenge | null>(null);
  const [code, setCode] = useState(''); const [input, setInput] = useState(''); const [sending, setSending] = useState(false); const [grading, setGrading] = useState(false); const [message, setMessage] = useState(''); const [output, setOutput] = useState('');
  const [inputMode, setInputMode] = useState<'buffered' | 'interactive'>('buffered'); const [sessionId, setSessionId] = useState(''); const [terminal, setTerminal] = useState(''); const [terminalInput, setTerminalInput] = useState(''); const [waitingForInput, setWaitingForInput] = useState(false); const [waitingMethod, setWaitingMethod] = useState('next'); const [interactiveRunning, setInteractiveRunning] = useState(false);
  useEffect(() => { if (!token) return; void apiFetch('/challenges').then(async (response) => { if (!response.ok) throw new Error('Unable to load challenges.'); const data = await response.json() as Challenge[]; const initial = data.find((item) => item.id === requestedChallenge) ?? data[0]; setItems(data); setSelected(initial ?? null); setCode(initial?.starterCode ?? ''); setInput(initial?.sampleInput ?? ''); }).catch((error) => setNotice(error instanceof Error ? error.message : 'Unable to load challenges.')); }, [token, requestedChallenge, setNotice]);
  useEffect(() => {
    if (!sessionId) return;
    let active = true; let cursor = 0;
    const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const poll = async () => {
      while (active) {
        try {
          const response = await apiFetch(`/challenges/interactive-sessions/${sessionId}/events?cursor=${cursor}`);
          if (!response.ok) throw new Error('Interactive session disconnected.');
          const data = await response.json() as { events: Array<{ id: number; type: string; text?: string; method?: string; message?: string }>; finished: boolean };
          for (const event of data.events) {
            cursor = event.id;
            if (event.type === 'output') setTerminal((current) => current + (event.text ?? ''));
            if (event.type === 'input') { setWaitingForInput(true); setWaitingMethod(event.method ?? 'next'); setTerminal((current) => current + `\n› input required (${event.method === 'nextInt' ? 'whole number' : event.method === 'nextLine' ? 'line of text' : 'text'})\n`); }
            if (event.type === 'error') setTerminal((current) => current + `\nError: ${event.message ?? 'Program stopped.'}\n`);
            if (event.type === 'done' || event.type === 'error') { setInteractiveRunning(false); setWaitingForInput(false); }
          }
          if (data.finished) { setInteractiveRunning(false); setWaitingForInput(false); setSessionId(''); return; }
        } catch (error) {
          setTerminal((current) => current + `\n${error instanceof Error ? error.message : 'Interactive session disconnected.'}\n`);
          setInteractiveRunning(false); setWaitingForInput(false); setSessionId(''); return;
        }
        await pause(350);
      }
    };
    void poll();
    return () => { active = false; void apiFetch(`/challenges/interactive-sessions/${sessionId}`, { method: 'DELETE' }); };
  }, [sessionId]);
  function choose(item: Challenge) { if (sessionId) void apiFetch(`/challenges/interactive-sessions/${sessionId}`, { method: 'DELETE' }); setSessionId(''); setInteractiveRunning(false); setWaitingForInput(false); setSelected(item); setCode(item.starterCode); setInput(item.sampleInput); setMessage(''); setOutput(''); setTerminal(''); }
  async function runCode() { if (!selected || !token) return; setSending(true); setMessage(''); setOutput(''); try { const response = await apiFetch(`/challenges/${selected.id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, input }) }); const body = await response.json() as { status?: string; message?: string; output?: string }; setMessage(body.message ?? (body.status === 'ran' ? 'Run finished. Hidden tests were not submitted.' : 'Unable to run this code.')); setOutput(body.output ?? ''); } catch { setMessage('Could not reach the API. Check that the server is running.'); } finally { setSending(false); } }
  async function submitForGrading() { if (!selected || !token) return; setGrading(true); setMessage(''); try { const response = await apiFetch(`/challenges/${selected.id}/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, input: selected.sampleInput }) }); const body = await response.json() as { status: string; message?: string; output?: string; completed?: boolean }; setMessage(body.message ?? 'Unable to grade this submission.'); if (body.output !== undefined) setOutput(body.output); if (body.completed) { setItems((current) => current.map((item) => item.id === selected.id ? { ...item, completed: true } : item)); setSelected((current) => current?.id === selected.id ? { ...current, completed: true } : current); window.dispatchEvent(new Event('codeit-progress-updated')); } } catch { setMessage('Could not reach the API. Check that the server is running.'); } finally { setGrading(false); } }
  async function startInteractive() { if (!selected || !token || interactiveRunning) return; setTerminal(''); setWaitingForInput(false); setMessage(''); setInteractiveRunning(true); try { const response = await apiFetch(`/challenges/${selected.id}/interactive-sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }); const body = await response.json() as { sessionId?: string; message?: string }; if (!response.ok || !body.sessionId) throw new Error(body.message ?? 'Could not start the interactive run.'); setSessionId(body.sessionId); } catch (error) { setInteractiveRunning(false); setMessage(error instanceof Error ? error.message : 'Could not start the interactive run.'); } }
  async function sendInteractiveInput(event: FormEvent) { event.preventDefault(); if (!sessionId || !waitingForInput || (waitingMethod !== 'nextLine' && !terminalInput.trim())) return; const value = waitingMethod === 'nextLine' ? terminalInput : terminalInput.trim(); try { const response = await apiFetch(`/challenges/interactive-sessions/${sessionId}/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: value }) }); const body = await response.json() as { message?: string }; if (!response.ok) throw new Error(body.message ?? 'Could not send input.'); setTerminal((current) => current + `› ${value}\n`); setTerminalInput(''); setWaitingForInput(false); } catch (error) { setTerminal((current) => current + `\n${error instanceof Error ? error.message : 'Could not send input.'}\n`); } }
  async function stopInteractive() { if (sessionId) await apiFetch(`/challenges/interactive-sessions/${sessionId}`, { method: 'DELETE' }); setSessionId(''); setInteractiveRunning(false); setWaitingForInput(false); setTerminal((current) => current + '\n[Run stopped]\n'); }
  if (!token) return <main className="auth-wrap"><div className="auth-card"><h1>Sign in to practice</h1><Link to="/login" className="button button-primary">Sign in <ArrowRight size={16}/></Link></div></main>;
  return <main className="challenge-page"><Link to="/" className="back-link">← Back to learning</Link><p className="eyebrow">JAVA PRACTICE</p><h1>Code challenges</h1><p className="welcome-subtitle">Choose a task, edit the Java starter, and interact with its program input.</p><div className="challenge-layout"><aside className="challenge-list">{items.map((item) => <button key={item.id} className={`challenge-choice ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => choose(item)}><span>{item.sequence}. {item.title}</span><small>{item.difficulty}{item.completed ? ' · Completed ✓' : ''}</small></button>)}{!items.length && <p>Loading challenges…</p>}</aside>{selected && <section className="challenge-workspace"><div className="panel challenge-instructions"><p className="eyebrow">READ ONLY · CHALLENGE {selected.sequence} · {selected.difficulty.toUpperCase()}</p><h2>{selected.title}</h2><p>{selected.statement}</p><div className="sample-io"><div><strong>Example input</strong><pre>{selected.sampleInput || '(no input)'}</pre></div><div><strong>Expected output</strong><pre>{selected.sampleOutput}</pre></div></div></div><div className="ide-panel"><div className="ide-bar"><span>● ● ●</span><strong>Your Java code · Main.java</strong><span>Java subset</span></div><textarea aria-label="Java source code" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} /><div className="io-mode-tabs" role="tablist" aria-label="Program input mode"><button type="button" className={inputMode === 'buffered' ? 'active' : ''} onClick={() => setInputMode('buffered')}>Enter input before running</button><button type="button" className={inputMode === 'interactive' ? 'active' : ''} onClick={() => setInputMode('interactive')}>Interactive terminal</button></div>{inputMode === 'buffered' ? <div className="stdin-panel"><label htmlFor="program-input">Program input <small>One value per line. The example input is prefilled.</small></label><textarea id="program-input" aria-label="Program input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter the values Scanner should read" /><button className="button button-primary" onClick={() => void runCode()} disabled={sending || grading || interactiveRunning}>{sending ? 'Running…' : <><Play size={14}/> Run with input</>}</button></div> : <div className="terminal-panel"><div className="terminal-output" aria-live="polite">{terminal || 'Start the program. When Scanner requests input, a prompt will appear here.'}</div>{waitingForInput && <form className="terminal-input-row" onSubmit={(event) => void sendInteractiveInput(event)}><label htmlFor="terminal-input">Your input</label><input autoFocus id="terminal-input" value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder={waitingMethod === 'nextLine' ? 'Type a line of text' : 'Type one value'} /><button className="button button-primary" disabled={waitingMethod !== 'nextLine' && !terminalInput.trim()}>Send</button></form>}<div className="terminal-actions"><span>{interactiveRunning ? waitingForInput ? 'Program is waiting for input.' : 'Program is running…' : 'Input is sent to Scanner when requested.'}</span>{interactiveRunning ? <button className="button button-secondary" onClick={() => void stopInteractive()}>Stop</button> : <button className="button button-primary" onClick={() => void startInteractive()} disabled={grading}><Play size={14}/> Start interactive run</button>}</div></div>}<div className="ide-actions"><span>Submit runs hidden tests. Only a passing submission earns points.</span><button className="button button-primary" onClick={() => void submitForGrading()} disabled={grading || sending || interactiveRunning}>{grading ? 'Checking…' : 'Submit for grading'}</button></div>{message && <p className="runner-message" role="status">{message}</p>}{output !== '' && <div className="run-output"><strong>Program output</strong><pre>{output}</pre></div>}</div></section>}</div></main>;
}
function Stat({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: string }) { return <div className="stat-card"><div className={`stat-icon ${color}`}>{icon}</div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>; }

export default App;
