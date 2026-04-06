import type { StoreKey } from '@/types/models';

export type { StoreKey };

export const STORES: Record<StoreKey, {
  label: string;
  shortLabel: string;
  monopopId: number;
  monopopName: string;
}> = {
  prezunic: {
    label: 'Prezunic',
    shortLabel: 'Prez',
    monopopId: 101,
    monopopName: '[mintel]prezunic',
  },
  zonasul: {
    label: 'Zona Sul',
    shortLabel: 'ZS',
    monopopId: 102,
    monopopName: '[mintel]zonasul',
  },
  hortifruti: {
    label: 'Hortifruti',
    shortLabel: 'Horti',
    monopopId: 103,
    monopopName: '[mintel]hortifruti',
  },
};

export const STORE_KEYS = Object.keys(STORES) as StoreKey[];