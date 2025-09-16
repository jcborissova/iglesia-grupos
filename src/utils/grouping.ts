import type { Person } from '../types';


export function shuffle<T>(arr: T[]): T[] {
const a = [...arr];
for (let i = a.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[a[i], a[j]] = [a[j], a[i]];
}
return a;
}


export function partitionIntoGroups(people: Person[], groupsCount: number): Person[][] {
const shuffled = shuffle(people);
const base = Math.floor(shuffled.length / groupsCount);
const remainder = shuffled.length % groupsCount;
const groups: Person[][] = [];
let idx = 0;
for (let g=0; g<groupsCount; g++) {
const size = base + (g < remainder ? 1 : 0);
groups.push(shuffled.slice(idx, idx + size));
idx += size;
}
return groups;
}