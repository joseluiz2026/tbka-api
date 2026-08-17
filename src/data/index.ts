import type { Record_ } from '../types';
import raw from './records.json';

export const DATA: Record_[] = raw as Record_[];

export function findById(id: string): Record_ | undefined {
  return DATA.find((d) => d.id.toLowerCase() === id.toLowerCase());
}
