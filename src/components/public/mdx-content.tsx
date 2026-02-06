import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface MdxContentProps {
  fileName: string;
}

/**
 * Renders a markdown file from the content/ directory as HTML.
 * Simple markdown rendering without full MDX compilation for static content.
 */
export async function MdxContent({ fileName }: MdxContentProps) {
  const filePath = join(process.cwd(), "content", fileName);
  const raw = await readFile(filePath, "utf-8");

  // Simple markdown to HTML conversion for static policy pages
  const lines = raw.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      html.push(`<h1 class="text-3xl font-bold mt-8 mb-4">${escapeHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2 class="text-xl font-semibold mt-6 mb-3">${escapeHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      html.push(`<h3 class="text-lg font-medium mt-4 mb-2">${escapeHtml(trimmed.slice(4))}</h3>`);
    }
    // Lists
    else if (trimmed.startsWith("- ")) {
      if (!inList) {
        html.push('<ul class="list-disc pl-6 space-y-1">');
        inList = true;
      }
      html.push(`<li>${processInline(trimmed.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        html.push('<ol class="list-decimal pl-6 space-y-1">');
        inList = true;
      }
      html.push(`<li>${processInline(trimmed.replace(/^\d+\.\s/, ""))}</li>`);
    }
    // Italic (e.g., _Last updated: ..._)
    else if (trimmed.startsWith("_") && trimmed.endsWith("_")) {
      html.push(`<p class="text-sm text-zinc-500 italic mb-4">${escapeHtml(trimmed.slice(1, -1))}</p>`);
    }
    // Paragraph
    else {
      html.push(`<p class="mb-3">${processInline(trimmed)}</p>`);
    }
  }

  if (inList) html.push("</ul>");

  return (
    <div
      className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300"
      dangerouslySetInnerHTML={{ __html: html.join("\n") }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function processInline(text: string): string {
  let result = escapeHtml(text);
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="underline hover:text-zinc-900 dark:hover:text-zinc-50">$1</a>',
  );
  return result;
}
