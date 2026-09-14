/**
 * SHARE LINK MODAL
 *
 * Modal do generowania/zarządzania linkiem dołączającym do workspace'a.
 * Grant zawsze na cały workspace — board_id (jeśli podany) jest tylko
 * metadaną do przekierowania po dołączeniu, nie zawęża dostępu.
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Copy, Check, X, RefreshCw, Ban, AlertCircle } from 'lucide-react';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { DashboardButton } from '@/app/(dashboard)/dashboard/Components/DashboardButton';
import { createShareLink, refreshShareLink, revokeShareLink } from '../api/shareLinkApi';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  workspaceName?: string;
  boardId?: number;
  boardName?: string;
}

export function ShareLinkModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  boardId,
  boardName,
}: ShareLinkModalProps) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'revoked' | 'error'>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('loading');
    setError('');
    createShareLink(workspaceId, boardId)
      .then((result) => {
        setToken(result.token);
        setStatus('ready');
      })
      .catch((err: any) => {
        setError(err.message || 'Nie udało się wygenerować linku');
        setStatus('error');
      });
  }, [isOpen, workspaceId, boardId]);

  const modalRef = useRef<HTMLDivElement>(null);

  useModal({
    isOpen,
    onClose,
    modalRef,
    preventCloseWhen: () => busy,
  });

  const shareUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${token}`
    : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const result = await refreshShareLink(workspaceId, boardId);
      setToken(result.token);
      setStatus('ready');
    } catch (err: any) {
      setError(err.message || 'Nie udało się odświeżyć linku');
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await revokeShareLink(workspaceId, token);
      setToken(null);
      setStatus('revoked');
    } catch (err: any) {
      setError(err.message || 'Nie udało się unieważnić linku');
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="dashboard-modal-overlay" onClick={onClose}>
      <div
        className="dashboard-modal-surface max-w-md"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--dash-hover)] p-2">
              <Link2 size={22} className="text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Udostępnij</h2>
              <p className="mt-1 text-sm text-gray-600">
                {boardName ? `Tablica: ${boardName}` : `Przestrzeń: ${workspaceName}`}
              </p>
            </div>
          </div>
          <DashboardButton
            variant="secondary"
            onClick={onClose}
            className="h-9 w-9 rounded-full p-0"
          >
            <X size={20} />
          </DashboardButton>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600">
            Każdy, kto otworzy ten link, uzyska dostęp do całej przestrzeni{' '}
            {workspaceName ? (
              <>
                {' '}
                <strong className="text-gray-900">{workspaceName}</strong>
              </>
            ) : null}{' '}
            jako edytor
            {boardName ? (
              <>
                {' '}
                i zostanie przekierowany do tablicy{' '}
                <strong className="text-gray-900">{boardName}</strong>
              </>
            ) : null}
            .
          </p>

          {status === 'loading' && (
            <div className="flex items-center justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-700" />
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {status === 'revoked' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-700">Link został unieważniony.</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 cursor-pointer rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] px-4 py-3 font-mono text-sm text-gray-700"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <DashboardButton
                    variant="primary"
                    leftIcon={copied ? <Check size={18} /> : <Copy size={18} />}
                    onClick={handleCopy}
                  >
                    {copied ? 'Skopiowano!' : 'Kopiuj'}
                  </DashboardButton>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Link jest ważny przez 90 dni, chyba że go wcześniej unieważnisz albo odświeżysz.
                </p>
              </div>

              <div className="flex gap-2">
                <DashboardButton
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={handleRefresh}
                  disabled={busy}
                  className="flex-1"
                >
                  Odśwież link
                </DashboardButton>
                <DashboardButton
                  variant="secondary"
                  leftIcon={<Ban size={16} />}
                  onClick={handleRevoke}
                  disabled={busy}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  Unieważnij
                </DashboardButton>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
