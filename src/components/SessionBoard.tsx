/* eslint-disable no-empty */
// src/components/SessionBoard.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Requiere: npm i sortablejs
import { useEffect, useRef, useState, useCallback } from 'react';
import Sortable from 'sortablejs';
import { Api, type Person, type Session, type GroupDetail } from '../api';
import { Modal, TextField, PrimaryButton, GhostButton, Spinner } from '../ui/primitives';
import { jsPDF } from 'jspdf';


/* ---------- Helpers ---------- */

function uid() {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

/** Barajar y repartir equitativamente */
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
  shuffled.forEach((p, i) => {
    groups[i % groups.length].members.push(p);
  });
  return groups;
}

type ExportGroup = { group_name: string; members: string[] };

function exportGroupsToPDF({
  sessionName,
  groups,
}: {
  sessionName: unknown;
  groups: { group_name: string; members: string[] }[];
}) {
  const toSafeText = (v: unknown, fb = 'Sessio') => (v ?? fb).toString().trim();
  const toSlug = (v: string) =>
    v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');

  const safeSession = toSafeText(sessionName, 'Session');
  const fileBase = toSlug(`Groups_${safeSession}`);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612x792 pt aprox
  const marginX = 48;
  const marginY = 60;
  const innerW = doc.internal.pageSize.getWidth() - marginX * 2;
  const innerH = doc.internal.pageSize.getHeight() - marginY * 2;

  // Config de columnas
  const COLS = 2;
  const GUTTER = 18;
  const colW = (innerW - GUTTER * (COLS - 1)) / COLS;
  const topY = marginY + 42; // debajo del encabezado
  const bottomY = marginY + innerH;

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Sesión: ${safeSession}`, marginX, marginY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Exportado: ${new Date().toLocaleString()}`, marginX, marginY + 18);

  // Tipografías para el contenido
  const titleFontSize = 12;
  const itemFontSize = 11;
  const titleGap = 6; // espacio bajo el título
  const lineGap = 4;  // espacio entre líneas
  const sectionGap = 10; // espacio entre grupos

  // Estado de layout
  let col = 0;
  let x = marginX;
  let y = topY;

  // Helpers
  const goNextColumn = () => {
    col++;
    x = marginX + col * (colW + GUTTER);
    y = topY;
  };

  const ensureFits = (needed: number) => {
    // Si no cabe en la columna actual, pasa a la siguiente
    if (y + needed > bottomY) goNextColumn();
  };

  // Pintar cada grupo en columnas
  groups.forEach((g) => {
    const title = toSafeText(g.group_name, 'Group');
    const members = (g.members ?? []).map((m) => (m == null || m === '' ? '—' : String(m)));

    // Estimar alto necesario: título + (líneas por miembro)
    // Altura aproximada por línea ≈ itemFontSize + lineGap
    const titleH = titleFontSize + titleGap;
    const lineH = itemFontSize + lineGap;
    const blockH = titleH + Math.max(1, members.length) * lineH + sectionGap;

    ensureFits(blockH);

    // Si ya no hay más columnas disponibles en la página (COLS fijas) y no cabe,
    // reducimos font (fallback). *Opcional*: puedes omitir este bloque si prefieres saltar de página.
    if (col >= COLS) {
      // fallback agresivo: reduce tamaño para forzarlo (último recurso)
      // (Puedes ajustar valores mínimos a tu gusto)
      doc.setFontSize(10);
    }

    // Título del grupo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(titleFontSize);
    doc.text(`${title}`, x, y);
    y += titleH;

    // Miembros numerados
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(itemFontSize);
    members.forEach((name, i) => {
      // Si esta línea no cabe, pasa de columna
      if (y + lineH > bottomY) {
        goNextColumn();
        // Si agotamos columnas, seguimos en la última (o podrías cambiar a nueva página)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(itemFontSize);
        // Repite el título para continuidad visual (opcional)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(titleFontSize);
        doc.text(`Group: ${title} (cont.)`, x, y);
        y += titleH;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(itemFontSize);
      }
      doc.text(`${i + 1}. ${name}`, x, y);
      y += lineH;
    });

    y += sectionGap;
    // Si nos pasamos del límite, la próxima iteración caerá en ensureFits() → nueva columna
  });

  // Footer simple (una sola página)
  doc.setFontSize(9);
  doc.text(
    `Page 1`,
    doc.internal.pageSize.getWidth() - marginX,
    doc.internal.pageSize.getHeight() - 24,
    { align: 'right' }
  );

  doc.save(`${fileBase}.pdf`);
}


/* ---------- Main ---------- */

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
  const [updating, setUpdating] = useState(false); // para DnD en persistidos

  useEffect(() => {
    (async () => {
      try {
        const [d, ps] = await Promise.all([
          Api.getSessionDetail(session.id),
          Api.listPeople(),
        ]);
        setDetail(d.groups);
        setPeople(ps);
      } finally {
        setLoading(false);
      }
    })();
  }, [session.id]);

  const hasPersisted = !!(detail && detail.length > 0);

  // Autogenerar si viene del wizard
  useEffect(() => {
    if (
      !loading &&
      !hasPersisted &&
      !localGroups &&
      autoGenerateCount &&
      autoGenerateCount > 0 &&
      people.length
    ) {
      setCount(autoGenerateCount);
      setLocalGroups(generateBalancedGroups(people, autoGenerateCount));
    }
  }, [loading, hasPersisted, localGroups, autoGenerateCount, people]);

  const onGenerate = () => {
    if (!people.length) return;
    setLocalGroups(generateBalancedGroups(people, Math.max(1, Number(count) || 1)));
  };

  const persistGenerated = async () => {
    if (!localGroups) return;
    setSaving(true);
    try {
      await Api.saveGenerated({
        session_id: session.id,
        groups: localGroups.map((g) => ({
          group_name: g.group_name,
          members: g.members.map((m) => m.id),
        })),
      });
      const d = await Api.getSessionDetail(session.id);
      setDetail(d.groups);
      setLocalGroups(null);
    } finally {
      setSaving(false);
    }
  };

  /** Mover entre columnas (o reordenar) en vista previa local */
  const moveMember = useCallback(
    (fromGid: string, fromIndex: number, toGid: string, toIndex: number) => {
      setLocalGroups((prev) => {
        if (!prev) return prev;
        const next = prev.map((g) => ({ ...g, members: [...g.members] }));
        const from = next.find((g) => g.id === fromGid);
        const to = next.find((g) => g.id === toGid);
        if (!from || !to) return prev;
        const [moved] = from.members.splice(fromIndex, 1);
        to.members.splice(toIndex, 0, moved);
        return next;
      });
    },
    []
  );

  /** Persistir DnD en grupos guardados */
  const swapPersisted = useCallback(
    async (payload: { from_group_id: string; to_group_id: string; person_id: string; to_index: number }) => {
      setUpdating(true);
      try {
        await Api.swapMember(payload);
        const d = await Api.getSessionDetail(session.id);
        setDetail(d.groups);
      } finally {
        setUpdating(false);
      }
    },
    [session.id]
  );

  const handleDownloadPdf = () => {
  // Prioridad: si hay vista previa local -> exporta esa;
  // si no, exporta los grupos persistidos (detail)
  let groupsForPdf: ExportGroup[] = [];

  if (localGroups && localGroups.length) {
    groupsForPdf = localGroups.map(g => ({
      group_name: g.group_name,
      members: g.members.map(m => m.names),
    }));
  } else if (detail && detail.length) {
    groupsForPdf = detail.map(g => ({
      group_name: g.group_name || '',
      members: (g.members || []).map(m => m.person?.names || '—'),
    }));
  } else {
    // Nada que exportar
    groupsForPdf = [];
  }

  exportGroupsToPDF({
    sessionName: session.session_name,
    groups: groupsForPdf,
  });
};


  return (
    <Modal open={true} onClose={onClose} width="max-w-5xl">
      <div className="p-4 sm:p-5 grid gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-600">Sesión</div>
            <div className="text-base font-semibold">{session.session_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton onClick={handleDownloadPdf}>
              Descargar PDF
            </GhostButton>
            <GhostButton onClick={onClose}>Cerrar</GhostButton>
          </div>
        </div>


        {/* Loading unificado */}
        {loading && (
          <div className="grid place-items-center h-[30vh]">
            <div className="inline-flex items-center gap-3 text-sm text-gray-600">
              <Spinner />
              Cargando detalle y personas…
            </div>
          </div>
        )}

        {/* Generador inicial */}
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
                {people.length
                  ? `Personas disponibles: ${people.length}`
                  : 'Sin personas cargadas.'}
              </span>
            </div>
          </div>
        )}

        {/* Vista previa con Sortable.js */}
        {localGroups && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Vista previa (arrastra para mover)</div>
              <div className="flex gap-2">
                <PrimaryButton onClick={persistGenerated} disabled={saving}>
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner /> Guardando…
                    </span>
                  ) : (
                    'Guardar'
                  )}
                </PrimaryButton>
                <GhostButton onClick={() => setLocalGroups(null)} disabled={saving}>
                  Cancelar
                </GhostButton>
              </div>
            </div>

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
                  onMove={moveMember}
                />
              ))}
            </div>
          </div>
        )}

        {/* Grupos guardados (editable con DnD + renombre) */}
        {!loading && hasPersisted && detail && (
          <div className="grid gap-2">
            {updating && (
              <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                <Spinner /> Actualizando cambios…
              </div>
            )}
            <PersistedGroups
              groups={detail}
              onRename={async (gid, name) => {
                await Api.renameGroup({ group_id: gid, group_name: name });
                const d = await Api.getSessionDetail(session.id);
                setDetail(d.groups);
              }}
              onSwap={swapPersisted}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Columnas temporales (Sortable.js) ---------- */

function TempGroupColumn({
  gid,
  title,
  members,
  onRename,
  onMove,
}: {
  gid: string;
  title: string;
  members: Person[];
  onRename: (n: string) => void;
  onMove: (fromGid: string, fromIndex: number, toGid: string, toIndex: number) => void;
}) {
  const listRef = useRef<HTMLUListElement | null>(null);

  // Instancia Sortable por columna (vista previa)
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    el.dataset.gid = gid;

    const sortable = new Sortable(el, {
      group: { name: 'groups-preview', pull: true, put: true },
      animation: 150,
      draggable: '.draggable',
      handle: '.drag-handle',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      dragClass: 'is-dragging',
      fallbackOnBody: true,
      emptyInsertThreshold: 8,
      onEnd: (evt) => {
        const fromEl = evt.from as HTMLElement;
        const toEl   = evt.to   as HTMLElement;
        const itemEl = evt.item as HTMLElement;

        const fromGid = fromEl.dataset.gid!;
        const toGid   = toEl.dataset.gid!;
        const oldIndex = evt.oldIndex ?? 0;
        const newIndex = evt.newIndex ?? 0;

        // Si no cambió nada, salir
        if (fromGid === toGid && oldIndex === newIndex) return;

        // 1) Revertimos el DOM que movió Sortable (evitamos conflicto con React)
        const anchor = fromEl.children[oldIndex] || null;
        try { fromEl.insertBefore(itemEl, anchor); } catch {}

        // 2) Ahora sí, movemos en estado (React hará el DOM real)
        onMove(fromGid, oldIndex, toGid, newIndex);
      },
    });

    return () => sortable.destroy();
  }, [gid, onMove]);

  return (
    <div className="rounded-xl ring-1 ring-black/5 p-3 bg-white">
      <input
        className="w-full font-medium outline-none bg-transparent mb-2 border-b border-gray-100 pb-1"
        value={title}
        onChange={(e) => onRename(e.target.value)}
      />

      <ul ref={listRef} className="grid gap-2 min-h-[44px]">
        {members.map((m) => (
          <li
            key={m.id}
            className="draggable flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-gray-200 bg-gray-50"
          >
            <span className="text-sm truncate">{m.names}</span>
            <button
              type="button"
              className="drag-handle cursor-grab p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Arrastrar"
              aria-label="Arrastrar"
            >
              <span className="inline-block leading-none" aria-hidden>
                ⋮⋮
              </span>
            </button>
          </li>
        ))}

        {members.length === 0 && (
          <li className="pointer-events-none text-xs text-gray-400 italic px-1 py-1">
            Arrastra aquí
          </li>
        )}
      </ul>
    </div>
  );
}

/* ---------- Persistidos (editable + renombre) ---------- */

function PersistedGroups({
  groups,
  onRename,
  onSwap,
}: {
  groups: GroupDetail[];
  onRename: (gid: string, name: string) => void | Promise<void>;
  onSwap: (payload: { from_group_id: string; to_group_id: string; person_id: string; to_index: number }) => void | Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map((g) => (
        <PersistedGroupColumn
          key={g.id}
          gid={g.id}
          title={g.group_name || ''}
          members={g.members}
          onRename={(name) => onRename(g.id, name)}
          onSwap={onSwap}
        />
      ))}
    </div>
  );
}

function PersistedGroupColumn({
  gid,
  title,
  members,
  onRename,
  onSwap,
}: {
  gid: string;
  title: string;
  members: Array<{ id: string; person_id: string; person?: Person | null }>;
  onRename: (name: string) => void | Promise<void>;
  onSwap: (payload: { from_group_id: string; to_group_id: string; person_id: string; to_index: number }) => void | Promise<void>;
}) {
  const listRef = useRef<HTMLUListElement | null>(null);

  // Instancia Sortable por grupo persistido
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    el.dataset.gid = gid;

    const sortable = new Sortable(el, {
      group: { name: 'groups-persisted', pull: true, put: true },
      animation: 150,
      draggable: '.draggable',
      handle: '.drag-handle',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      dragClass: 'is-dragging',
      fallbackOnBody: true,
      emptyInsertThreshold: 8,
      onEnd: async (evt) => {
        const fromEl = evt.from as HTMLElement;
        const toEl   = evt.to   as HTMLElement;
        const itemEl = evt.item as HTMLElement;

        const fromGid = fromEl.dataset.gid!;
        const toGid   = toEl.dataset.gid!;
        const oldIndex = evt.oldIndex ?? 0;
        const newIndex = evt.newIndex ?? 0;

        if (fromGid === toGid && oldIndex === newIndex) return;

        // person_id antes de revertir DOM
        const personId = (itemEl as HTMLElement).dataset.personId!;

        // Revertir DOM inmediatamente (React hará el cambio real)
        const anchor = fromEl.children[oldIndex] || null;
        try { fromEl.insertBefore(itemEl, anchor); } catch {}

        // Persistir en backend y refrescar
        await onSwap({
          from_group_id: fromGid,
          to_group_id: toGid,
          person_id: personId,
          to_index: newIndex,
        });
      },
    });

    return () => sortable.destroy();
  }, [gid, onSwap]);

  return (
    <div className="rounded-xl ring-1 ring-black/5 p-3 bg-white">
      <input
        defaultValue={title}
        className="w-full font-medium outline-none bg-transparent mb-2 border-b border-gray-100 pb-1"
        onBlur={(e) => onRename(e.target.value)}
      />
      <ul ref={listRef} className="grid gap-2 min-h-[44px]">
        {members.map((m) => (
          <li
            key={m.id}
            data-person-id={m.person_id}
            className="draggable flex items-center justify-between gap-3 px-3 py-2 rounded-lg ring-1 ring-gray-200 bg-gray-50"
          >
            <span className="text-sm truncate">{m.person?.names || '—'}</span>
            <button
              type="button"
              className="drag-handle cursor-grab p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Arrastrar"
              aria-label="Arrastrar"
            >
              <span className="inline-block leading-none" aria-hidden>
                ⋮⋮
              </span>
            </button>
          </li>
        ))}
        {members.length === 0 && (
          <li className="pointer-events-none text-xs text-gray-400 italic px-1 py-1">
            Arrastra aquí
          </li>
        )}
      </ul>
    </div>
  );
}
