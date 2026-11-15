export function formatDuration(hours: number): string {
  if (hours <= 0) {
    return "0 menit";
  }

  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} menit`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours - days * 24);

  if (days === 0) {
    return `${remainingHours} jam`;
  }

  return `${days} hari${remainingHours ? ` ${remainingHours} jam` : ""}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp)
    .toLocaleString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(".", ":");
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp)
    .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    .replace(".", ":");
}
