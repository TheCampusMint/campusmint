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
import { useModalLayer } from "@/hooks/useModalLayer";
import { InfoRow, SelectRow, ToggleRow } from "@/components/shell/SettingsControls";
import { CloseButton } from "@/components/ui/CloseButton";
import { profileVisibilityOptions, type CampusMintUser, type ProfilePrivacyField, type ProfileVisibility } from "@/types/profile";
import type { AppearanceAccentSource, AppearanceScheme, ContentPreferences, NotificationPreferences } from "@/types/preferences";

type SettingsCategory = "appearance" | "privacy" | "notifications" | "content" | "safety" | "account" | "help";

type SettingsPanelProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  preferenceState: AppPreferencesState;
  onOpenProfile: () => void;
  onApplyCreator: () => void;
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

const schemeChoices: Array<{ id: AppearanceScheme; label: string; detail: string }> = [
  { id: "light", label: "Light", detail: "Bright surfaces" },
  { id: "dark", label: "Dark", detail: "Low-light surfaces" },
  { id: "colorful", label: "Colorful", detail: "Color with meaning" },
];

const accentChoices: Array<{ id: AppearanceAccentSource; label: string }> = [
  { id: "brand", label: "Campus Mint" },
  { id: "campus", label: "School" },
  { id: "curated", label: "Custom tint" },
];

function schemePreviewStyle(scheme: AppearanceScheme) {
  if (scheme === "colorful") return { background: "linear-gradient(115deg,#b74346 33%,#a85a20 33%,#a85a20 66%,#287650 66%)" };
  return scheme === "dark"
    ? { background: "linear-gradient(135deg,#0a0a0a 50%,#242424 50%)" }
    : { background: "linear-gradient(135deg,#ffffff 50%,#f0f0f0 50%)" };
}

function visibilityOptions() {
  return profileVisibilityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>);
}

export function SettingsPanel({ viewer, theme, profiles, preferenceState, onOpenProfile, onApplyCreator, onClose }: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("appearance");
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closingRef = useRef(false);
  const categoryTouchRef = useRef<{
    x: number;
    y: number;
  } | null>(null);
  const [categoryDirection, setCategoryDirection] =
    useState<-1 | 1>(1);
  const onCloseRef = useRef(onClose);
  const { preferences, updateAppearance, updateNotifications, updateContent } = preferenceState;
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

  useModalLayer(dialogRef, requestClose);

  function updatePrivacy(field: ProfilePrivacyField, value: string) {
    profiles.updateCurrentPrivacy({ [field]: value as ProfileVisibility });
  }

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

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
        <p className="mt-1 text-sm leading-6 text-slate-500">Choose your look. Light and Dark use your accent throughout the interface.</p>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {schemeChoices.map((choice) => (
            <button key={choice.id} type="button" aria-pressed={preferences.appearance.scheme === choice.id} onClick={() => updateAppearance({ scheme: choice.id })} className="cm-choice-control rounded-3xl p-3 text-left transition active:scale-[0.98]">
              <span aria-hidden="true" className="block h-12 rounded-full" style={schemePreviewStyle(choice.id)} />
              <span className="cm-choice-highlight mt-2 text-sm font-black">{choice.label}</span>
              <span className="mt-0.5 block px-3 text-xs text-slate-500">{choice.detail}</span>
            </button>
          ))}
        </div>
        {preferences.appearance.scheme === "colorful" ? <div className="mt-5 space-y-3 text-sm">
          <p className="text-[var(--app-text-secondary)]">One shared palette, with light or dark surfaces that follow your device.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <span className="text-[var(--app-urgent)]">Red · happening now</span>
            <span className="text-[var(--app-discovery)]">Orange · discover</span>
            <span className="text-[var(--app-personal)]">Green · for you</span>
          </div>
        </div> : <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Accent source</p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {accentChoices.map((choice) => (
              <button key={choice.id} type="button" onClick={() => updateAppearance({ accentSource: choice.id })} aria-pressed={preferences.appearance.accentSource === choice.id} className="cm-choice-control inline-flex min-h-11 max-w-full items-center rounded-full text-xs font-bold">
                <span className="cm-choice-highlight">{choice.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Custom tint</p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {curatedTints.map((tint) => (
              <button key={tint.id} type="button" onClick={() => updateAppearance({ accentSource: "curated", tint: tint.id })} aria-pressed={preferences.appearance.accentSource === "curated" && preferences.appearance.tint === tint.id} className="cm-choice-control inline-flex min-h-11 max-w-full items-center rounded-full text-left text-xs font-bold">
                <span className="cm-choice-highlight"><span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: tint.preview }} />{tint.label}</span>
              </button>
            ))}
          </div>
        </div>}
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
        {(Object.entries({ commentsDefault: ["Comments on by default", "New Mintz begin with comments enabled."], autoplayVideo: ["Autoplay video", "Allow compatible feed video to start automatically."], reducedMotion: ["Reduced motion", "Disable parallax and shorten interface animation."], autoArchiveTemporaryMintz: ["Auto Archive", "Keep an owner-only copy after a temporary Mint expires."], saveCapturedMediaToDevice: ["Save captures to device", "Stored for a future native camera; the browser does not claim Photos access."] }) as Array<[keyof ContentPreferences, [string, string]]>).map(([key, [label, description]]) => <ToggleRow key={key} label={label} description={description} checked={preferences.content[key]} onChange={(checked) => updateContent({ [key]: checked })} />)}
      </div><div className="mt-5 px-4">
        <ToggleRow label="4K / HD uploads" description="Off by default. Turn on for photos up to 4K with less compression. Shape stays unchanged. Videos keep their original quality in either mode. Uses more data and storage; existing file limits apply." checked={preferences.content.highQualityUploads} onChange={(checked) => updateContent({ highQualityUploads: checked })} />
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
      </div><button type="button" onClick={() => { onOpenProfile(); requestClose(); }} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-black shadow-sm transition active:scale-[0.98]" style={{ backgroundColor: "var(--app-accent)", color: "var(--app-accent-contrast)" }}>Open profile</button>{viewer.account.verifiedStudent && !viewer.account.isDevelopment && !viewer.account.capabilities?.includes("creator") && <button type="button" onClick={() => { onApplyCreator(); requestClose(); }} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">Apply for Creator</button>}</div>
    );

    return (
      <div><h3 className="text-lg font-black text-slate-950">Help</h3><p className="mt-1 text-sm leading-6 text-slate-500">Campus Mint development resources.</p><div className="mt-5 flex flex-col gap-1">
        {["Help / Support", "About Campus Mint", "Terms / Privacy"].map((label) => <button key={label} type="button" onClick={() => setNotice(`${label} is a placeholder in this local development version.`)} className="cm-choice-control flex min-h-11 w-full items-center justify-between gap-3 rounded-full py-1 pr-3 text-left text-sm font-bold"><span className="cm-choice-highlight">{label}</span><span aria-hidden="true">›</span></button>)}
      </div></div>
    );
  })();

  return (
    <div className={`settings-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 backdrop-blur-sm sm:items-center sm:p-5 ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="settings-title" className={`settings-sheet flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl sm:max-h-[84dvh] sm:rounded-[2rem] ${closing ? "is-closing" : ""}`}>
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--app-accent)" }}>Campus Mint</p><h2 id="settings-title" className="text-xl font-black text-slate-950">Settings</h2></div>
          <CloseButton data-initial-focus onClick={requestClose} label="Close settings" />
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
          </div>{notice && <div role="status" className="mt-5 flex items-start justify-between gap-3 rounded-2xl bg-[var(--app-accent-soft)] p-4 text-sm font-semibold text-[var(--app-accent)]"><span>{notice}</span><CloseButton tone="minimal" className="-mr-2 -mt-2" label="Dismiss notice" onClick={() => setNotice(null)} /></div>}</div>
      </section>
    </div>
  );
}
