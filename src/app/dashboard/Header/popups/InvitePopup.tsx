'use client';

import { useState } from 'react';
import { Link2, Mail, Copy, Check, X } from 'lucide-react';

interface InvitePopupProps {
  onClose: () => void;
  spaceName?: string;
}

export default function InvitePopup({ onClose, spaceName = "Twoja przestrzeń" }: InvitePopupProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'email'>('link');
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [emailsSent, setEmailsSent] = useState(false);

  const inviteLink = "https://easylesson.com/invite/abc123xyz";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    console.log('Wysyłam zaproszenie na:', email);
    setEmailsSent(true);
    setTimeout(() => {
      setEmailsSent(false);
      setEmail('');
    }, 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-[100] px-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Zaproś uczestników
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              do przestrzeni: <span className="font-medium text-gray-700">{spaceName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 px-6 py-3 font-medium transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Link2 size={18} />
              <span>Zaproś przez link</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 px-6 py-3 font-medium transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Mail size={18} />
              <span>Wyślij na email</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Tab: Link */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Skopiuj i udostępnij link zaproszenia:
              </p>
              
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono cursor-pointer"
                  onClick={(e) => e.currentTarget.select()}
                />
                
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check size={18} />
                      <span>Skopiowano!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      <span>Kopiuj</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Wskazówka:</strong> Link jest ważny przez 7 dni i może być użyty wielokrotnie.
                </p>
              </div>
            </div>
          )}

          {/* Tab: Email */}
          {activeTab === 'email' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Wprowadź adresy email osób, które chcesz zaprosić:
              </p>
              
              <div>
                <textarea
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com, kolejny@example.com"
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Możesz wprowadzić wiele adresów oddzielonych przecinkami
                </p>
              </div>

              <button
                onClick={handleSendEmail}
                disabled={!email.trim() || emailsSent}
                className={`w-full px-6 py-3 font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  emailsSent
                    ? 'bg-green-100 text-green-700'
                    : email.trim()
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {emailsSent ? (
                  <>
                    <Check size={18} />
                    <span>Zaproszenia wysłane!</span>
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    <span>Wyślij zaproszenia</span>
                  </>
                )}
              </button>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  📧 Zaproszeni otrzymają email z linkiem do dołączenia do przestrzeni.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}