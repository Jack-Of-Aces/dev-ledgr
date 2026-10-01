'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, AlertTriangle } from 'lucide-react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Preprocesses raw text from LLMs into clean Markdown before rendering:
 * 1. Combines isolated bullet symbols (•, -, *) followed by linebreaks.
 * 2. Converts tab-delimited tables into standard Markdown tables (| Col 1 | Col 2 |).
 * 3. Highlights Production Traps (Trap 1: ..., Production Trap: ...) into blockquotes.
 * 4. Ensures numeric headings (1. Heading, 2. Heading) format as distinct sections.
 */
function normalizeRawContent(raw: string): string {
  let s = raw;

  // 1. Merge isolated bullet characters on their own line with the next line:
  s = s.replace(/\n\s*([•*\\-])\s*\n\s*/g, '\n$1 ');

  // 2. Convert tab-delimited text blocks into standard markdown tables
  const lines = s.split('\n');
  const newLines: string[] = [];
  let tabTableBuffer: string[] = [];
  let inCodeBlock = false;

  const flushTabTable = () => {
    if (tabTableBuffer.length === 0) return;
    const cols = tabTableBuffer.map((r) => r.split('\t').map((c) => c.trim()));
    const maxCols = Math.max(...cols.map((c) => c.length));
    if (maxCols >= 2) {
      const header = cols[0];
      newLines.push(`| ${header.join(' | ')} |`);
      newLines.push(`| ${header.map(() => ':---').join(' | ')} |`);
      for (let r = 1; r < cols.length; r++) {
        // Pad row to match header length
        const row = cols[r];
        while (row.length < header.length) row.push('');
        newLines.push(`| ${row.join(' | ')} |`);
      }
    } else {
      newLines.push(...tabTableBuffer);
    }
    tabTableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (tabTableBuffer.length > 0) flushTabTable();
      inCodeBlock = !inCodeBlock;
      newLines.push(line);
      continue;
    }

    if (inCodeBlock) {
      newLines.push(line);
      continue;
    }

    // Check for tab-delimited data row
    if (line.includes('\t')) {
      tabTableBuffer.push(line);
    } else {
      if (tabTableBuffer.length > 0) {
        flushTabTable();
      }
      newLines.push(line);
    }
  }

  if (tabTableBuffer.length > 0) {
    flushTabTable();
  }

  s = newLines.join('\n');

  // 3. Highlight "Production Trap:" and "Trap N:" as callout blockquotes
  s = s.replace(/\n\s*(Production Trap:[^\n]+)/gi, '\n\n> **$1**\n');
  s = s.replace(/\n\s*(Trap \d+:[^\n]+)/gi, '\n\n> **$1**\n');

  // 4. Ensure numbered section headings (e.g., "1. First Principles:") have line breaks
  s = s.replace(/\n(\d+\.\s+[A-Z][^\n]+)/g, '\n\n### $1\n');

  return s;
}

/**
 * A robust, high-fidelity Markdown renderer designed specifically for
 * technical engineering prose, math formulas, code blocks with syntax headers,
 * tables, blockquotes, copy buttons, and nested lists.
 */
export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const normalized = normalizeRawContent(content);
  const parts: React.ReactNode[] = [];
  const lines = normalized.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  const flushTextBuffer = (keyPrefix: string) => {
    if (textBuffer.length === 0) return;
    const textBlock = textBuffer.join('\n');
    textBuffer = [];
    parts.push(
      <TextBlock key={`${keyPrefix}-${parts.length}`} rawText={textBlock} />
    );
  };

  const flushCodeBuffer = (keyPrefix: string) => {
    if (codeBuffer.length === 0 && !inCodeBlock) return;
    const code = codeBuffer.join('\n');
    const lang = codeLanguage;
    codeBuffer = [];
    codeLanguage = '';
    inCodeBlock = false;
    parts.push(
      <CodeBlock key={`${keyPrefix}-${parts.length}`} code={code} language={lang} />
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```([a-zA-Z0-9_-]*)/);

    if (fenceMatch) {
      if (inCodeBlock) {
        flushCodeBuffer(`code-${i}`);
      } else {
        flushTextBuffer(`text-${i}`);
        inCodeBlock = true;
        codeLanguage = fenceMatch[1] || 'text';
      }
    } else if (inCodeBlock) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCodeBlock) {
    flushCodeBuffer('code-end');
  } else {
    flushTextBuffer('text-end');
  }

  return <div className={`space-y-3.5 text-text-0 ${className}`}>{parts}</div>;
};

// --- Subcomponent: Code Block with Language Badge & Copy Button ---
const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded border border-line bg-ink-0 overflow-hidden my-3 shadow-xs font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-0/80 border-b border-line text-text-1 text-[11px]">
        <div className="flex items-center gap-1.5 uppercase font-semibold text-text-1">
          <Terminal className="w-3 h-3 text-emerald-text" />
          <span>{language || 'code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 hover:text-text-0 transition-colors cursor-pointer text-[11px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald" />
              <span className="text-emerald font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed text-text-0 text-xs">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// --- Subcomponent: Markdown Table Renderer ---
const TableBlock: React.FC<{ rawTable: string }> = ({ rawTable }) => {
  const lines = rawTable.trim().split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]);
  // Row 1 is divider (|:---|:---|), rows 2+ are data rows
  const dataRows = lines.slice(2).map(parseRow);

  return (
    <div className="my-3.5 overflow-x-auto rounded border border-line bg-ink-0/60 shadow-xs">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-line bg-card/60">
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="py-2.5 px-3 font-mono font-semibold text-text-0 uppercase text-[11px] tracking-wider"
              >
                {renderInlineFormatted(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-card/40 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2 px-3 text-text-0 leading-relaxed">
                  {renderInlineFormatted(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Subcomponent: Text Paragraphs, Math, Headers, Lists & Tables ---
const TextBlock: React.FC<{ rawText: string }> = ({ rawText }) => {
  const blocks = rawText.split(/\n\s*\n/);

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Display Math Block ($$...$$)
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
          const formula = trimmed.slice(2, -2).trim();
          return (
            <div
              key={idx}
              className="my-3 p-3.5 rounded border border-line bg-ink-0/80 overflow-x-auto text-center font-mono text-xs sm:text-sm text-emerald-text"
            >
              {cleanLatexDisplay(formula)}
            </div>
          );
        }

        // Markdown Table
        if (trimmed.startsWith('|') && trimmed.includes('|') && trimmed.split('\n').length >= 3) {
          return <TableBlock key={idx} rawTable={trimmed} />;
        }

        // Headers
        if (trimmed.startsWith('#### ')) {
          return (
            <h5
              key={idx}
              className="text-xs sm:text-sm font-bold font-mono text-text-0 pt-2 uppercase tracking-wider text-emerald-text"
            >
              {renderInlineFormatted(trimmed.slice(5))}
            </h5>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-sm sm:text-base font-bold text-text-0 pt-2.5 border-b border-line/40 pb-1"
            >
              {renderInlineFormatted(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base sm:text-lg font-bold text-text-0 pt-3">
              {renderInlineFormatted(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg sm:text-xl font-bold text-text-0 pt-3.5">
              {renderInlineFormatted(trimmed.slice(2))}
            </h2>
          );
        }

        // Blockquotes / Production Traps
        if (trimmed.startsWith('> ')) {
          const isTrap = trimmed.toLowerCase().includes('trap');
          return (
            <blockquote
              key={idx}
              className={`p-3 sm:p-3.5 rounded border-l-2 my-2.5 text-xs sm:text-sm leading-relaxed space-y-1 ${
                isTrap
                  ? 'bg-amber-500/10 border-amber-500 text-text-0'
                  : 'bg-ink-0/60 border-emerald text-text-1 italic'
              }`}
            >
              <div className="flex items-start gap-2">
                {isTrap && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                <div>{renderInlineFormatted(trimmed.replace(/^>\s*/gm, ''))}</div>
              </div>
            </blockquote>
          );
        }

        // Bullet Lists
        const isBulletList = trimmed.split('\n').every((l) => /^\s*[-*•]\s+/.test(l));
        if (isBulletList) {
          const items = trimmed.split('\n').map((l) => l.replace(/^\s*[-*•]\s+/, ''));
          return (
            <ul key={idx} className="space-y-1.5 my-2 pl-1 text-xs sm:text-sm">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <span className="text-emerald-text font-bold mt-0.5">•</span>
                  <span className="leading-relaxed flex-1">{renderInlineFormatted(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Numbered Lists
        const isNumberedList = trimmed.split('\n').every((l) => /^\s*\d+\.\s+/.test(l));
        if (isNumberedList) {
          const items = trimmed.split('\n').map((l) => {
            const num = l.match(/^\s*(\d+)\.\s+/)?.[1] || '';
            const text = l.replace(/^\s*\d+\.\s+/, '');
            return { num, text };
          });
          return (
            <ol key={idx} className="space-y-1.5 my-2 pl-1 text-xs sm:text-sm">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2">
                  <span className="text-emerald-text font-mono font-semibold text-xs mt-0.5 shrink-0">
                    {item.num}.
                  </span>
                  <span className="leading-relaxed flex-1">{renderInlineFormatted(item.text)}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Regular paragraph with potential embedded math formulas
        return (
          <p key={idx} className="text-xs sm:text-sm leading-relaxed text-text-0">
            {renderInlineFormatted(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

/**
 * Strips raw LaTeX markup and renders clean human-readable mathematical notations
 */
function cleanLatexDisplay(s: string): string {
  let res = s;
  res = res.replace(/\\text\{([^}]+)\}/g, '$1');
  res = res.replace(/\\mathbf\{([^}]+)\}/g, '$1');
  res = res.replace(/\\cdot/g, ' · ');
  res = res.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑($1 to $2)');
  res = res.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1) / ($2)');
  res = res.replace(/\\left\||\\right\||\\\|/g, '‖');
  res = res.replace(/\\le\b|\\leq\b/g, '≤');
  res = res.replace(/\\ge\b|\\geq\b/g, '≥');
  res = res.replace(/\\infty\b/g, '∞');
  res = res.replace(/\\_/g, '_');
  return res;
}

/**
 * Format inline elements: math ($...$, or unescaped LaTeX), code (`...`), bold (**...**), and italic (*...*)
 */
function renderInlineFormatted(text: string): React.ReactNode {
  // 1. Detect and render display math $$...$$
  const displayMathParts = text.split(/(\$\$[^$]+\$\$)/g);

  return displayMathParts.map((dmPart, dmIdx) => {
    if (dmPart.startsWith('$$') && dmPart.endsWith('$$') && dmPart.length >= 4) {
      return (
        <span
          key={dmIdx}
          className="my-1.5 px-2.5 py-1 rounded bg-ink-0 border border-line text-emerald-text font-mono text-[11px] sm:text-xs inline-block font-semibold"
        >
          {cleanLatexDisplay(dmPart.slice(2, -2).trim())}
        </span>
      );
    }

    // 2. Detect inline math $...$
    const inlineMathParts = dmPart.split(/(\$[^$\n]+\$)/g);

    return inlineMathParts.map((imPart, imIdx) => {
      if (imPart.startsWith('$') && imPart.endsWith('$') && imPart.length > 2) {
        return (
          <span
            key={`${dmIdx}-${imIdx}`}
            className="px-1.5 py-0.5 rounded bg-ink-0 border border-line/60 font-mono text-[11px] sm:text-xs text-emerald-text font-medium inline-block"
          >
            {cleanLatexDisplay(imPart.slice(1, -1))}
          </span>
        );
      }

      // 3. Detect un-delimited LaTeX equations like \text{cosine_similarity}...
      const unescapedMathRegex = /(\\text\{[^}]+\}[^,.\n]+)/g;
      const rawMathParts = imPart.split(unescapedMathRegex);

      return rawMathParts.map((rmPart, rmIdx) => {
        if (rmPart.startsWith('\\text{') && rmPart.length > 10) {
          return (
            <span
              key={`${dmIdx}-${imIdx}-${rmIdx}`}
              className="my-1 px-2 py-0.5 rounded bg-ink-0 border border-line text-emerald-text font-mono text-[11px] sm:text-xs inline-block"
            >
              {cleanLatexDisplay(rmPart)}
            </span>
          );
        }

        // 4. Split on inline code `...`
        const codeParts = rmPart.split(/(`[^`]+`)/g);

        return codeParts.map((part, pIdx) => {
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
              <code
                key={`${dmIdx}-${imIdx}-${rmIdx}-${pIdx}`}
                className="px-1.5 py-0.5 rounded bg-ink-0 border border-line text-emerald-text font-mono text-[11px] sm:text-xs"
              >
                {part.slice(1, -1)}
              </code>
            );
          }

          // 5. Process bold (**...**) and italic (*...*)
          const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
          return (
            <span key={`${dmIdx}-${imIdx}-${rmIdx}-${pIdx}`}>
              {boldParts.map((bPart, bIdx) => {
                if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
                  return (
                    <strong key={bIdx} className="font-semibold text-text-0">
                      {bPart.slice(2, -2)}
                    </strong>
                  );
                }
                return bPart;
              })}
            </span>
          );
        });
      });
    });
  });
}
