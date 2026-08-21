import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

const LIST_ITEM = /^[-*] |^\d+\. /;

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,3}) (.*)/.exec(line);

    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
      const classes =
        level === 1
          ? "font-display text-xl font-bold text-ink mt-4 first:mt-0"
          : level === 2
            ? "font-display text-lg font-bold text-ink mt-4 first:mt-0"
            : "font-display text-base font-bold text-ink mt-4 first:mt-0";
      blocks.push(
        <Tag key={key++} className={classes}>
          {renderInline(heading[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\d+\. / : /^[-*] /, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 font-body text-[13px] text-ink`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3} |[-*] |\d+\. )/.test(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="font-body text-[13px] text-ink-muted">
        {renderInline(paragraphLines.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}
