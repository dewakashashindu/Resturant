/** Pure layout math; dp-based, recalculated on rotation / font-scale changes. */
export function getHomeLayout(width: number, height: number, fontScale = 1) {
  const usableWidth = Math.min(width, 1120);
  const padding = width < 360 ? 16 : width < 700 ? 20 : 32;
  const gap = width < 360 ? 10 : 14;
  const available = Math.max(0, usableWidth - padding * 2);
  // More space per card for large accessibility fonts; never force text to fit.
  const minimumCardWidth = fontScale > 1.3 ? 230 : 145;
  const maxColumns = width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((available + gap) / (minimumCardWidth + gap))));
  return {
    columns, padding, gap,
    cardWidth: Math.floor((available - (columns - 1) * gap) / columns),
    cardMinHeight: height < 500 ? 145 : width >= 700 ? 184 : 166,
    compact: height < 500,
    stackGreeting: width < 700 || fontScale > 1.3,
    nameSize: width >= 700 ? 26 : width < 360 ? 20 : 23,
    iconSize: width >= 700 ? 30 : 27,
    titleSize: width >= 700 ? 17 : 15,
  };
}
