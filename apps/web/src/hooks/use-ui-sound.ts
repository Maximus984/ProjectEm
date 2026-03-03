import { useCallback, useEffect, useRef, useState } from "react";

type SoundKind = "tap" | "route" | "success";

const STORAGE_KEY = "projectm_ui_sound_enabled";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? withWebkit.webkitAudioContext;
}

function playEnvelopeTone(
  context: AudioContext,
  config: { frequencyStart: number; frequencyEnd: number; gainPeak: number; durationSeconds: number; type: OscillatorType }
) {
  const { frequencyStart, frequencyEnd, gainPeak, durationSeconds, type } = config;
  const startAt = context.currentTime + 0.004;
  const stopAt = startAt + durationSeconds;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequencyStart, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequencyEnd), stopAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startAt + Math.min(0.03, durationSeconds / 2));
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(stopAt);
}

export function useUiSound() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === "true";
  });
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  }, [enabled]);

  const ensureContext = useCallback(async () => {
    const ctor = getAudioContextCtor();
    if (!ctor) {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = new ctor();
    }

    if (contextRef.current.state === "suspended") {
      try {
        await contextRef.current.resume();
      } catch {
        return null;
      }
    }

    return contextRef.current;
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const unlock = () => {
      void ensureContext();
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
    };
  }, [enabled, ensureContext]);

  const play = useCallback(
    async (kind: SoundKind) => {
      if (!enabled) {
        return;
      }

      const context = await ensureContext();
      if (!context) {
        return;
      }

      if (kind === "tap") {
        playEnvelopeTone(context, {
          frequencyStart: 680,
          frequencyEnd: 540,
          gainPeak: 0.018,
          durationSeconds: 0.09,
          type: "triangle"
        });
        return;
      }

      if (kind === "route") {
        playEnvelopeTone(context, {
          frequencyStart: 420,
          frequencyEnd: 680,
          gainPeak: 0.014,
          durationSeconds: 0.12,
          type: "sine"
        });
        return;
      }

      playEnvelopeTone(context, {
        frequencyStart: 560,
        frequencyEnd: 980,
        gainPeak: 0.02,
        durationSeconds: 0.16,
        type: "triangle"
      });
    },
    [enabled, ensureContext]
  );

  return {
    enabled,
    setEnabled,
    toggle: () => setEnabled((value) => !value),
    playTap: () => void play("tap"),
    playRoute: () => void play("route"),
    playSuccess: () => void play("success")
  };
}
