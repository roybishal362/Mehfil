/** Parses JSON text, or returns undefined when it is not valid JSON (no JSON value is undefined). */
export function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}
