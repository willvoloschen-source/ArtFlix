import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Check, CircleAlert, KeyRound, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { App } from '../App';
import type { ProductBranch } from '../types/mapTypes';
import { ArtflixProfile, supabase } from '../services/supabaseClient';
import { prepareProjectForSave, restoreProjectFromStorage } from '../services/projectStorage';

function AccessCard({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f5f3ef] px-5 py-12 flex items-center justify-center text-slate-900">
    <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_24px_80px_-40px_rgba(35,44,52,.4)]">
      <div className="mb-7 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b64c1e] text-sm font-black tracking-tight text-white">MAP</div>
        <div><div className="text-lg font-bold tracking-tight">ArtFlix Studio</div><div className="text-xs text-slate-500">Método MAP · área de trabalho segura</div></div>
      </div>
      {children}
    </div>
  </div>;
}

export function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ArtflixProfile | null>(null);
  const [initialProjects, setInitialProjects] = useState<ProductBranch[] | null>(null);
  const [view, setView] = useState<'studio' | 'admin'>('studio');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [directory, setDirectory] = useState<ArtflixProfile[]>([]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let live = true;
    const load = async (nextUser: User | null) => {
      if (!live) return;
      setLoading(true);
      setUser(nextUser);
      setProfile(null);
      setInitialProjects(null);
      if (nextUser) {
        const { data, error } = await supabase!.from('artflix_profiles').select('id,email,role,active,created_at').eq('id', nextUser.id).single();
        if (!live) return;
        if (error) setMessage(`Não foi possível carregar seu cadastro: ${error.message}`);
        else {
          const nextProfile = data as ArtflixProfile;
          setProfile(nextProfile);
          if (nextProfile.active) {
            const projects = await supabase!.from('artflix_projects').select('document').eq('owner_id', nextUser.id).order('updated_at', { ascending: false });
            if (!live) return;
            if (projects.error) setMessage(`Não foi possível carregar seus projetos: ${projects.error.message}`);
            else {
              try {
                setInitialProjects(await Promise.all((projects.data || []).map(row => restoreProjectFromStorage(row.document as ProductBranch))));
              } catch (storageError) {
                setMessage(storageError instanceof Error ? storageError.message : 'Falha ao carregar arquivos do projeto.');
              }
            }
          }
        }
      }
      if (live) setLoading(false);
    };
    void supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void load(session?.user || null);
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    const timer = window.setInterval(async () => {
      const { data } = await client.from('artflix_profiles').select('id,email,role,active,created_at').eq('id', user.id).single();
      if (data) setProfile(data as ArtflixProfile);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const saveProjects = useCallback((projects: ProductBranch[]) => {
    const client = supabase;
    const owner = user;
    if (!client || !owner) return Promise.resolve();
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      const prepared = await Promise.all(projects.map(project => prepareProjectForSave(project, owner.id)));
      const { error } = await client.from('artflix_projects').upsert(prepared.map(project => ({
        id: project.id,
        owner_id: owner.id,
        name: project.name,
        document: project,
        updated_at: new Date().toISOString()
      })), { onConflict: 'id' });
      if (error) throw error;
    });
    saveQueue.current = task;
    return task;
  }, [user?.id]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage('');
    const result = registering
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    setMessage(result.error?.message || (registering ? 'Cadastro recebido. Confirme seu e-mail e aguarde a aprovação do administrador.' : ''));
  };

  const loadDirectory = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('artflix_profiles').select('id,email,role,active,created_at').order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setDirectory((data || []) as ArtflixProfile[]);
  };

  const toggleAccess = async (entry: ArtflixProfile) => {
    if (!supabase || entry.role === 'master') return;
    const { error } = await supabase.from('artflix_profiles').update({ active: !entry.active }).eq('id', entry.id);
    if (error) setMessage(error.message);
    else await loadDirectory();
  };

  if (!supabase) return <AccessCard><CircleAlert className="mb-3 text-amber-600" /><h1 className="text-xl font-bold">Configuração pendente</h1><p className="mt-2 text-sm leading-6 text-slate-600">Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local para iniciar o ArtFlix.</p></AccessCard>;
  if (loading) return <AccessCard><div className="flex items-center gap-3 text-sm text-slate-600"><span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />Carregando sua área de trabalho…</div></AccessCard>;
  if (!user) return <AccessCard>
    <div className="mb-6"><span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"><ShieldCheck size={13} /> Acesso protegido</span><h1 className="mt-4 text-2xl font-bold tracking-tight">{registering ? 'Solicitar acesso' : 'Entrar no ArtFlix'}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{registering ? 'Crie sua conta. O administrador master libera o acesso ao estúdio.' : 'Seus projetos ficam disponíveis apenas na sua conta.'}</p></div>
    <form onSubmit={submitAuth} className="space-y-4">
      <label className="block text-xs font-semibold text-slate-700">E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      <label className="block text-xs font-semibold text-slate-700">Senha<input required minLength={8} type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label>
      <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b64c1e] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#9f3f15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-60"><KeyRound size={16} />{busy ? 'Aguarde…' : registering ? 'Criar conta' : 'Entrar'}</button>
    </form>
    {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    <button onClick={() => { setRegistering(!registering); setMessage(''); }} className="mt-5 text-sm font-semibold text-[#b64c1e] underline-offset-2 hover:underline">{registering ? 'Já tenho conta' : 'Solicitar uma conta'}</button>
  </AccessCard>;
  if (!profile || !profile.active) return <AccessCard><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Users size={23} /></div><h1 className="mt-5 text-2xl font-bold">Aguardando liberação</h1><p className="mt-2 text-sm leading-6 text-slate-600">Seu cadastro está vinculado a <strong>{user.email}</strong>. O administrador master precisa ativá-lo antes de abrir o estúdio.</p>{message && <p role="alert" className="mt-3 text-sm text-rose-700">{message}</p>}<div className="mt-6 flex gap-4"><button onClick={() => location.reload()} className="text-sm font-semibold text-[#b64c1e]">Verificar acesso</button><button onClick={() => supabase?.auth.signOut()} className="text-sm font-semibold text-slate-600">Sair da conta</button></div></AccessCard>;
  if (initialProjects === null) return <AccessCard><p role="alert" className="text-sm text-rose-700">{message || 'Não foi possível carregar seus projetos.'}</p><button onClick={() => location.reload()} className="mt-4 text-sm font-semibold text-[#b64c1e]">Tentar novamente</button></AccessCard>;

  if (view === 'admin' && profile.role === 'master') return <div className="min-h-screen bg-[#f5f3ef] text-slate-900">
    <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#b64c1e]">ArtFlix · Administração</p><h1 className="text-xl font-bold tracking-tight">Controle de acessos</h1></div><div className="flex gap-2"><button onClick={() => setView('studio')} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50">Abrir estúdio</button><button onClick={() => supabase?.auth.signOut()} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-stone-50" aria-label="Sair"><LogOut size={18} /></button></div></div></header>
    <main className="mx-auto max-w-6xl px-5 py-9"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800"><LayoutDashboard size={13} /> Painel master</span><h2 className="mt-3 text-3xl font-bold tracking-tight">Usuários do ArtFlix</h2><p className="mt-2 max-w-xl text-sm text-slate-600">Aprove ou suspenda contas. Cada projeto continua visível apenas ao seu proprietário.</p></div><button onClick={loadDirectory} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-50">Atualizar lista</button></div>
      {message && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-stone-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Conta</th><th className="px-5 py-4">Perfil</th><th className="px-5 py-4">Situação</th><th className="px-5 py-4 text-right">Acesso</th></tr></thead><tbody>{directory.map(entry => <tr key={entry.id} className="border-t border-stone-100"><td className="px-5 py-4 font-medium">{entry.email}</td><td className="px-5 py-4">{entry.role === 'master' ? 'Administrador master' : 'Usuário'}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${entry.active ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{entry.active ? <Check size={12} /> : null}{entry.active ? 'Ativo' : 'Pendente / suspenso'}</span></td><td className="px-5 py-4 text-right">{entry.role !== 'master' && <button onClick={() => toggleAccess(entry)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold hover:bg-stone-50">{entry.active ? 'Suspender' : 'Aprovar'}</button>}</td></tr>)}</tbody></table>{directory.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma conta encontrada.</p>}</div>
    </main>
  </div>;

  return <App initialBranches={initialProjects} userEmail={profile.email} isMaster={profile.role === 'master'} onOpenAdmin={() => { setView('admin'); void loadDirectory(); }} onSignOut={() => { void supabase?.auth.signOut(); }} onProjectsChange={saveProjects} />;
}
