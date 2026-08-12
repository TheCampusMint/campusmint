"use client";

import { useEffect, useState } from "react";

import { DirectMintThread } from "@/components/messages/DirectMintThread";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { MintBackLeaf } from "@/components/profile/ProfileView";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintState } from "@/hooks/useDirectMint";
import type { ProfilesState } from "@/hooks/useProfiles";
import type { CampusMintUser } from "@/types/profile";

type MessagesSkeletonProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  directMint: DirectMintState;
  requestedUserId?: string | null;
  onBackToProfile?: () => void;
};

export function MessagesSkeleton({
  viewer,
  theme,
  profiles,
  directMint,
  requestedUserId = null,
  onBackToProfile,
}: MessagesSkeletonProps) {
  const candidates = profiles.users.filter(
    (user) =>
      user.account.id !== viewer.account.id &&
      !profiles.isBlocked(user.account.id),
  );

  const [selectedId, setSelectedId] =
    useState<string | null>(
      requestedUserId ??
        directMint.conversationUserIds[0] ??
        null,
    );

  useEffect(() => {
    if (!requestedUserId) return;

    directMint.startConversation(
      requestedUserId,
    );
    setSelectedId(requestedUserId);
  }, [requestedUserId]);

  const conversationUsers =
    directMint.conversationUserIds
      .map((id) =>
        candidates.find(
          (user) => user.account.id === id,
        ),
      )
      .filter(
        (
          user,
        ): user is CampusMintUser =>
          Boolean(user),
      );

  const selected =
    candidates.find(
      (user) =>
        user.account.id === selectedId,
    ) ?? null;

  return (
    <div className="space-y-5">
      {onBackToProfile && (
        <button
          type="button"
          onClick={onBackToProfile}
          aria-label="Back to profile"
          title="Back to profile"
          className="interactive-pop flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-slate-800 shadow-none"
        >
          <MintBackLeaf />
        </button>
      )}

      <div className="px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          Private conversations
        </p>

        <h1 className="mt-1 text-3xl font-black text-slate-950">
          Direct Mint
        </h1>
      </div>

      <div className="grid min-h-[30rem] overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-sm md:grid-cols-[17rem_1fr]">
        <aside className="border-b border-slate-100 p-3 md:border-b-0 md:border-r">
          <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            DMs
          </p>

          <div className="space-y-1">
            {conversationUsers.length > 0 ? (
              conversationUsers.map(
                (user) => (
                  <button
                    key={user.account.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        user.account.id,
                      )
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${
                      selectedId ===
                      user.account.id
                        ? "bg-slate-100"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <ProfileAvatar
                      user={user}
                      size="sm"
                      primaryColor={
                        theme.primary
                      }
                      accentColor={
                        theme.accent
                      }
                    />

                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-900">
                        {
                          user.profile
                            .displayName
                        }
                      </strong>

                      <span className="block truncate text-xs text-slate-500">
                        @
                        {
                          user.profile
                            .username
                        }
                      </span>
                    </span>
                  </button>
                ),
              )
            ) : (
              <p className="px-2 py-4 text-xs leading-5 text-slate-400">
                Start a DM from someone&apos;s
                profile.
              </p>
            )}
          </div>
        </aside>

        <section className="min-h-72">
          {selected ? (
            <DirectMintThread
              viewer={viewer}
              otherUser={selected}
              theme={theme}
              directMint={directMint}
            />
          ) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center p-8 text-center">
              <span
                className="text-2xl font-bold tracking-tight text-slate-800"
                aria-hidden="true"
              >
                DM
              </span>

              <h2 className="mt-4 font-black text-slate-950">
                No conversation selected
              </h2>

              <p className="mt-2 max-w-xs text-sm text-slate-500">
                Open a student profile and tap
                Message to start a Direct Mint.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
