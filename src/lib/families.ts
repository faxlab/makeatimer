import type { ToolFamilyId } from './types';

export const families: {
  id: ToolFamilyId;
  name: string;
  light: string;
  dark: string;
}[] = [
  { id: 'timers', name: 'Timers', light: '#146c43', dark: '#52b788' },
  { id: 'time-math', name: 'Time math', light: '#2457b2', dark: '#6fa8ff' },
  { id: 'work', name: 'Work', light: '#825c00', dark: '#f2bc57' },
  { id: 'dates', name: 'Dates', light: '#6941a5', dark: '#b69cff' },
  { id: 'time-zones', name: 'Time zones', light: '#006b78', dark: '#57c7d4' },
  {
    id: 'rates-media',
    name: 'Rates & media',
    light: '#a4441f',
    dark: '#f28c63',
  },
];

export const getFamily = (id: ToolFamilyId) =>
  families.find((family) => family.id === id)!;
export const familyStyle = (id: ToolFamilyId) => {
  const family = getFamily(id);
  return `--family-light:${family.light};--family-dark:${family.dark}`;
};
