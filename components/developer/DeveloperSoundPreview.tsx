"use client";

import {
  notificationSoundIdentities,
  notificationSoundProfiles,
  playNotificationSound,
} from "@/lib/notifications/notificationSounds";

type DeveloperSoundPreviewProps = {
  enabled: boolean;
};

export function DeveloperSoundPreview({
  enabled,
}: DeveloperSoundPreviewProps) {
  return (
    <div
      className="flex items-end gap-1.5"
      role="group"
      aria-label="Development notification sound previews"
    >
      <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/75">
        Dev: Sound
      </span>

      {notificationSoundIdentities.map((identity) => (
        <button
          key={identity}
          type="button"
          disabled={!enabled}
          title={
            enabled
              ? `Play ${notificationSoundProfiles[identity].label}`
              : "Enable notification sounds in Settings"
          }
          onClick={() => {
            void playNotificationSound(identity, { enabled });
          }}
          className="rounded-full border border-white/25 bg-white/12 px-2.5 py-1.5 text-[10px] font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {identity === "urgent_event"
            ? "Bling"
            : identity === "direct_message"
              ? "DM"
              : "Boop"}
        </button>
      ))}
    </div>
  );
}
