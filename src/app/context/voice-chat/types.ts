export interface VoiceParticipant {
  odUserId: number;
  username: string;
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number; // 0-1
}

export interface VoiceSettings {
  microphoneVolume: number; // 0-1
  speakerVolume: number; // 0-1
  pushToTalk: boolean;
  pushToTalkKey: string; // np. 'Space', 'KeyV'
  noiseSupression: boolean;
  echoCancellation: boolean;
}

export interface PeerConnection {
  odUserId: number;
  username: string;
  pc: RTCPeerConnection;
  audioElement?: HTMLAudioElement;
}

export type VoiceEvent =
  | { type: 'voice-join'; userId: number; username: string }
  | { type: 'voice-leave'; userId: number }
  | { type: 'voice-sync'; userId: number; username: string; isMuted: boolean } // Odpowiedź "jestem w voice chat"
  | { type: 'voice-request-sync'; userId: number } // Prośba o sync od nowego użytkownika
  | {
      type: 'voice-offer';
      fromUserId: number;
      fromUsername: string;
      toUserId: number;
      offer: RTCSessionDescriptionInit;
    }
  | {
      type: 'voice-answer';
      fromUserId: number;
      toUserId: number;
      answer: RTCSessionDescriptionInit;
    }
  | { type: 'voice-ice'; fromUserId: number; toUserId: number; candidate: RTCIceCandidateInit }
  | { type: 'voice-mute'; userId: number; isMuted: boolean }
  | { type: 'voice-speaking'; userId: number; isSpeaking: boolean };

export interface VoiceChatContextType {
  // Stan
  isInVoiceChat: boolean;
  isConnecting: boolean;
  participants: VoiceParticipant[];
  settings: VoiceSettings;
  isMuted: boolean;
  isSpeaking: boolean;

  // Akcje
  joinVoiceChat: () => Promise<void>;
  leaveVoiceChat: () => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;

  // Push-to-talk
  startTalking: () => void;
  stopTalking: () => void;
}
