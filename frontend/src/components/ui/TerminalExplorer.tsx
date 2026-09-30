'use client';

import React, { useState } from 'react';
import { MockEndpoint, MockInfraSpec } from '@/types';
import { Check, Copy, Play, Terminal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeletons';

interface TerminalExplorerProps {
  mockInfra: MockInfraSpec;
}

export const TerminalExplorer: React.FC<TerminalExplorerProps> = ({ mockInfra }) => {
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [responseLog, setResponseLog] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [status, setStatus] = useState<{
    ok: boolean;
    code: number | null;
    label: string;
    detail?: string;
  } | null>(null);

  // Every field is optional in practice: a problem scraped from an external
  // report arrives with no mock server at all. Without this guard an empty
  // endpoints list resolves to undefined and reading .description off it takes
  // down the whole detail page.
  const endpoints = mockInfra?.endpoints ?? [];
  const testCriteria = mockInfra?.testCriteria ?? [];
  const hasInfra = Boolean(mockInfra?.baseUrl) && endpoints.length > 0;

  const currentEndpoint: MockEndpoint | undefined =
    endpoints[selectedEndpointIndex] ?? endpoints[0];

  const handleCopyCurl = () => {
    if (!mockInfra?.curlExample) return;
    navigator.clipboard.writeText(mockInfra.curlExample);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  /**
   * Issues a real request to the problem's mock server and reports what came
   * back.
   *
   * This used to make no request at all: it slept 400ms, generated a latency
   * with Math.random(), and printed the responseSample that had already been
   * shipped to the browser, then reported "HTTP/1.1 200 OK" and "p95 within
   * SLA" for a call that never happened. When no mock server is deployed the
   * failure is surfaced rather than papered over.
   */
  const handlePing = async () => {
    if (!currentEndpoint || !mockInfra?.baseUrl) return;
    setSimulating(true);
    setResponseLog(null);
    setLatency(null);
    setStatus(null);

    const url = `${mockInfra.baseUrl.replace(/\/$/, '')}${currentEndpoint.path}`;
    const startedAt = performance.now();

    try {
      const res = await fetch(url, {
        method: currentEndpoint.method === 'GET' ? 'GET' : 'POST',
        headers: { Accept: 'application/json' },
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const body = await res.text();

      setLatency(elapsed);
      setStatus({ ok: res.ok, code: res.status, label: res.statusText });
      try {
        setResponseLog(JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        setResponseLog(body);
      }
    } catch (err) {
      // A missing mock server is the expected state today: no fleet is
      // deployed. Say so rather than showing a synthetic 200.
      setStatus({
        ok: false,
        code: null,
        label: 'No response',
        detail:
          err instanceof Error && err.message
            ? err.message
            : 'The mock server could not be reached.',
      });
      setResponseLog(
        `Could not reach ${url}\n\n${mockInfra.baseUrl} is not currently serving. The example below is the documented shape, not a live response.`
      );
    } finally {
      setSimulating(false);
    }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-green-700 dark:text-green-400 font-semibold';
      case 'POST':
        return 'text-blue-700 dark:text-blue-400 font-semibold';
      case 'PUT':
        return 'text-amber-700 dark:text-amber-400 font-semibold';
      case 'DELETE':
        return 'text-rose-700 dark:text-rose-400 font-semibold';
      default:
        return 'text-text-0 font-semibold';
    }
  };

  return (
    <div className="rounded-radius border border-line bg-ink-0 overflow-hidden font-mono text-xs md:text-sm">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-line">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brass shrink-0" />
          <span className="font-semibold text-text-0 text-xs md:text-sm tracking-tight">
            Mock Infrastructure &amp; Problem Spec
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs md:text-sm text-text-1 hidden sm:inline">
            base: <code className="text-text-0">{mockInfra?.baseUrl || '—'}</code>
          </span>
          {mockInfra?.curlExample && (
            <button
              onClick={handleCopyCurl}
              className="flex items-center gap-1.5 px-2 py-1 text-xs md:text-sm text-text-1 hover:text-text-0 transition-colors cursor-pointer shrink-0"
            >
              {copiedCurl ? (
                <>
                  <Check className="w-3 h-3 text-diff-green" />
                  <span>copied cURL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>copy cURL</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!hasInfra ? (
        /* Honest empty state: this problem ships without a mock server, so say
           that rather than presenting an empty terminal as a working one. */
        <div className="p-6 sm:p-8 text-center space-y-2">
          <p className="text-xs md:text-sm text-text-0 font-medium">
            No mock infrastructure provided
          </p>
          <p className="text-xs md:text-sm text-text-1 max-w-md mx-auto leading-relaxed">
            This problem was published from a field report and ships without a
            mock specification. Read the problem statement and build against
            your own fixtures.
          </p>
        </div>
      ) : (
        <>
      {/* Endpoint Tabs */}
      <div role="tablist" aria-label="Mock infrastructure endpoints" className="flex border-b border-line overflow-x-auto px-2 pt-1 gap-1">
        {endpoints.map((ep, idx) => {
          const isSelected = idx === selectedEndpointIndex;
          return (
            <button
              key={ep.path}
              id={`endpoint-tab-${idx}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`endpoint-panel-${idx}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                setSelectedEndpointIndex(idx);
                setResponseLog(null);
                setLatency(null);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs md:text-sm font-mono cursor-pointer whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isSelected
                  ? 'border-text-0 text-text-0 font-medium'
                  : 'border-transparent text-text-1 hover:text-text-0'
              }`}
            >
              <span className={`text-xs md:text-sm font-mono ${getMethodBadgeClass(ep.method)}`}>
                {ep.method}
              </span>
              <span>{ep.path}</span>
            </button>
          );
        })}
      </div>

      {/* Endpoint Description & Actions */}
      <div
        id={`endpoint-panel-${selectedEndpointIndex}`}
        role="tabpanel"
        aria-labelledby={`endpoint-tab-${selectedEndpointIndex}`}
        className="p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm">
          <p style={{ maxWidth: '65ch' }} className="text-text-1 leading-relaxed">{currentEndpoint?.description}</p>
          <button
            onClick={() => void handlePing()}
            disabled={simulating}
            className="btn-brass text-xs md:text-sm py-1.5 px-3 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <Play className={`w-3 h-3 ${simulating ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{simulating ? 'Calling mock endpoint...' : 'Ping Mock API'}</span>
          </button>
        </div>

        {/* Live Response Box */}
        <div
          aria-live="polite"
          className="relative p-3 border-t border-line -mx-4"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-xs md:text-sm text-text-1">
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  simulating
                    ? 'bg-amber-500 animate-ping'
                    : status
                    ? status.ok
                      ? 'bg-diff-green'
                      : 'bg-rose-500'
                    : 'bg-text-1'
                }`}
              />
              <span>
                {simulating
                  ? 'REQUESTING...'
                  : status
                  ? status.code
                    ? `HTTP ${status.code} ${status.label}`
                    : status.label
                  : 'NOT YET REQUESTED'}
              </span>
            </span>
            {simulating ? (
              <span className="text-text-1 animate-pulse">measuring roundtrip...</span>
            ) : status?.ok && latency !== null ? (
              // Only ever a real measurement now. The "(p95 within SLA)" claim
              // was asserted on a randomised number with no percentile behind it.
              <span className="text-diff-green font-semibold">
                latency: {latency}ms
              </span>
            ) : status && !status.ok ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                no response
              </span>
            ) : null}
          </div>

          {simulating ? (
            <div className="space-y-2 py-2 px-1">
              <div className="flex items-center gap-2">
                <Skeleton variant="rectangular" className="h-3.5 w-20" />
                <Skeleton variant="rectangular" className="h-3.5 w-36" />
              </div>
              <div className="pl-4 space-y-1.5">
                <Skeleton variant="rectangular" className="h-3 w-48" />
                <Skeleton variant="rectangular" className="h-3 w-64" />
                <Skeleton variant="rectangular" className="h-3 w-40" />
              </div>
              <Skeleton variant="rectangular" className="h-3.5 w-12" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Before any request, this is the documented shape. Labelled as
                  such so it is never mistaken for a response. */}
              {responseLog === null && (
                <p className="text-[11px] text-text-1 italic">
                  Documented example response — not a live result. Press “Ping
                  Mock API” to send a real request.
                </p>
              )}
              <pre className="overflow-x-auto text-xs md:text-sm leading-relaxed text-text-0">
                <code>
                  {responseLog || JSON.stringify(currentEndpoint?.responseSample, null, 2)}
                </code>
              </pre>
            </div>
          )}
        </div>

        {/* Test Criteria */}
        {testCriteria.length > 0 && (
          <div className="pt-2">
            <div className="text-xs md:text-sm font-semibold text-text-1 mb-1.5">
              Test Criteria:
            </div>
            {/* These are prose written by the problem author. Nothing currently
                executes them: there is no runner, and a reviewer records the
                results by hand. The heading used to call them "CI Gates",
                which implied an automatic check that does not exist. */}
            <ul className="space-y-1 text-xs md:text-sm text-text-0 max-w-2xl">
              {testCriteria.map((crit, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-diff-green" aria-hidden="true">✓</span>
                  <span>{crit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
        </>
      )}
    </div>
  );
};
