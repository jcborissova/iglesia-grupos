export type Person = { id: string; names: string; phone?: string; notes?: string };
export type Session = { id: string; session_name: string; session_date_iso: string };
export type Member = { id: string; group_id: string; person_id: string; position_index: number };
export type GroupDetail = { id: string; session_id: string; group_name: string; members: Array<Member & { person: Person|null }>; };