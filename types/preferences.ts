export const appearanceModes = ["light", "dark", "campus", "curated"] as const;
export type AppearanceMode = (typeof appearanceModes)[number];

export const curatedTintIds = ["slate", "warm-gray", "forest", "deep-navy", "muted-maroon"] as const;
export type CuratedTintId = (typeof curatedTintIds)[number];

export type AppearancePreferences = {
  mode: AppearanceMode;
  tint: CuratedTintId;
};

export type NotificationPreferences = {
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
};

export type AppPreferences = {
  appearance: AppearancePreferences;
  notifications: NotificationPreferences;
  content: ContentPreferences;
};
