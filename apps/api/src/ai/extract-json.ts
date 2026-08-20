const JSON_ESCAPES: Record<number, string> = {
  0x08: "\\b",
  0x09: "\\t",
  0x0a: "\\n",
  0x0c: "\\f",
  0x0d: "\\r",
};

// AI responses occasionally embed a raw, unescaped control byte (most often
// a literal newline) inside a JSON string value instead of its two-character
// escape sequence -- illegal per the JSON spec, but not a structural error.
// This repairs exactly that, and only inside string literals: it tracks
// whether the scan is currently inside a JSON string (toggled on an
// unescaped `"`) and whether the current character is itself the target of
// a preceding backslash, so it never touches JSON's own structural
// whitespace or double-escapes an already-valid sequence.
function escapeRawControlChars(source: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of source) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      result += char;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    const code = char.charCodeAt(0);
    if (inString && code < 0x20) {
      result += JSON_ESCAPES[code] ?? `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    result += char;
  }

  return result;
}

function tryParse<T>(source: string): T | null {
  try {
    return JSON.parse(source) as T;
  } catch {
    // fall through -- retry once below after repairing raw control
    // characters, before giving up.
  }
  try {
    return JSON.parse(escapeRawControlChars(source)) as T;
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
