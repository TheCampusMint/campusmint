"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UniversityTheme } from "@/data/universities";
import type { DirectMintState } from "@/hooks/useDirectMint";
import type { CampusMintUser } from "@/types/profile";

type DirectMintThreadProps = {
  viewer: CampusMintUser;
  otherUser: CampusMintUser;
  theme: UniversityTheme;
  directMint: DirectMintState;
  compact?: boolean;
};

export function DirectMintThread({
  viewer,
  otherUser,
  theme,
  directMint,
  compact = false,
}: DirectMintThreadProps) {
  const [draft, setDraft] = useState("");

  const messages =
    directMint.messagesFor(
      otherUser.account.id,
    );

  function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const sent = directMint.sendMessage(
      otherUser.account.id,
      draft,
    );

    if (sent) {
      setDraft("");
    }
  }

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden bg-white ${
        compact
          ? "h-[min(32rem,65dvh)] rounded-3xl border border-slate-200 shadow-sm"
          : "h-[34rem]"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <ProfileAvatar
          user={otherUser}
          size="sm"
          primaryColor={theme.primary}
          accentColor={theme.accent}
        />

        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {otherUser.profile.displayName}
          </p>
          <p className="truncate text-xs text-slate-500">
            @{otherUser.profile.username}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="m-auto max-w-xs text-center">
            <p className="text-sm font-bold text-slate-700">
              Start a Direct Mint
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Messages you send here will also
              appear in the Direct Mint tab.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const own =
              message.senderId ===
              viewer.account.id;

            return (
              <div
                key={message.id}
                className={`flex ${
                  own
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[82%] rounded-[1.25rem] px-3.5 py-2.5 text-sm leading-6 ${
                    own
                      ? "text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                  style={
                    own
                      ? {
                          backgroundColor:
                            theme.primary,
                        }
                      : undefined
                  }
                >
                  {message.body}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-slate-100 p-3"
      >
        <textarea
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value)
          }
          rows={1}
          placeholder={`Message @${otherUser.profile.username}`}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none sm:text-sm"
        />

        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-black text-white disabled:opacity-40"
          style={{
            backgroundColor: theme.primary,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
