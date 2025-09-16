// src/api.ts
import type { GroupDetail, Person, Session } from './types';

const BASE = import.meta.env.VITE_API_URL as string;

async function http<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const url = new URL(BASE);
  url.searchParams.set('path', path); // <-- SOLO el path
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v)); // <-- otros params separados
    }
  }

  const init: RequestInit = { method };

  if (method === 'POST') {
    // Para evitar preflight en Apps Script, mantenemos text/plain
    init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    init.body = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  }

  const res = await fetch(url.toString(), init);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'API error');
  return json.data as T;
}

export const Api = {
  // People
  listPeople: () => http<Person[]>('people'),
  createPerson: (p: Partial<Person>) =>
    http<{ id: string }>('people/create', 'POST', p),
  updatePerson: (p: Partial<Person> & { id: string }) =>
    http<{ id: string }>('people/update', 'POST', p),
  deletePerson: (id: string) =>
    http<{ id: string }>('people/delete', 'POST', { id }),

  // Sessions
  listSessions: () => http<Session[]>('sessions'),
  createSession: (payload: { session_name: string; session_date_iso?: string }) =>
    http<{ id: string }>('sessions/create', 'POST', payload),

  // Session detail
  getSessionDetail: (session_id: string) =>
    http<{ groups: GroupDetail[] }>('session/detail', 'GET', undefined, { session_id }),
  renameGroup: (payload: { group_id: string; group_name: string }) =>
    http('groups/rename', 'POST', payload),
  swapMember: (payload: {
    from_group_id: string;
    to_group_id: string;
    person_id: string;
    to_index: number;
  }) => http('groups/swapMember', 'POST', payload),
  saveGenerated: (payload: {
    session_id: string;
    groups: { group_name: string; members: string[] }[];
  }) => http('groups/saveGenerated', 'POST', payload),
};

export type { Person, Session, GroupDetail } from './types';
