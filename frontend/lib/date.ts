export function formatFullDateTime(timestampStr: string): string {
  if (!timestampStr) {
    return "N/A";
  }

  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) {
      return timestampStr;
    }

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return timestampStr;
  }
}

export function formatRelativeTime(timestampStr: string): string {
  if (!timestampStr) return "Unknown";
  try {
    const date = new Date(timestampStr);
    
    if (isNaN(date.getTime())) return timestampStr;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestampStr;
  }
}
