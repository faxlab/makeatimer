import type { Values } from './types';
export function encodeShare(values: Values): string {
  return `#${new URLSearchParams({ ...values, v: '1' }).toString()}`;
}
export function decodeShare(
  fragment: string,
  defaults: Values,
): { values: Values; warning: string } {
  if (!fragment || fragment === '#')
    return { values: { ...defaults }, warning: '' };
  if (fragment.length > 12000)
    return {
      values: { ...defaults },
      warning: 'This shared link is too long. Defaults were restored.',
    };
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  if (
    params.get('v') !== '1' ||
    [...params.keys()].some((k) => k !== 'v' && !Object.hasOwn(defaults, k)) ||
    [...params.keys()].some((k) => params.getAll(k).length !== 1)
  )
    return {
      values: { ...defaults },
      warning: 'This shared link is not supported. Defaults were restored.',
    };
  return {
    values: Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, params.get(k) ?? v]),
    ),
    warning: '',
  };
}
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fallback */
    }
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const success = document.execCommand('copy');
  input.remove();
  if (!success)
    throw new Error(
      'Copy is unavailable. Select and copy the result or address manually.',
    );
}
