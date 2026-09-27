/** Task extraction is opt-in through an explicit command in the note. */
export function requestsTaskGeneration(text: string): boolean {
  return text.split(/[.!?\n]/).some((sentence) =>
    /\bgenerate\s+(?:a\s+)?tasks?\b/i.test(sentence)
    && !/\b(?:don['’]t|do\s+not|never|not\s+to)\s+(?:automatically\s+)?generate\s+(?:a\s+)?tasks?\b/i.test(sentence),
  )
}
