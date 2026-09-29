'use client';

/**
 * @file JobDescription.tsx
 * @description Renders a job description with its structure intact.
 *
 * Descriptions are scraped, so they arrive as plain text with the layout the
 * original posting had: a heading per section, one logical paragraph or
 * requirement per line, blank lines between sections, and a lot of trailing
 * whitespace from the source HTML.
 *
 * Rendering that into a single element is what made the job pages look
 * unfinished. Every newline collapses to a space in HTML, so 2,300 characters
 * of sectioned posting became one unbroken wall of text with "Your Key
 * Responsibilities" and "To qualify for the role, you must have" buried in the
 * middle of a sentence.
 */

import React from 'react';

export type DescriptionBlock = {
  kind: 'heading' | 'para';
  text: string;
};

// A line this long or shorter, with no sentence-ending punctuation and few
// words, is a section label rather than prose. Tuned against the live
// descriptions: "Your Key Responsibilities" and "To qualify for the role, you
// must have" are headings, while a short requirement like "Strong skills in
// Python." is not, because it ends in a full stop.
const HEADING_MAX_CHARS = 90;
const HEADING_MAX_WORDS = 12;

/**
 * Splits a raw description into displayable blocks.
 *
 * Splitting is per line rather than per blank-line paragraph because the
 * scraper pre-wraps: each logical paragraph is already a single line, and the
 * requirement lists that follow a heading are one item per line with no blank
 * lines between them. Grouping on blank lines alone would fuse a heading and
 * its twelve requirements into a single unreadable block.
 */
export function parseJobDescription(raw: string | undefined | null): DescriptionBlock[] {
  if (!raw) return [];

  const blocks: DescriptionBlock[] = [];

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    // Collapse the runs of spaces the source HTML leaves behind, and drop the
    // lines that are nothing but whitespace.
    const text = line.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const words = text.split(' ').length;
    const isHeading =
      text.length <= HEADING_MAX_CHARS &&
      words <= HEADING_MAX_WORDS &&
      !/[.!?:;]$/.test(text);

    blocks.push({ kind: isHeading ? 'heading' : 'para', text });
  }

  return blocks;
}

export function JobDescription({
  description,
  className = '',
}: {
  description: string | undefined | null;
  className?: string;
}) {
  const blocks = parseJobDescription(description);

  if (blocks.length === 0) {
    return <p className={`text-text-1 italic ${className}`}>No description provided.</p>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <h3
            key={i}
            className="text-sm font-semibold text-text-0 font-sans tracking-tight pt-2 first:pt-0"
          >
            {block.text}
          </h3>
        ) : (
          <p key={i} className="leading-relaxed text-text-1">
            {block.text}
          </p>
        )
      )}
    </div>
  );
}
