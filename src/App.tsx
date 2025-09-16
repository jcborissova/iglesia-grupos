/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { Api, type Session } from './api';
import PeopleManager from './components/PeopleManager';
import SessionBoard from './components/SessionBoard';
import { Modal, TextField, PrimaryButton, GhostButton, Spinner } from './ui/primitives';

/* Pestaña mínima */
function Tab({
  active,
  children,
  onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 text-sm rounded-xl transition',
        active ? 'bg-white shadow-sm' : 'hover:bg-white/70 text-gray-600',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<'sessions' | 'people'>('sessions');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [autoGenerateCount, setAutoGenerateCount] = useState<number | undefined>(undefined);

  // wizard crear sesión
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState<string>('');
  const [groupsCount, setGroupsCount] = useState<number>(3);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await Api.listSessions();
      setSessions([...data].sort((a, b) => b.session_date_iso.localeCompare(a.session_date_iso)));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createSession() {
    const name = sessionName.trim(); if (!name) return;
    setCreating(true);
    try {
      const payload: { session_name: string; session_date_iso?: string } = { session_name: name };
      if (sessionDate) payload.session_date_iso = new Date(sessionDate).toISOString();
      const res = await Api.createSession(payload);
      const s: Session = {
        id: res.id,
        session_name: name,
        session_date_iso: payload.session_date_iso ?? new Date().toISOString(),
      } as Session;

      setCreateOpen(false);
      setStep(1);
      setSessionName('');
      setSessionDate('');
      setAutoGenerateCount(groupsCount);
      setSelected(s);
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* TopBar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Grupos · Iglesia</h1>
            <p className="text-xs text-gray-500 -mt-0.5">Historial, generación y organización</p>
          </div>
          <nav className="rounded-xl p-1 bg-gray-100">
            <div className="flex items-center gap-1">
              <Tab active={tab === 'sessions'} onClick={() => setTab('sessions')}>Sesiones</Tab>
              <Tab active={tab === 'people'} onClick={() => setTab('people')}>Personas</Tab>
            </div>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'sessions' ? (
          <SessionsView
            sessions={sessions}
            loading={loading}
            onOpen={(s) => { setSelected(s); setAutoGenerateCount(undefined); }}
            onCreate={() => { setCreateOpen(true); setStep(1); }}
          />
        ) : (
          <PeopleManager />
        )}
      </main>

      {/* Modal: crear sesión (2 pasos) */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <div className="p-5 grid gap-4">
          {step === 1 ? (
            <>
              <div className="text-base font-semibold">Nueva sesión — Paso 1/2</div>
              <div className="grid gap-3">
                <TextField
                  label="Nombre de la sesión"
                  placeholder="Células 2025-09-15"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
                <TextField
                  label="Fecha (opcional)"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <GhostButton onClick={() => setCreateOpen(false)}>Cancelar</GhostButton>
                <PrimaryButton onClick={() => setStep(2)} disabled={!sessionName.trim()}>
                  Siguiente
                </PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <div className="text-base font-semibold">Nueva sesión — Paso 2/2</div>
              <div className="grid gap-3">
                <TextField
                  label="¿Cuántos grupos?"
                  type="number"
                  min={1}
                  value={String(groupsCount)}
                  onChange={(e) => setGroupsCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-28"
                />
                <p className="text-xs text-gray-500">Podrás mover personas entre grupos antes de guardar.</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <GhostButton onClick={() => setStep(1)}>Atrás</GhostButton>
                <div className="flex gap-2">
                  <GhostButton onClick={() => setCreateOpen(false)}>Cancelar</GhostButton>
                  <PrimaryButton onClick={createSession} loading={creating}>
                    Crear y generar
                  </PrimaryButton>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal: detalle sesión */}
      {selected && (
        <SessionBoard
          session={selected}
          autoGenerateCount={autoGenerateCount}
          onClose={() => { setSelected(null); setAutoGenerateCount(undefined); }}
        />
      )}
    </div>
  );
}

/* ---- Lista de sesiones con spinner ---- */
function SessionsView({
  sessions,
  loading,
  onOpen,
  onCreate,
}: {
  sessions: Session[];
  loading: boolean;
  onOpen: (s: Session) => void;
  onCreate: () => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center h-[40vh]">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Spinner />
          Cargando sesiones…
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Sesiones</h2>
          <p className="text-xs text-gray-500">Crea, guarda y reutiliza tus sesiones con historial.</p>
        </div>
        <PrimaryButton onClick={onCreate}>Agregar</PrimaryButton>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl ring-1 ring-black/5 bg-white p-10 text-center">
          <div className="text-sm font-semibold">Sin sesiones aún</div>
          <p className="mt-1 text-xs text-gray-500">Crea tu primera sesión para generar grupos.</p>
          <div className="mt-4">
            <PrimaryButton onClick={onCreate}>Crear sesión</PrimaryButton>
          </div>
        </div>
      ) : (
        <ul className="rounded-2xl ring-1 ring-black/5 bg-white divide-y divide-gray-100">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.session_name}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {new Date(s.session_date_iso).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">Abrir</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
