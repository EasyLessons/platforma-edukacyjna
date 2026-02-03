/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT COMPONENT
 *                   UI dla voice chat na tablicy
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Settings,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useVoiceChat, VoiceParticipant } from '@/app/context/VoiceChatContext';
import VoiceChatSettings from './VoiceChatSettings';

interface VoiceChatProps {
  className?: string;
}

export default function VoiceChat({ className = '' }: VoiceChatProps) {
  const voiceChat = useVoiceChat();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Jeśli nie ma VoiceChatProvider, nie renderuj nic
  if (!voiceChat) {
    return null;
  }

  const {
    isInVoiceChat,
    isConnecting,
    participants,
    isMuted,
    isSpeaking,
    joinVoiceChat,
    leaveVoiceChat,
    toggleMute,
    settings,
  } = voiceChat;

  // Kolory dla uczestników
  const getParticipantColor = (index: number) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    return colors[index % colors.length];
  };

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Główny przycisk Voice Chat */}
        <div className="flex items-center gap-1">
          {/* Przycisk rozwijania/zwijania */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
              ${
                isInVoiceChat
                  ? 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }
            `}
          >
            {isInVoiceChat ? (
              <>
                <Phone className="w-4 h-4" />
                <span className="text-sm font-medium">Voice ({participants.length})</span>
                {isSpeaking && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              </>
            ) : (
              <>
                <PhoneOff className="w-4 h-4 opacity-50" />
                <span className="text-sm font-medium">Voice</span>
              </>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Panel rozwijany */}
        {isExpanded && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                <span className="font-semibold">Voice Chat</span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Ustawienia"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Lista uczestników */}
            <div className="max-h-48 overflow-y-auto">
              {participants.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500">
                  <PhoneOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Brak uczestników</p>
                  <p className="text-xs text-gray-400 mt-1">Dołącz jako pierwszy!</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {participants.map((participant, index) => (
                    <ParticipantItem
                      key={participant.odUserId}
                      participant={participant}
                      color={getParticipantColor(index)}
                      isCurrentUser={participant.username === 'Ty'}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Kontrolki */}
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              {!isInVoiceChat ? (
                <button
                  onClick={joinVoiceChat}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white rounded-lg font-medium transition-colors"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Łączenie...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      <span>Dołącz do rozmowy</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Mute button */}
                  <button
                    onClick={toggleMute}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors
                      ${
                        isMuted
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }
                    `}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        <span>Wyciszony</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>Mikrofon</span>
                      </>
                    )}
                  </button>

                  {/* Leave button */}
                  <button
                    onClick={leaveVoiceChat}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    title="Rozłącz się"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Push-to-talk hint */}
              {isInVoiceChat && settings.pushToTalk && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Przytrzymaj{' '}
                  <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">
                    {settings.pushToTalkKey.replace('Key', '')}
                  </kbd>{' '}
                  aby mówić
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && <VoiceChatSettings onClose={() => setShowSettings(false)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 👤 PARTICIPANT ITEM
// ═══════════════════════════════════════════════════════════════════════════

function ParticipantItem({
  participant,
  color,
  isCurrentUser,
}: {
  participant: VoiceParticipant;
  color: string;
  isCurrentUser: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
        style={{ backgroundColor: color }}
      >
        {participant.username.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {participant.username}
          {isCurrentUser && <span className="text-gray-400 font-normal"> (Ty)</span>}
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        {participant.isMuted ? (
          <VolumeX className="w-4 h-4 text-red-500" />
        ) : participant.isSpeaking ? (
          <div className="flex items-center gap-0.5">
            <Volume2 className="w-4 h-4 text-green-500" />
            <span className="flex gap-0.5">
              <span
                className="w-1 h-2 bg-green-500 rounded-full animate-pulse"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-1 h-3 bg-green-500 rounded-full animate-pulse"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-1 h-2 bg-green-500 rounded-full animate-pulse"
                style={{ animationDelay: '300ms' }}
              />
            </span>
          </div>
        ) : (
          <Mic className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </li>
  );
}
