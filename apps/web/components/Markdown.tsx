'use client';

// Minimal, dependency-free, XSS-safe markdown renderer for LLM/knowledge-base
// output. We escape all HTML first, then apply a small, fixed set of markdown
// rules — so model output can never inject markup.
import React from 'react';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline">$1</a>');
}

function render(md: string): string {
  const lines = escapeHtml(md.replace(/\r\n/g, '\n')).split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let inCode = false;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line.trim())) {
      closeList();
      if (!inCode) {
        out.push('<pre class="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs"><code>');
        inCode = true;
      } else {
        out.push('</code></pre>');
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      out.push(line + '\n');
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      const size = ['text-xl', 'text-lg', 'text-base', 'text-sm'][lvl - 1];
      out.push(`<h${lvl} class="mt-3 mb-1 font-semibold ${size}">${inline(h[2])}</h${lvl}>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        out.push(`<${want} class="my-1 ml-5 list-outside ${want === 'ul' ? 'list-disc' : 'list-decimal'} space-y-0.5">`);
        list = want;
      }
      out.push(`<li>${inline((ul ? ul[1] : ol![1]))}</li>`);
      continue;
    }
    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) {
      closeList();
      out.push(`<blockquote class="border-l-2 border-border pl-3 text-muted">${inline(bq[1])}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    closeList();
    out.push(`<p class="my-1 leading-relaxed">${inline(line)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return <div className={`text-sm ${className}`} dangerouslySetInnerHTML={{ __html: render(children || '') }} />;
}
