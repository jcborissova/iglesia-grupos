/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { Api, type Person, type Session, type GroupDetail } from '../api';
import { DndContext, closestCenter, type DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal, TextField, PrimaryButton, GhostButton, Spinner } from '../ui/primitives';

/* id local */
function uid() {
  const c: any = globalThis as any;
  if (c.crypto?.randomUUID) return c.crypto.randomUUID();
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

/* barajar y repartir */
function generateBalancedGroups(people: Person[], count: number) {
  const shuffled = [...people];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = Array.from({ length: Math.max(1, count) }, (_, i) => ({
    id: uid(),
    group_name: `Grupo ${i + 1}`,
    members: [] as Person[],
  }));
  shuffled.forEach((p, i) => { groups[i % groups.length].members.push(p); });
  return groups;
}

export default function SessionBoard({
  session,
  onClose,
  autoGenerateCount,
}: {
  session: Session;
  onClose: () => void;
  autoGenerateCount?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<GroupDetail[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [localGroups, setLocalGroups] = useState<
    { id: string; group_name: string; members: Person[] }[] | null
  >(null);

  const [count, setCount] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [d, ps] = await Promise.all([Api.getSessionDetail(session.id), Api.listPeople()]);
        setDetail(d.groups);
        setPeople(ps);
      } finally {
        setLoading(false);
      }
    })();
  }, [session.id]);

  const hasPersisted = !!(detail && detail.length > 0);

  useEffect(() => {
    if (!loading && !hasPersisted && !localGroups && autoGenerateCount && autoGenerateCount > 0 && people.length) {
      setCount(autoGenerateCount);
      setLocalGroups(generateBalancedGroups(people, autoGenerateCount));
    }
  }, [loading, hasPersisted, localGroups, autoGenerateCount, people]);

  function onGenerate() {
    if (!people.length) return;
    setLocalGroups(generateBalancedGroups(people, Math.max(1, Number(count) || 1)));
  }

  async function persistGenerated() {
    if (!localGroups) return;
    setSaving(true);
    try {
      await Api.saveGenerated({
        session_id: session.id,
        groups: localGroups.map((g) => ({ group_name: g.group_name, members: g.members.map((m) => m.id) })),
      });
      const d = await Api.getSessionDetail(session.id);
      setDetail(d.groups);
      setLocalGroups(null);
    } finally {
      setSaving(false);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || !localGroups) return;

    const [fromGId, personId] = String(active.id).split('::');
    const overId = String(over.id);
    const toGId = overId.includes('::') ? overId.split('::')[0] : overId; // item o contenedor

    if (fromGId === toGId) return;

    const next = localGroups.map((g) => ({ ...g, members: [...g.members] }));
    const from = next.find((g) => g.id === fromGId)!;
    const to = next.find((g) => g.id === toGId)!;

    const idx = from.members.findIndex((m) => m.id === personId);
    if (idx < 0) return;
    const [moved] = from.members.splice(idx, 1);
    to.members.push(moved);
    setLocalGroups(next);
  }

  return (
    <Modal open={true} onClose={onClose} width="max-w-5xl">
      <div className="p-4 sm:p-5 grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600">Sesión</div>
            <div className="text-base font-semibold">{session.session_name}</div>
          </div>
          <GhostButton onClick={onClose}>Cerrar</GhostButton>
        </div>

        {loading && (
          <div className="grid place-items-center h-[30vh]">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Spinner />
              Cargando detalle y personas…
            </div>
          </div>
        )}

        {!loading && !hasPersisted && !localGroups && (
          <div className="rounded-xl ring-1 ring-black/5 bg-white p-3 grid gap-3">
            <div className="text-sm font-medium">Generar grupos</div>
            <div className="flex items-end gap-3">
              <TextField
                label="Cantidad"
                type="number"
                min={1}
                value={String(count)}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-28"
              />
              <PrimaryButton onClick={onGenerate} disabled={!people.length}>
                Generar
              </PrimaryButton>
              <span className="text-xs text-gray-500">
                {people.length ? `Personas disponibles: ${people.length}` : 'Sin personas cargadas.'}
              </span>
            </div>
          </div>
        )}

        {localGroups && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Vista previa (arrastrar para mover)</div>
              <div className="flex gap-2">
                <PrimaryButton onClick={persistGenerated} loading={saving}>
                  Guardar
                </PrimaryButton>
                <GhostButton onClick={() => setLocalGroups(null)} disabled={saving}>
                  Cancelar
                </GhostButton>
              </div>
            </div>

            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {localGroups.map((g) => (
                  <TempGroupColumn
                    key={g.id}
                    gid={g.id}
                    title={g.group_name}
                    members={g.members}
                    onRename={(name) =>
                      setLocalGroups((prev) =>
                        prev?.map((x) => (x.id === g.id ? { ...x, group_name: name } : x)) || null
                      )
                    }
                  />
                ))}
              </div>
            </DndContext>
          </div>
        )}

        {!loading && hasPersisted && detail && (
          <PersistedGroups
            groups={detail}
            onRename={async (gid, name) => {
              await Api.renameGroup({ group_id: gid, group_name: name });
              const d = await Api.getSessionDetail(session.id);
              setDetail(d.groups);
            }}
          />
        )}
      </div>
    </Modal>
  );
}

/* ====== Columnas temporales (vista previa) ====== */
function TempGroupColumn({
  gid,
  title,
  members,
  onRename,
}: {
  gid: string;
  title: string;
  members: Person[];
  onRename: (n: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: gid });

  return (
    <div ref={setNodeRef} className="rounded-xl ring-1 ring-black/5 p-3 bg-white">
      <input
        className="w-full font-medium outline-none bg-transparent mb-2 border-b border-gray-100 pb-1"
        value={title}
        onChange={(e) => onRename(e.target.value)}
      />
      <SortableContext items={members.map((m) => `${gid}::${m.id}`)} strategy={verticalListSortingStrategy}>
        <ul className={`grid gap-2 ${isOver ? 'bg-slate-50 rounded-lg p-1' : ''}`} id={gid}>
          {members.map((m) => (
            <TempCard key={`${gid}::${m.id}`} id={`${gid}::${m.id}`} label={m.names} />
          ))}
          {members.length === 0 && <li className="text-xs text-gray-400 italic px-1 py-1">Arrastra aquí</li>}
        </ul>
      </SortableContext>
    </div>
  );
}

function TempCard({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="px-3 py-2 rounded-lg ring-1 ring-gray-200 bg-gray-50 text-sm"
    >
      {label}
    </li>
  );
}

/* ====== Grupos persistidos ====== */
function PersistedGroups({
  groups,
  onRename,
}: {
  groups: GroupDetail[];
  onRename: (gid: string, name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map((g) => (
        <div key={g.id} className="rounded-xl ring-1 ring-black/5 p-3 bg-white">
          <input
            defaultValue={g.group_name || ''}
            className="w-full font-medium outline-none bg-transparent mb-2 border-b border-gray-100 pb-1"
            onBlur={(e) => onRename(g.id, e.target.value)}
          />
          <ul className="grid gap-2">
            {g.members.map((m) => (
              <li key={m.id} className="px-3 py-2 rounded-lg ring-1 ring-gray-200 bg-gray-50 text-sm">
                {m.person?.names || '—'}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
