'use client';

import React, { useState } from 'react';
import { MockEndpoint, MockInfraSpec } from '@/types';
import { Check, Copy, Play, Terminal } from 'lucide-react';

interface TerminalExplorerProps {
  mockInfra: MockInfraSpec;
}

export const TerminalExplorer: React.FC<TerminalExplorerProps> = ({ mockInfra }) => {
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [responseLog, setResponseLog] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const currentEndpoint: MockEndpoint =
    mockInfra.endpoints[selectedEndpointIndex] || mockInfra.endpoints[0];

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(mockInfra.curlExample);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleSimulate = () => {
    setSimulating(true);
    setResponseLog(null);
    setLatency(null);

    const randomLatency = Math.floor(Math.random() * 45) + 18;
    setTimeout(() => {
      setSimulating(false);
      setLatency(randomLatency);
      setResponseLog(JSON.stringify(currentEndpoint.responseSample, null, 2));
    }, 400);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20';
      case 'POST':
        return 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20';
      case 'PUT':
        return 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20';
      case 'DELETE':
        return 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20';
      default:
        return 'text-text-0 bg-card border border-line';
    }
  };

  return (
    <div className="rounded-radius border border-line bg-card/50 overflow-hidden font-mono text-[12px]">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-line">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brass" />
          <span className="font-semibold text-text-0 text-xs tracking-tight">
            Mock Infrastructure & Test Harness
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-1 hidden sm:inline">
            base: <code className="text-text-0">{mockInfra.baseUrl}</code>
          </span>
          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-radius border border-line bg-ink-0 text-text-0 hover:border-brass transition-colors cursor-pointer"
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
        </div>
      </div>

      {/* Endpoint Tabs */}
      <div role="tablist" aria-label="Mock infrastructure endpoints" className="flex border-b border-line overflow-x-auto bg-ink-0/40 px-2 pt-2">
        {mockInfra.endpoints.map((ep, idx) => {
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
              className={`flex items-center gap-2 px-3 py-1.5 text-xs border-t border-l border-r border-line -mb-[1px] rounded-t-radius cursor-pointer whitespace-nowrap transition-colors ${
                isSelected
                  ? 'bg-card text-text-0 font-semibold border-b-card'
                  : 'text-text-1 hover:text-text-0'
              }`}
            >
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold font-mono ${getMethodBadgeClass(ep.method)}`}
              >
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-text-1 max-w-2xl leading-relaxed">{currentEndpoint.description}</p>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="btn-brass text-xs py-1.5 px-3 self-start sm:self-auto cursor-pointer shrink-0"
          >
            <Play className={`w-3 h-3 ${simulating ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{simulating ? 'Calling mock endpoint...' : 'Ping Mock API'}</span>
          </button>
        </div>

        {/* Live Response Box */}
        <div
          aria-live="polite"
          className="relative bg-ink-0 p-3 border-t border-b border-line -mx-4"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-line text-xs text-text-1">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-diff-green" />
              <span>HTTP/1.1 200 OK</span>
            </span>
            {latency && (
              <span className="text-diff-green font-semibold">
                latency: {latency}ms (p95 within SLA)
              </span>
            )}
          </div>

          <pre className="overflow-x-auto text-xs leading-relaxed text-text-0">
            <code>
              {responseLog || JSON.stringify(currentEndpoint.responseSample, null, 2)}
            </code>
          </pre>
        </div>

        {/* Test Criteria */}
        {mockInfra.testCriteria && mockInfra.testCriteria.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-semibold text-text-1 mb-1.5">
              Verification Test Criteria (CI Gates):
            </div>
            <ul className="space-y-1 text-xs text-text-0 max-w-2xl">
              {mockInfra.testCriteria.map((crit, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-diff-green" aria-hidden="true">✓</span>
                  <span>{crit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
