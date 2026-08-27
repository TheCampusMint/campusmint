"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";

import { curatedTints } from "@/data/appearance";
import { getUserRoleLabel } from "@/data/userRoles";
import type { UniversityTheme } from "@/data/universities";
import type { AppPreferencesState } from "@/hooks/useAppPreferences";
import type { ProfilesState } from "@/hooks/useProfiles";
import { InfoRow, SelectRow, ToggleRow } from "@/components/shell/SettingsControls";
import { profileVisibilityOptions, type CampusMintUser, type ProfilePrivacyField, type ProfileVisibility } from "@/types/profile";
import type { AppearanceMode, ContentPreferences, NotificationPreferences } from "@/types/preferences";

type SettingsCategory = "appearance" | "privacy" | "notifications" | "content" | "safety" | "account" | "help";

type SettingsPanelProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  preferenceState: AppPreferencesState;
  onOpenProfile: () => void;
  onClose: () => void;
};

const categories: Array<{ id: SettingsCategory; label: string }> = [
  { id: "appearance", label: "Appearance" },
  { id: "privacy", label: "Privacy" },
  { id: "notifications", label: "Notifications" },
  { id: "content", label: "Content" },
  { id: "safety", label: "Safety" },
  { id: "account", label: "Account" },
  { id: "help", label: "Help" },
];

const appearanceChoices: Array<{ id: AppearanceMode; label: string; detail: string }> = [
  { id: "light", label: "Light", detail: "Neutral and bright" },
  { id: "dark", label: "Dark", detail: "Low-light contrast" },
  { id: "campus", label: "Campus", detail: "Your school colors" },
  { id: "curated", label: "Tint", detail: "Muted palettes" },
];

function previewStyle(mode: AppearanceMode, theme: UniversityTheme, tint: string) {
  if (mode === "dark") return { background: "linear-gradient(135deg,#0b0e14 50%,#273242 50%)" };
  if (mode === "campus") return { background: `linear-gradient(135deg,${theme.primary} 50%,${theme.accent} 50%)` };
  if (mode === "curated") return { background: `linear-gradient(135deg,${tint} 50%,color-mix(in srgb, ${tint} 24%, white) 50%)` };
  return { background: "linear-gradient(135deg,#ffffff 50%,#e7ebf0 50%)" };
}

function visibilityOptions() {
  return profileVisibilityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>);
}

export function SettingsPanel({ viewer, theme, profiles, preferenceState, onOpenProfile, onClose }: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("appearance");
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const closingRef = useRef(false);
  const categoryTouchRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const [categoryDirection, setCategoryDirection] =
    useState<-1 | 1>(1);
  const onCloseRef = useRef(onClose);
  const { preferences, updateAppearance, updateNotifications, updateContent } = preferenceState;
  const selectedTint = curatedTints.find((tint) => tint.id === preferences.appearance.tint) ?? curatedTints[0];
  const blockedUsers = profiles.blocks
    .filter((block) => block.blockerId === viewer.account.id)
    .flatMap((block) => {
      const blocked = profiles.getUserById(block.blockedId);
      return blocked ? [blocked] : [];
    });

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), preferences.content.reducedMotion ? 0 : 220);
  }, [preferences.content.reducedMotion]);

  function updatePrivacy(field: ProfilePrivacyField, value: string) {
    profiles.updateCurrentPrivacy({ [field]: value as ProfileVisibility });
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [requestClose]);

  function selectCategory(next: SettingsCategory) {
    const currentIndex = categories.findIndex(
      (category) => category.id === activeCategory,
    );

    const nextIndex = categories.findIndex(
      (category) => category.id === next,
    );

    if (nextIndex === currentIndex || nextIndex < 0) return;

    setCategoryDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveCategory(next);
  }

  function beginCategorySwipe(
    event: TouchEvent<HTMLDivElement>,
  ) {
    if (event.touches.length !== 1) {
      categoryTouchRef.current = null;
      return;
    }

    categoryTouchRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  function finishCategorySwipe(
    event: TouchEvent<HTMLDivElement>,
  ) {
    const start = categoryTouchRef.current;
    categoryTouchRef.current = null;

    if (!start || event.changedTouches.length !== 1) return;

    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;

    if (
      Math.abs(dx) < 58 ||
      Math.abs(dx) < Math.abs(dy) * 1.35
    ) {
      return;
    }

    const currentIndex = categories.findIndex(
      (category) => category.id === activeCategory,
    );

    const nextIndex = Math.max(
      0,
      Math.min(
        categories.length - 1,
        currentIndex + (dx < 0 ? 1 : -1),
      ),
    );

    if (nextIndex !== currentIndex) {
      setCategoryDirection(dx < 0 ? 1 : -1);
      setActiveCategory(categories[nextIndex].id);
    }
  }

  const section = (() => {
    if (activeCategory === "appearance") return (
      <div>
        <h3 className="text-lg font-black text-slate-950">Appearance</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">Choose a calm interface treatment. Campus color always follows your selected university.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {appearanceChoices.map((choice) => (
            <button key={choice.id} type="button" aria-pressed={preferences.appearance.mode === choice.id} onClick={() => updateAppearance({ mode: choice.id })} className="rounded-2xl border p-3 text-left transition active:scale-[0.98]" style={{ borderColor: preferences.appearance.mode === choice.id ? "var(--app-accent)" : "var(--app-border)", backgroundColor: preferences.appearance.mode === choice.id ? "var(--app-accent-soft)" : "var(--app-surface)" }}>
              <span className="block h-12 rounded-xl border border-white/30 shadow-inner" style={previewStyle(choice.id, theme, selectedTint.preview)} />
              <span className="mt-3 block text-sm font-black text-slate-900">{choice.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{choice.detail}</span>
            </button>
          ))}
        </div>
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Curated tint</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {curatedTints.map((tint) => (
              <button key={tint.id} type="button" onClick={() => updateAppearance({ mode: "curated", tint: tint.id })} aria-pressed={preferences.appearance.mode === "curated" && preferences.appearance.tint === tint.id} className="flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-bold transition active:scale-[0.98]" style={{ borderColor: preferences.appearance.mode === "curated" && preferences.appearance.tint === tint.id ? "var(--app-accent)" : "var(--app-border)", backgroundColor: "var(--app-surface)" }}>
                <span className="h-5 w-5 shrink-0 rounded-full shadow-inner" style={{ backgroundColor: tint.preview }} />{tint.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    if (activeCategory === "privacy") return (
      <div>
        <h3 className="text-lg font-black text-slate-950">Privacy</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">These controls update the existing profile permission state immediately.</p>
        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
          <SelectRow label="Account" value={viewer.socialSettings.accountType} onChange={(value) => profiles.updateCurrentSocialSettings({ accountType: value as "public" | "private" })}><option value="public">Public</option><option value="private">Private</option></SelectRow>
          <SelectRow label="Profile visibility" value={viewer.privacy.bio} onChange={(value) => updatePrivacy("bio", value)}>{visibilityOptions()}</SelectRow>
          <SelectRow label="Classes visibility" value={viewer.privacy.classes} onChange={(value) => updatePrivacy("classes", value)}>{visibilityOptions()}</SelectRow>
          <SelectRow label="Club visibility" value={viewer.privacy.clubs} onChange={(value) => updatePrivacy("clubs", value)}>{visibilityOptions()}</SelectRow>
          <SelectRow label="Major visibility" value={viewer.privacy.major} onChange={(value) => updatePrivacy("major", value)}>{visibilityOptions()}</SelectRow>
        </div>
      </div>
    );

    if (activeCategory === "notifications") return (
      <div><h3 className="text-lg font-black text-slate-950">Notifications</h3><p className="mt-1 text-sm leading-6 text-slate-500">Device-local preferences for this development build.</p><div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
        {(Object.entries({ sounds: "Notification sounds", messages: "Messages", clubUpdates: "Club updates", eventReminders: "Event reminders", mentions: "Mentions", marketplaceMessages: "Marketplace messages" }) as Array<[keyof NotificationPreferences, string]>).map(([key, label]) => <ToggleRow key={key} label={label} checked={preferences.notifications[key]} onChange={(checked) => updateNotifications({ [key]: checked })} />)}
      </div></div>
    );

    if (activeCategory === "content") return (
      <div><h3 className="text-lg font-black text-slate-950">Content</h3><p className="mt-1 text-sm leading-6 text-slate-500">Defaults apply to future local content. Reduced motion changes the interface immediately.</p><div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
        {(Object.entries({ hideLikeCountsDefault: ["Hide like counts by default", "New Mintz start without a public like count."], commentsDefault: ["Comments on by default", "New Mintz begin with comments enabled."], autoplayVideo: ["Autoplay video", "Allow compatible feed video to start automatically."], reducedMotion: ["Reduced motion", "Disable parallax and shorten interface animation."] }) as Array<[keyof ContentPreferences, [string, string]]>).map(([key, [label, description]]) => <ToggleRow key={key} label={label} description={description} checked={preferences.content[key]} onChange={(checked) => updateContent({ [key]: checked })} />)}
      </div></div>
    );

    if (activeCategory === "safety") return (
      <div><h3 className="text-lg font-black text-slate-950">Safety</h3><p className="mt-1 text-sm leading-6 text-slate-500">Blocked accounts use the existing local relationship state.</p><div className="mt-5 rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Blocked users</p>
        {blockedUsers.length === 0 ? <p className="mt-3 text-sm text-slate-500">No blocked users.</p> : <div className="mt-3 divide-y divide-slate-100">{blockedUsers.map((user) => <div key={user.account.id} className="flex items-center justify-between gap-3 py-3"><span className="text-sm font-bold text-slate-900">{user.profile.displayName}</span><button type="button" onClick={() => profiles.unblockUser(user.account.id)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold">Unblock</button></div>)}</div>}
      </div><button type="button" onClick={() => setNotice("Report and safety help will connect to support services in a future release.")} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Report or get safety help</button></div>
    );

    if (activeCategory === "account") return (
      <div><h3 className="text-lg font-black text-slate-950">Account</h3><p className="mt-1 text-sm leading-6 text-slate-500">Current development identity. No authentication settings are simulated here.</p><div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
        <InfoRow label="Profile" value={viewer.profile.displayName} /><InfoRow label="University" value={theme.name} /><InfoRow label="Role" value={getUserRoleLabel(viewer.account.role)} /><InfoRow label="Username" value={`@${viewer.profile.username}`} /><InfoRow label="Verification" value={viewer.account.verifiedStudent || viewer.account.verifiedAlumni ? "Verified" : "Not verified"} />
      </div><button type="button" onClick={() => { onOpenProfile(); requestClose(); }} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-black shadow-sm transition active:scale-[0.98]" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>Open profile</button></div>
    );

    return (
      <div><h3 className="text-lg font-black text-slate-950">Help</h3><p className="mt-1 text-sm leading-6 text-slate-500">Campus Mint development resources.</p><div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {["Help / Support", "About Campus Mint", "Terms / Privacy"].map((label) => <button key={label} type="button" onClick={() => setNotice(`${label} is a placeholder in this local development version.`)} className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-bold text-slate-800 transition hover:bg-slate-50"><span>{label}</span><span aria-hidden="true">›</span></button>)}
      </div></div>
    );
  })();

  return (
    <div className={`settings-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 backdrop-blur-sm sm:items-center sm:p-5 ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="settings-title" className={`settings-sheet flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl sm:max-h-[84dvh] sm:rounded-[2rem] ${closing ? "is-closing" : ""}`}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--app-accent)" }}>Campus Mint</p><h2 id="settings-title" className="text-xl font-black text-slate-950">Settings</h2></div>
          <button type="button" onClick={requestClose} aria-label="Close settings" className="interactive-pop flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600">×</button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 sm:px-6" aria-label="Settings categories">
          {categories.map((category) => <button key={category.id} type="button" onClick={() => selectCategory(category.id)} data-static-control aria-pressed={activeCategory === category.id} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-3 py-2 text-center text-xs font-black transition" style={activeCategory === category.id ? { backgroundColor: "var(--app-accent)", borderColor: "var(--app-accent)", color: "var(--app-accent-contrast)" } : { borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}>{category.label}</button>)}
        </div>
        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 py-6 sm:px-6"
          onTouchStart={beginCategorySwipe}
          onTouchEnd={finishCategorySwipe}
          onTouchCancel={() => {
            categoryTouchRef.current = null;
          }}
        >
          <div
            key={activeCategory}
            className="cm-content-swap"
            data-direction={categoryDirection}
          >
            {section}
          </div>{notice && <div role="status" className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><span>{notice}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button></div>}</div>
      </section>
    </div>
  );
}
