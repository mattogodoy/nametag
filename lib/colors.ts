export const PRESET_COLORS: string[] = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
];

const toHex = (value: number): string => value.toString(16).padStart(2, '0');

export function getRandomColor(): string {
  const red = Math.floor(Math.random() * 256);
  const green = Math.floor(Math.random() * 256);
  const blue = Math.floor(Math.random() * 256);

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}
