export type Values = Record<string, string>;
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'zone';
  default: string;
  help?: string;
  options?: [string, string][];
  min?: string;
  max?: string;
  step?: string;
};
export type Result = {
  value: string;
  detail: string;
  rows?: [string, string][];
  csv?: string;
};
export type Tool = {
  id: string;
  name: string;
  category: string;
  description: string;
  intro: string;
  fields: Field[];
  example: string;
  convention: string;
  related: string[];
  defaultResult: Result;
};
