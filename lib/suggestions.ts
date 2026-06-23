export function replaceLineRange(content: string, startLine: number, endLine: number, replacementText: string) {
  const lines = content.split("\n");
  const safeStart = Math.max(1, startLine);
  const safeEnd = Math.max(safeStart, endLine);
  const replacement = replacementText.length ? replacementText.split("\n") : [];

  lines.splice(safeStart - 1, safeEnd - safeStart + 1, ...replacement);
  return lines.join("\n");
}

export function countSearchMatches(content: string, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  return content.toLowerCase().split(needle).length - 1;
}
