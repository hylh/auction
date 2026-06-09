export function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

// Deterministic avatar colour from buyer name
const AVATAR_COLORS = ["#0d9488", "#2563eb", "#db2777", "#d97706", "#7c3aed", "#0891b2", "#16a34a"];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? "#0d9488";
}
