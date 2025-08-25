export function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function toSentenceCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
