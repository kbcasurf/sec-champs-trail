function tryParse<T>(source: string): T | null {
  try {
    return JSON.parse(source) as T;
  } catch {
    return null;
  }
}

function braceSlice(source: string): string | null {
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return source.slice(start, end + 1);
}

export function extractJson<T = unknown>(raw: string): T | null {
  // 1. Bare JSON, no fence, no prose.
  const direct = tryParse<T>(raw);
  if (direct !== null) return direct;

  // 2. JSON surrounded by prose (with or without a fence) -- slice the whole raw
  //    string from its first "{" to its last "}". This finds the true payload
  //    boundaries even when a ```json fence wraps it, and is immune to fence
  //    markers that appear INSIDE the JSON's own string values, since those
  //    inner fences are just ordinary characters to a brace search.
  const wholeSlice = braceSlice(raw);
  if (wholeSlice) {
    const parsed = tryParse<T>(wholeSlice);
    if (parsed !== null) return parsed;
  }

  // 3. Last resort: extract a fenced code block with a GREEDY match, so it
  //    captures the OUTERMOST fence pair rather than the first inner one.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*)```/i);
  if (fenced) {
    const fencedSlice = braceSlice(fenced[1]);
    if (fencedSlice) {
      const parsed = tryParse<T>(fencedSlice);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}
