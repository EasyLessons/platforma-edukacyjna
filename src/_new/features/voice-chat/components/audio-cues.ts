/**
 * Krotkie dzwieki UI voice chatu (dolaczenie, mute, deafen...): miekki "klik" z szumem
 * + krotki ton. Syntetyczne (Web Audio), bez plikow. Wydzielone z voice-chat.tsx, 1:1.
 */
export type VoiceCueKind = 'join' | 'deafen' | 'undeafen' | 'leave' | 'mic-on' | 'mic-off' | 'menu';

export function playVoiceCue(kind: VoiceCueKind): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Miekki "klik" z lekkim szumem zamiast ostrego beepa.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * Math.exp((-6 * i) / channel.length);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = kind === 'join' ? 2600 : kind === 'menu' ? 2100 : 1800;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0001;
    noiseGain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';

    if (kind === 'join') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    } else if (kind === 'undeafen') {
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.1);
    } else if (kind === 'deafen') {
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.1);
    } else if (kind === 'mic-on') {
      osc.frequency.setValueAtTime(530, now);
      osc.frequency.exponentialRampToValueAtTime(690, now + 0.09);
    } else if (kind === 'mic-off') {
      osc.frequency.setValueAtTime(690, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    } else if (kind === 'menu') {
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.07);
    } else {
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
    }

    oscGain.gain.value = 0.0001;
    oscGain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.13);
    osc.start(now);
    osc.stop(now + 0.15);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 260);
  } catch {
    // best-effort audio feedback
  }
}
