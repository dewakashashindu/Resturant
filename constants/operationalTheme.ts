/** Screenshot-matched operational palette.
 * Intentionally separate from the customer menu theme: app/menu and its shared
 * components retain their original appearance. Keep semantic status colours.
 */
export const OperationalColors = {
  canvas: '#FAF7F2',
  surface: '#FFFDFA',
  surfaceAlt: '#F3ECDC',
  header: '#E8DAC0',
  selected: '#E3D3B6',
  primary: '#6B5038',
  text: '#403629',
  muted: '#847563',
  border: '#DDD1BF',
  disabled: '#B4A591',
  onPrimary: '#FFFFFF',
  accent: '#A88B62',
  accentSoft: '#D5C09C',
} as const;
