export const appearanceSchemes = ["light", "dark"] as const;
export type AppearanceScheme = (typeof appearanceSchemes)[number];

export const appearanceAccentSources = ["brand", "campus", "curated"] as const;
export type AppearanceAccentSource = (typeof appearanceAccentSources)[number];

export const curatedTintIds = ["slate", "warm-gray", "forest", "deep-navy", "muted-maroon"] as const;
export type CuratedTintId = (typeof curatedTintIds)[number];

export type AppearancePreferences = {
  scheme: AppearanceScheme;
  accentSource: AppearanceAccentSource;
  tint: CuratedTintId;
};

export type NotificationPreferences = {
  sounds: boolean;
  messages: boolean;
  clubUpdates: boolean;
  eventReminders: boolean;
  mentions: boolean;
  marketplaceMessages: boolean;
};

export type ContentPreferences = {
  hideLikeCountsDefault: boolean;
  commentsDefault: boolean;
  autoplayVideo: boolean;
  reducedMotion: boolean;
  autoArchiveTemporaryMintz: boolean;
  saveCapturedMediaToDevice: boolean;
};

export type AppPreferences = {
  appearance: AppearancePreferences;
  notifications: NotificationPreferences;
  content: ContentPreferences;
};
