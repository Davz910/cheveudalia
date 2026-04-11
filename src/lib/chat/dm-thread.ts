/** UUID déterministe pour un fil DM entre deux membres (cohérent avec chat_dm_threads.member_a < member_b). */

export function sortMemberPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) < 0 ? [a, b] : [b, a];
}

export async function dmThreadIdForPair(memberA: string, memberB: string): Promise<string> {
  const [low, high] = sortMemberPair(memberA, memberB);
  const enc = new TextEncoder().encode(`cheveudalia:dm:${low}:${high}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
