export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))].slice(0, 5).map((tag) => tag.slice(0, 30))
}
