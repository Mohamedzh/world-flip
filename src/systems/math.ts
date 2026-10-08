/** Moves `current` toward `target` by at most `maxStep`, without overshooting. */
export function approach(current: number, target: number, maxStep: number): number {
  if (current < target) return Math.min(current + maxStep, target);
  return Math.max(current - maxStep, target);
}

/** Formats milliseconds as m:ss, e.g. 83500 -> "1:23". */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
