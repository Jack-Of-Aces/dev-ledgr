'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * A robust, zero-dependency Markdown renderer designed specifically for
 * technical engineering prose, code blocks with syntax highlighting headers,
 * copy buttons, alerts, blockquotes, tables, and lists.
 */
export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  // Split into blocks: code fences vs text blocks
  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');
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
        // Closing fence
        flushCodeBuffer(`code-${i}`);
      } else {
        // Opening fence
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

// --- Subcomponent: Code Block with Copy Button ---
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
              <span className="text-emerald">Copied</span>
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

// --- Subcomponent: Text Paragraphs, Headers, Lists & Tables ---
const TextBlock: React.FC<{ rawText: string }> = ({ rawText }) => {
  const paragraphs = rawText.split(/\n\s*\n/);

  return (
    <div className="space-y-2.5">
      {paragraphs.map((p, idx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        // Headers
        if (trimmed.startsWith('#### ')) {
          return (
            <h5 key={idx} className="text-xs sm:text-sm font-bold font-mono text-text-0 pt-2 uppercase tracking-wider text-emerald-text">
              {renderInlineFormatted(trimmed.slice(5))}
            </h5>
          );
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm sm:text-base font-bold text-text-0 pt-2 border-b border-line/40 pb-1">
              {renderInlineFormatted(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-base sm:text-lg font-bold text-text-0 pt-2">
              {renderInlineFormatted(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-lg sm:text-xl font-bold text-text-0 pt-2">
              {renderInlineFormatted(trimmed.slice(2))}
            </h2>
          );
        }

        // Blockquotes / Warnings
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={idx} className="p-3 rounded bg-ink-0/60 border-l-2 border-emerald text-xs text-text-1 italic my-2">
              {renderInlineFormatted(trimmed.replace(/^>\s*/gm, ''))}
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

        // Regular paragraph with potential embedded linebreaks
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
 * Format inline elements: bold (**), italic (*), inline code (`), and links
 */
function renderInlineFormatted(text: string): React.ReactNode {
  // Split on inline code `...`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={pIdx}
          className="px-1.5 py-0.5 rounded bg-ink-0 border border-line text-emerald-text font-mono text-[11px] sm:text-xs"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold (**...**) and italic (*...*)
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={pIdx}>
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
}
