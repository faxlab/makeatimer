import type { ToolFamilyId } from './types';

export const families: {
  id: ToolFamilyId;
  name: string;
  light: string;
  dark: string;
  colour: string;
  symbol: string;
  symbolInk: string;
}[] = [
  {
    id: 'timers',
    name: 'Timers',
    light: '#00763e',
    dark: '#22c976',
    colour: '#009952',
    symbol: 'T',
    symbolInk: '#111111',
  },
  {
    id: 'time-math',
    name: 'Time math',
    light: '#0053b0',
    dark: '#78a9ff',
    colour: '#0062cf',
    symbol: 'M',
    symbolInk: '#ffffff',
  },
  {
    id: 'work',
    name: 'Work',
    light: '#765400',
    dark: '#f6bc26',
    colour: '#f6bc26',
    symbol: 'W',
    symbolInk: '#111111',
  },
  {
    id: 'dates',
    name: 'Dates',
    light: '#9a38a1',
    dark: '#dc68e3',
    colour: '#9a38a1',
    symbol: 'D',
    symbolInk: '#ffffff',
  },
  {
    id: 'time-zones',
    name: 'Time zones',
    light: '#c51f2e',
    dark: '#ff6773',
    colour: '#d82233',
    symbol: 'Z',
    symbolInk: '#ffffff',
  },
  {
    id: 'rates-media',
    name: 'Rates & media',
    light: '#a54400',
    dark: '#ff8930',
    colour: '#eb6800',
    symbol: 'R',
    symbolInk: '#111111',
  },
];

export const getFamily = (id: ToolFamilyId) =>
  families.find((family) => family.id === id)!;
export const familyStyle = (id: ToolFamilyId) => {
  const family = getFamily(id);
  return `--family-light:${family.light};--family-dark:${family.dark};--family-colour:${family.colour};--family-symbol:"${family.symbol}";--family-symbol-ink:${family.symbolInk}`;
};
