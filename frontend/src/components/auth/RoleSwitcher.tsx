/**
 * @file RoleSwitcher.tsx
 * @description Floating dev toolbar widget for rapid persona switching and connection inspection.
 * Allows instant verification of both regular developer and admin capabilities.
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { envConfig } from '@/lib/config';
import { Shield, User, ChevronUp, ChevronDown, Check } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { user, role, switchRole, isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-3 right-3 z-50 font-mono text-xs">
      <div className="rounded-radius border border-line bg-card shadow-md overflow-hidden">
        {/* Toggle Bar */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-ink-1 text-text-0 text-xs"
          aria-expanded={open}
          aria-label="Toggle Developer Sandbox Persona Bar"
        >
          <span className="w-2 h-2 rounded-full bg-text-0" />
          <span className="font-semibold">
            {role === 'admin' ? 'Admin Mode' : 'User Mode'}
          </span>
          <span className="text-text-1">(@{user.username})</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>

        {/* Dropdown Options */}
        {open && (
          <div className="p-3 border-t border-line space-y-2.5 min-w-64">
            <div className="flex items-center justify-between text-xs text-text-1 uppercase tracking-wider font-semibold">
              <span>Switch Persona</span>
              <span className="text-text-0">
                {envConfig.useMocks ? 'Mock Engine' : 'Live Gateway'}
              </span>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => {
                  switchRole('user');
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded text-left cursor-pointer transition-colors ${
                  role === 'user'
                    ? 'bg-ink-1 text-text-0 border border-line'
                    : 'text-text-1 hover:bg-ink-1/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-text-1" />
                  <div>
                    <div className="font-medium text-xs text-text-0">@junior_dev</div>
                    <div className="text-xs text-text-1">Developer (User)</div>
                  </div>
                </div>
                {role === 'user' && <Check className="w-3.5 h-3.5 text-text-0" />}
              </button>

              <button
                onClick={() => {
                  switchRole('admin');
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded text-left cursor-pointer transition-colors ${
                  role === 'admin'
                    ? 'bg-ink-1 text-text-0 border border-line'
                    : 'text-text-1 hover:bg-ink-1/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-text-0" />
                  <div>
                    <div className="font-medium text-xs text-text-0">@lead_auditor</div>
                    <div className="text-xs text-text-1 font-normal">Platform Auditor (Admin)</div>
                  </div>
                </div>
                {role === 'admin' && <Check className="w-3.5 h-3.5 text-text-0" />}
              </button>
            </div>

            <div className="pt-2 border-t border-line text-xs text-text-1 flex items-center justify-between">
              <span>Status: {isLoggedIn ? 'Session Active' : 'Guest'}</span>
              <a href="/login" className="hover:underline text-text-0">
                Login Page →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
