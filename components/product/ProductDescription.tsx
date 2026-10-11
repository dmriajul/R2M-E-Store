import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Alignment = "left" | "center" | "right";

const INLINE_MARKDOWN = /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g;

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(\/|#|\?)/.test(trimmed) && !trimmed.startsWith("//")) return trimmed;
  return null;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE_MARKDOWN).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {renderInline(part.slice(2, -2), key)}
        </strong>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={key}>{renderInline(part.slice(2, -2), key)}</del>;
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const label = link[1] ?? "";
      const href = safeHref(link[2] ?? "");
      return href ? (
        <a
          key={key}
          href={href}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          rel={/^https?:\/\//i.test(href) ? "noreferrer" : undefined}
          target={/^https?:\/\//i.test(href) ? "_blank" : undefined}
        >
          {renderInline(label, key)}
        </a>
      ) : (
        label
      );
    }

    return part;
  });
}

function lineIndent(line: string): number {
  const whitespace = line.match(/^[\t ]*/)?.[0] ?? "";
  return whitespace.replace(/\t/g, "  ").length;
}

function listMarker(line: string) {
  const match = line.match(/^([\t ]*)([-*+]|\d+\.)\s+(.*)$/);
  const indentValue = match?.[1];
  const marker = match?.[2];
  const content = match?.[3];
  if (indentValue === undefined || marker === undefined || content === undefined) {
    return null;
  }
  return {
    indent: indentValue.replace(/\t/g, "  ").length,
    ordered: /^\d+\.$/.test(marker),
    number: Number.parseInt(marker, 10),
    content,
  };
}

function renderList(
  lines: string[],
  start: number,
  keyPrefix: string,
): { node: ReactNode; nextIndex: number } {
  const firstMarker = listMarker(lines[start] ?? "");
  if (!firstMarker) return { node: null, nextIndex: start + 1 };

  const items: ReactNode[] = [];
  const baseIndent = firstMarker.indent;
  let currentLines: string[] = [];
  let currentIndex = start;
  let index = start;

  const flushItem = () => {
    if (currentLines.length === 0) return;
    items.push(
      <li key={`${keyPrefix}-item-${currentIndex}`} className="pl-1">
        {renderBlocks(currentLines, `${keyPrefix}-item-${currentIndex}`)}
      </li>,
    );
    currentLines = [];
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const marker = listMarker(line);
    const indent = lineIndent(line);

    if (marker && marker.indent === baseIndent) {
      if (marker.ordered !== firstMarker.ordered) break;
      flushItem();
      currentIndex = index;
      currentLines = [marker.content];
      index += 1;
      continue;
    }

    if (line.trim() && indent > baseIndent) {
      if (currentLines.length === 0) break;
      currentLines.push(line.slice(Math.min(line.length, baseIndent + 2)));
      index += 1;
      continue;
    }

    if (!line.trim() && index + 1 < lines.length && lineIndent(lines[index + 1] ?? "") > baseIndent) {
      currentLines.push("");
      index += 1;
      continue;
    }
    break;
  }

  flushItem();
  const ListTag = firstMarker.ordered ? "ol" : "ul";
  const listClass = firstMarker.ordered
    ? "my-3 list-decimal space-y-1.5 pl-5 marker:text-primary"
    : "my-3 list-disc space-y-1.5 pl-5 marker:text-primary";

  return {
    node: (
      <ListTag
        key={`${keyPrefix}-list-${start}`}
        start={firstMarker.ordered ? firstMarker.number : undefined}
        className={listClass}
      >
        {items}
      </ListTag>
    ),
    nextIndex: index,
  };
}

function renderBlocks(lines: string[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }

    const alignmentMatch = line.match(/^:::align-(left|center|right)$/);
    if (alignmentMatch) {
      const alignment = alignmentMatch[1] as Alignment;
      const closingIndex = lines.indexOf(":::", index + 1);
      const contentEnd = closingIndex < 0 ? lines.length : closingIndex;
      const alignmentClass = {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      }[alignment];
      nodes.push(
        <div key={`${keyPrefix}-${index}`} className={alignmentClass}>
          {renderBlocks(lines.slice(index + 1, contentEnd), `${keyPrefix}-${index}`)}
        </div>,
      );
      index = closingIndex < 0 ? lines.length : closingIndex + 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      nodes.push(
        <hr key={`${keyPrefix}-${index}`} className="my-5 border-glass-border" />,
      );
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]?.trim() ?? "")) {
        quoteLines.push((lines[index]?.trim() ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote
          key={`${keyPrefix}-quote-${index}`}
          className="my-4 border-l-2 border-primary/60 pl-4 italic text-foreground/80"
        >
          {renderBlocks(quoteLines, `${keyPrefix}-quote-${index}`)}
        </blockquote>,
      );
      continue;
    }

    const marker = listMarker(lines[index] ?? "");
    if (marker) {
      const list = renderList(lines, index, keyPrefix);
      nodes.push(list.node);
      index = list.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(##|###)\s+(.+)$/);
    const headingLevel = headingMatch?.[1];
    const headingText = headingMatch?.[2];
    if (headingLevel && headingText) {
      const Heading = headingLevel === "##" ? "h2" : "h3";
      nodes.push(
        <Heading
          key={`${keyPrefix}-${index}`}
          className={
            Heading === "h2"
              ? "mt-5 text-lg font-semibold tracking-tight text-foreground first:mt-0"
              : "mt-4 text-base font-semibold tracking-tight text-foreground first:mt-0"
          }
        >
          {renderInline(headingText, `${keyPrefix}-${index}`)}
        </Heading>,
      );
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index]?.trim() ?? "";
      if (
        !nextLine ||
        /^(#{2,3})\s+/.test(nextLine) ||
        /^(?:[-*+]|\d+\.)\s+/.test(nextLine) ||
        /^>\s?/.test(nextLine) ||
        /^(?:-{3,}|\*{3,}|_{3,})$/.test(nextLine) ||
        /^:::align-(left|center|right)$/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    nodes.push(
      <p key={`${keyPrefix}-${index}`} className="my-3 first:mt-0 last:mb-0">
        {paragraphLines.map((paragraphLine, lineIndex) => (
          <span key={`${keyPrefix}-${index}-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {renderInline(paragraphLine, `${keyPrefix}-${index}-${lineIndex}`)}
          </span>
        ))}
      </p>,
    );
  }

  return nodes;
}

export function ProductDescription({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prose-kids", className)}>
      {renderBlocks(children.split(/\r?\n/), "description")}
    </div>
  );
}
