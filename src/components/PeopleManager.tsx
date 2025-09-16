/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useMemo, useState } from 'react';
import { Api, type Person } from '../api';
import { Modal, TextField, PrimaryButton, GhostButton, Link, DangerLink, Spinner } from '../ui/primitives';

type Draft = { names: string; phone?: string; notes?: string };

export default function PeopleManager() {
  const [list, setList] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // búsqueda + orden
  const [q, setQ] = useState('');
  const [asc, setAsc] = useState(true);

  // modal form (create/edit) + confirm
  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [current, setCurrent] = useState<Person | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setList(await Api.listPeople());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // lista filtrada/ordenada
  const shown = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const f = list.filter(p =>
      norm(`${p.names ?? ''} ${p.phone ?? ''} ${p.notes ?? ''}`).includes(norm(q))
    );
    return f.sort((a, b) => (asc ? 1 : -1) * (a.names ?? '').localeCompare(b.names ?? ''));
  }, [list, q, asc]);

  // abrir modales
  function openCreate() { setMode('create'); setCurrent(null); setOpenForm(true); }
  function openEdit(p: Person) { setMode('edit'); setCurrent(p); setOpenForm(true); }

  // guardar (create/edit)
  async function handleSubmit(d: Draft) {
    const names = d.names?.trim(); if (!names) return;
    if (mode === 'edit' && current) {
      await Api.updatePerson({ id: current.id, names, phone: d.phone ?? '', notes: d.notes ?? '' });
    } else {
      await Api.createPerson({ names, phone: d.phone ?? '', notes: d.notes ?? '' });
    }
    setOpenForm(false);
    await load();
  }

  // borrar
  function askDelete(p: Person) { setToDelete(p); setConfirmOpen(true); }
  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Api.deletePerson(toDelete.id);
      setConfirmOpen(false);
      setToDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center h-[40vh]">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Spinner />
          Cargando personas…
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Personas</h2>
          <p className="text-xs text-gray-500">Lista simple, sin ruido visual.</p>
        </div>
        <PrimaryButton onClick={openCreate}>Agregar</PrimaryButton>
      </div>

      {/* búsqueda + orden */}
      <div className="flex items-center gap-3">
        <TextField
          placeholder="Buscar por nombre, teléfono o notas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <GhostButton onClick={() => setAsc(s => !s)} title="Cambiar orden">
          {asc ? 'A → Z' : 'Z → A'}
        </GhostButton>
      </div>

      {/* lista */}
      {shown.length === 0 ? (
        <div className="rounded-2xl ring-1 ring-black/5 bg-white p-10 text-center">
          <div className="text-sm font-semibold">Sin personas</div>
          <p className="mt-1 text-xs text-gray-500">Agrega tu primer registro.</p>
          <div className="mt-4">
            <PrimaryButton onClick={openCreate}>Agregar</PrimaryButton>
          </div>
        </div>
      ) : (
        <ul className="rounded-2xl ring-1 ring-black/5 bg-white divide-y divide-gray-100">
          {shown.map((p) => (
            <li key={p.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.names}</div>
                  <div className="mt-0.5 text-xs text-gray-500 truncate">
                    {p.phone || '—'} · {p.notes || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link onClick={() => openEdit(p)}>Editar</Link>
                  <DangerLink onClick={() => askDelete(p)}>Eliminar</DangerLink>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal formulario (create/edit) */}
      <Modal open={openForm} onClose={() => setOpenForm(false)}>
        <div className="p-5 grid gap-4">
          <div className="text-base font-semibold">
            {mode === 'edit' ? 'Editar persona' : 'Agregar persona'}
          </div>
          <PersonForm
            initial={{
              names: current?.names ?? '',
              phone: current?.phone ?? '',
              notes: current?.notes ?? '',
            }}
            onCancel={() => setOpenForm(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </Modal>

      {/* Confirmación eliminar */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="p-5 grid gap-4">
          <div className="text-base font-semibold">Eliminar integrante</div>
          <p className="text-sm text-gray-600">
            ¿Eliminar a “{toDelete?.names}”? Esta acción no se puede deshacer.
          </p>
        <div className="flex items-center justify-end gap-2">
            <GhostButton onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancelar</GhostButton>
            <PrimaryButton onClick={confirmDelete} loading={deleting} className="bg-rose-600 hover:bg-rose-700">
              Eliminar
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Subcomponentes ---------- */
function PersonForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: Draft;
  onCancel: () => void;
  onSubmit: (d: Draft) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<{ names?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initial), [initial]);

  function validate(d: Draft) {
    const e: { names?: string; phone?: string } = {};
    if (!d.names || !d.names.trim()) e.names = 'El nombre es requerido';
    if (d.phone && !/^[\d\s()+\-]{6,20}$/.test(d.phone)) e.phone = 'Teléfono inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(draft)) return;
    setSaving(true);
    try {
      await onSubmit({ ...draft, names: draft.names.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <TextField
        label="Nombre"
        placeholder="Ej. Juan Pérez"
        value={draft.names}
        onChange={(e) => setDraft({ ...draft, names: e.target.value })}
      />
      {errors.names && <p className="text-xs text-rose-600">{errors.names}</p>}

      <TextField
        label="Teléfono (opcional)"
        value={draft.phone}
        onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
      />
      {errors.phone && <p className="text-xs text-rose-600">{errors.phone}</p>}

      <TextField
        label="Notas (opcional)"
        value={draft.notes}
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
      />

      <div className="mt-1 flex items-center justify-end gap-2">
        <GhostButton type="button" onClick={onCancel} disabled={saving}>Cancelar</GhostButton>
        <PrimaryButton type="submit" loading={saving}>Guardar</PrimaryButton>
      </div>
    </form>
  );
}
