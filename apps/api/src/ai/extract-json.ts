export function extractJson<T = unknown>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : raw;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    return JSON.parse(source.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
