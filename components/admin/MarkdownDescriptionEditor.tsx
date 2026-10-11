"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  RemoveFormatting,
  Strikethrough,
} from "lucide-react";

interface MarkdownDescriptionEditorProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: (element: HTMLTextAreaElement | null) => void;
  invalid: boolean;
}

const toolbarButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-[#2A2A2A] px-2 text-muted-foreground transition-colors hover:border-blue-500/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none";

type TextTransform = (selected: string) => string;

export function MarkdownDescriptionEditor({
  id,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
  invalid,
}: MarkdownDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replaceRange = (
    start: number,
    end: number,
    replacement: string,
    selectionStart = start + replacement.length,
    selectionEnd = selectionStart,
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const formatSelection = (transform: TextTransform) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = transform(selected);
    const innerStart = replacement.indexOf(selected);
    replaceRange(
      start,
      end,
      replacement,
      start + (innerStart < 0 ? replacement.length : innerStart),
      start + (innerStart < 0 ? replacement.length : innerStart + selected.length),
    );
  };

  const formatLines = (transform: (lines: string[]) => string[]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextNewline = value.indexOf("\n", selectionEnd);
    const end = nextNewline < 0 ? value.length : nextNewline;
    const replacement = transform(value.slice(start, end).split("\n")).join("\n");
    replaceRange(start, end, replacement, start + replacement.length);
  };

  const prefixLines = (prefix: string) =>
    formatLines((lines) =>
      lines.map((line) => (line.trim() ? `${prefix}${line}` : line)),
    );

  const numberLines = () => {
    let number = 1;
    formatLines((lines) =>
      lines.map((line) =>
        line.trim() ? `${number++}. ${line}` : line,
      ),
    );
  };

  const insertAlignment = (alignment: "left" | "center" | "right") =>
    formatLines((lines) => [
      `:::align-${alignment}`,
      ...lines,
      ":::",
    ]);

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = value.slice(textarea.selectionStart, textarea.selectionEnd);
    const url = window.prompt("Enter the link URL", "https://");
    if (!url) return;
    const safeUrl = url.trim();
    const label = selected || "link text";
    formatSelection(() => `[${label}](${safeUrl})`);
  };

  const clearFormatting = () => {
    const markdown = value
      .replace(/^:::align-(?:left|center|right)\s*$/gm, "")
      .replace(/^:::\s*$/gm, "")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
      .replace(/(\*\*|__|~~|\*|_)(.*?)\1/g, "$2")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/^\s*[-*_]{3,}\s*$/gm, "");
    replaceRange(0, value.length, markdown, markdown.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;

    if (event.key === "Tab") {
      event.preventDefault();
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const nextNewline = value.indexOf("\n", selectionEnd);
      const end = nextNewline < 0 ? value.length : nextNewline;
      const lines = value.slice(start, end).split("\n");
      const updatedLines = event.shiftKey
        ? lines.map((line) => line.replace(/^(?: {1,2}|\t)/, ""))
        : lines.map((line) => `  ${line}`);
      const replacement = updatedLines.join("\n");
      const removed = event.shiftKey
        ? lines.reduce(
            (count, line, index) =>
              count +
              (line.length - (updatedLines[index]?.length ?? line.length)),
            0,
          )
        : 0;
      replaceRange(
        start,
        end,
        replacement,
        Math.max(start, selectionStart + (event.shiftKey ? -removed : 2)),
        Math.max(start, selectionEnd + (event.shiftKey ? -removed : 2)),
      );
      return;
    }

    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const lineStart = value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const lineEndIndex = value.indexOf("\n", textarea.selectionStart);
    const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
    const line = value.slice(lineStart, lineEnd);
    const markerMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!markerMatch) return;

    event.preventDefault();
    const indent = markerMatch[1] ?? "";
    const marker = markerMatch[2] ?? "-";
    const cursorInLine = textarea.selectionStart - lineStart;
    const contentStart = indent.length + marker.length + 1;
    const currentContentBeforeCursor = line.slice(contentStart, cursorInLine).trim();
    const currentContentAfterCursor = line.slice(cursorInLine).trim();

    if (!currentContentBeforeCursor && !currentContentAfterCursor && textarea.selectionStart === textarea.selectionEnd) {
      replaceRange(
        lineStart,
        lineEnd,
        indent,
        lineStart + indent.length,
      );
      return;
    }

    const nextMarker = /^\d+\.$/.test(marker)
      ? `${Number.parseInt(marker, 10) + 1}.`
      : marker;
    const continuation = `\n${indent}${nextMarker} `;
    replaceRange(
      textarea.selectionStart,
      textarea.selectionEnd,
      continuation,
      textarea.selectionStart + continuation.length,
    );
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#151515] focus-within:border-blue-500/60">
      <div
        role="toolbar"
        aria-label="Description formatting"
        className="flex flex-wrap items-center gap-1 border-b border-[#2A2A2A] p-2"
      >
        <button type="button" className={toolbarButtonClass} aria-label="Bold" title="Bold" onClick={() => formatSelection((text) => `**${text || "bold text"}**`)}>
          <Bold aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Italic" title="Italic" onClick={() => formatSelection((text) => `*${text || "italic text"}*`)}>
          <Italic aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Strikethrough" title="Strikethrough" onClick={() => formatSelection((text) => `~~${text || "strikethrough"}~~`)}>
          <Strikethrough aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Heading 2" title="Heading 2" onClick={() => prefixLines("## ")}>
          <Heading2 aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Heading 3" title="Heading 3" onClick={() => prefixLines("### ")}>
          <Heading3 aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Bullet list" title="Bullet list" onClick={() => prefixLines("- ")}>
          <List aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Numbered list" title="Numbered list" onClick={numberLines}>
          <ListOrdered aria-hidden className="size-4" />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-[#2A2A2A]" />
        <button type="button" className={toolbarButtonClass} aria-label="Align left" title="Align left" onClick={() => insertAlignment("left")}>
          <AlignLeft aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Align center" title="Align center" onClick={() => insertAlignment("center")}>
          <AlignCenter aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Align right" title="Align right" onClick={() => insertAlignment("right")}>
          <AlignRight aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Insert link" title="Insert link" onClick={insertLink}>
          <Link2 aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Horizontal divider" title="Horizontal divider" onClick={() => formatLines((lines) => [...lines, "---"])}>
          <Minus aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Blockquote" title="Blockquote" onClick={() => prefixLines("> ")}>
          <Quote aria-hidden className="size-4" />
        </button>
        <button type="button" className={toolbarButtonClass} aria-label="Clear formatting" title="Clear formatting" onClick={clearFormatting}>
          <RemoveFormatting aria-hidden className="size-4" />
        </button>
      </div>
      <textarea
        ref={(element) => {
          textareaRef.current = element;
          inputRef(element);
        }}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        rows={8}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        placeholder={"Add product details…\n\n## Fabric & fit\n- Soft, breathable cotton\n- Easy-care finish"}
        className="min-h-44 w-full resize-y bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />
      <p id={`${id}-help`} className="border-t border-[#2A2A2A] px-4 py-2 text-[10px] text-muted-foreground">
        Markdown: headings, bold, italic, links, lists, quotes, and alignment. Tab indents list lines; Enter continues lists.
      </p>
    </div>
  );
}
