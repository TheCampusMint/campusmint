export const notificationSoundIdentities = [
  "urgent_event",
  "direct_message",
  "standard",
] as const;

export type NotificationSoundIdentity =
  (typeof notificationSoundIdentities)[number];

export const notificationEventTypes = [
  "urgent_event_reminder",
  "direct_message_received",
  "standard_notification",
] as const;

export type NotificationEventType =
  (typeof notificationEventTypes)[number];

export type NotificationTone = {
  frequencyHz: number;
  endFrequencyHz?: number;
  gain: number;
  startsAtSeconds: number;
  durationSeconds: number;
  attackSeconds: number;
  oscillator: OscillatorType;
};

export type NotificationSoundProfile = {
  identity: NotificationSoundIdentity;
  label: string;
  tones: readonly NotificationTone[];
};

export const notificationSoundProfiles = {
  urgent_event: {
    identity: "urgent_event",
    label: "Bling",
    tones: [
      {
        frequencyHz: 1_320,
        gain: 0.052,
        startsAtSeconds: 0,
        durationSeconds: 0.22,
        attackSeconds: 0.008,
        oscillator: "sine",
      },
      {
        frequencyHz: 2_640,
        gain: 0.016,
        startsAtSeconds: 0.012,
        durationSeconds: 0.15,
        attackSeconds: 0.006,
        oscillator: "sine",
      },
    ],
  },
  direct_message: {
    identity: "direct_message",
    label: "Three descending dings",
    tones: [
      {
        frequencyHz: 880,
        gain: 0.06,
        startsAtSeconds: 0,
        durationSeconds: 0.17,
        attackSeconds: 0.009,
        oscillator: "sine",
      },
      {
        frequencyHz: 659.25,
        gain: 0.043,
        startsAtSeconds: 0.22,
        durationSeconds: 0.16,
        attackSeconds: 0.009,
        oscillator: "sine",
      },
      {
        frequencyHz: 493.88,
        gain: 0.03,
        startsAtSeconds: 0.44,
        durationSeconds: 0.15,
        attackSeconds: 0.009,
        oscillator: "sine",
      },
    ],
  },
  standard: {
    identity: "standard",
    label: "Boop",
    tones: [
      {
        frequencyHz: 420,
        endFrequencyHz: 350,
        gain: 0.038,
        startsAtSeconds: 0,
        durationSeconds: 0.18,
        attackSeconds: 0.014,
        oscillator: "sine",
      },
    ],
  },
} as const satisfies Record<
  NotificationSoundIdentity,
  NotificationSoundProfile
>;

const soundForNotificationEvent = {
  urgent_event_reminder: "urgent_event",
  direct_message_received: "direct_message",
  standard_notification: "standard",
} as const satisfies Record<
  NotificationEventType,
  NotificationSoundIdentity
>;

let sharedAudioContext: AudioContext | null = null;

export function getNotificationSoundIdentity(
  eventType: NotificationEventType,
) {
  return soundForNotificationEvent[eventType];
}

export function getNotificationSoundProfile(
  identity: NotificationSoundIdentity,
) {
  return notificationSoundProfiles[identity];
}

function getAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextConstructor();
  }

  return sharedAudioContext;
}

function scheduleTone(
  context: AudioContext,
  tone: NotificationTone,
  origin: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = origin + tone.startsAtSeconds;
  const attackEnd = start + tone.attackSeconds;
  const end = start + tone.durationSeconds;

  oscillator.type = tone.oscillator;
  oscillator.frequency.setValueAtTime(tone.frequencyHz, start);

  if (tone.endFrequencyHz) {
    oscillator.frequency.exponentialRampToValueAtTime(
      tone.endFrequencyHz,
      end,
    );
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(
    tone.gain,
    attackEnd,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );

  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

export type NotificationSoundPlayResult =
  | "played"
  | "disabled"
  | "unavailable";

export async function playNotificationSound(
  identity: NotificationSoundIdentity,
  options: { enabled?: boolean } = {},
): Promise<NotificationSoundPlayResult> {
  if (options.enabled === false) return "disabled";

  const context = getAudioContext();
  if (!context) return "unavailable";

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return "unavailable";
    }
  }

  const origin = context.currentTime + 0.008;

  for (const tone of getNotificationSoundProfile(identity).tones) {
    scheduleTone(context, tone, origin);
  }

  return "played";
}
