"use client";

import {
  getAccountUniversityIdentityKey,
  getAccountUniversityTheme,
} from "@/data/universities";

import { useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { TactileButton } from "@/components/ui/TactileButton";
import {
  getAccountUniversityName,
  getAccountUniversityShortName,
} from "@/data/universities";
import type { UniversityTheme } from "@/data/universities";
import { universities } from "@/data/universities";
import { getCampusNetwork } from "@/data/campusNetworks";
import { getOrganizationById } from "@/data/organizations";
import type { ProfilesState } from "@/hooks/useProfiles";
import {
  canViewClubs,
  canViewInterests,
  canViewMajor,
  canViewRoommate,
  canViewTutoring,
  createProfileViewerContext,
} from "@/lib/social/permissions";
import type { CampusMintUser } from "@/types/profile";

type PeopleSkeletonProps = {
  viewer: CampusMintUser;
  theme: UniversityTheme;
  profiles: ProfilesState;
  onOpenProfile: (userId: string) => void;
};

export function PeopleSkeleton({ viewer, theme, profiles, onOpenProfile }: PeopleSkeletonProps) {
  const [query, setQuery] = useState("");
  const [tutoringOnly, setTutoringOnly] =
    useState(false);
  const [tutoringSubject, setTutoringSubject] =
    useState<string | null>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const roommateSearch =
      normalized === "roommate" ||
      normalized === "roommates" ||
      normalized.includes("looking for roommate") ||
      normalized.includes("looking for a roommate");

    const tutoringTerms = [
      "tutor",
      "tutors",
      "tutoring",
    ];

    const tutoringSearch =
      tutoringTerms.some(
        (term) =>
          normalized === term ||
          normalized.startsWith(`${term} `) ||
          normalized.endsWith(` ${term}`) ||
          normalized.includes(` ${term} `),
      );

    const tutoringSearchSubject =
      tutoringSearch
        ? tutoringTerms
            .reduce(
              (value, term) =>
                value.replace(
                  new RegExp(`\\b${term}\\b`, "g"),
                  "",
                ),
              normalized,
            )
            .replace(/\s+/g, " ")
            .trim()
        : "";

    const viewerUniversity =
      getAccountUniversityTheme(
        viewer.account,
      );

    const viewerUniversityIdentityKey =
      getAccountUniversityIdentityKey(
        viewer.account,
      );

    const viewerNetwork = viewerUniversity
      ? getCampusNetwork(
          viewerUniversity.campusNetworkId,
        )
      : null;

    function distanceBetweenNetworks(
      targetNetworkId: string,
    ) {
      if (!viewerNetwork) return Number.POSITIVE_INFINITY;

      const targetNetwork =
        getCampusNetwork(targetNetworkId);

      if (!targetNetwork) {
        return Number.POSITIVE_INFINITY;
      }

      const toRadians = (value: number) =>
        (value * Math.PI) / 180;

      const earthRadiusMiles = 3958.8;

      const latitudeDelta = toRadians(
        targetNetwork.latitude -
          viewerNetwork.latitude,
      );

      const longitudeDelta = toRadians(
        targetNetwork.longitude -
          viewerNetwork.longitude,
      );

      const viewerLatitude =
        toRadians(viewerNetwork.latitude);

      const targetLatitude =
        toRadians(targetNetwork.latitude);

      const a =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(viewerLatitude) *
          Math.cos(targetLatitude) *
          Math.sin(longitudeDelta / 2) ** 2;

      return (
        earthRadiusMiles *
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a),
        )
      );
    }

    return profiles.users.flatMap((user) => {
      if (
        user.account.id === viewer.account.id ||
        profiles.isBlocked(user.account.id)
      ) {
        return [];
      }

      const context = createProfileViewerContext(
        viewer,
        user,
        profiles.getFriendshipStatus(
          user.account.id,
        ),
      );

      const majorVisible =
        canViewMajor(context);

      const major = majorVisible
        ? user.profile.major
        : null;

      const academicArea = majorVisible
        ? user.profile.academicArea ?? null
        : null;

      const interestsVisible =
        canViewInterests(context);

      const interests = interestsVisible
        ? user.profile.interests
        : [];

      const hobbies = interestsVisible
        ? user.profile.hobbies ?? []
        : [];

      const roommateVisible =
        canViewRoommate(context);

      const lookingForRoommate =
        roommateVisible &&
        Boolean(user.profile.lookingForRoommate);

      const roommatePreferences =
        lookingForRoommate
          ? user.profile.roommatePreferences ?? []
          : [];

      const clubNames = canViewClubs(context)
        ? user.profile.clubIds
            .map((clubId) =>
              getOrganizationById(clubId)?.name ?? "",
            )
            .filter(Boolean)
        : [];

      const tutoringVisible =
        canViewTutoring(context);

      const tutoringSubjects =
        tutoringVisible &&
        user.profile.offersTutoring
          ? user.profile.tutoringSubjects ?? []
          : [];

      const universityName =
        getAccountUniversityName(user.account);

      const universityShortName =
        getAccountUniversityShortName(
          user.account,
        );

      const nameSearchable = [
        user.profile.displayName,
        user.profile.firstName,
        user.profile.lastName,
        user.profile.username,
      ]
        .join(" ")
        .toLowerCase();

      const universitySearchable = [
        universityName,
        universityShortName,
      ]
        .join(" ")
        .toLowerCase();

      const academicSearchable = [
        major ?? "",
        academicArea ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const interestSearchable = [
        ...interests,
        ...hobbies,
      ]
        .join(" ")
        .toLowerCase();

      const clubSearchable =
        clubNames.join(" ").toLowerCase();

      const discoverySearchable = [
        ...roommatePreferences,
        ...tutoringSubjects,
      ]
        .join(" ")
        .toLowerCase();

      const searchable = [
        nameSearchable,
        universitySearchable,
        academicSearchable,
        interestSearchable,
        clubSearchable,
        discoverySearchable,
      ].join(" ");

      if (
        roommateSearch &&
        !lookingForRoommate
      ) {
        return [];
      }

      if (
        tutoringSearch &&
        tutoringSubjects.length === 0
      ) {
        return [];
      }

      if (tutoringSearchSubject) {
        const normalizedSubjects =
          tutoringSubjects
            .join(" ")
            .toLowerCase();

        const subjectAliases: Record<
          string,
          string[]
        > = {
          cs: ["computer science"],
          coding: ["computer science"],
          programming: ["computer science"],
          english: ["english / writing"],
          writing: ["english / writing"],
          science: ["science"],
          math: ["math"],
          maths: ["math"],
          engineering: ["engineering"],
          business: ["business"],
          language: ["languages"],
          languages: ["languages"],
        };

        const acceptedTerms =
          subjectAliases[tutoringSearchSubject] ??
          [tutoringSearchSubject];

        if (
          !acceptedTerms.some((term) =>
            normalizedSubjects.includes(term),
          )
        ) {
          return [];
        }
      }

      if (
        normalized &&
        !roommateSearch &&
        !tutoringSearch &&
        !searchable.includes(normalized)
      ) {
        return [];
      }

      if (
        tutoringOnly &&
        tutoringSubjects.length === 0
      ) {
        return [];
      }

      if (
        tutoringSubject &&
        !tutoringSubjects.includes(
          tutoringSubject,
        )
      ) {
        return [];
      }

      const personTheme =
        getAccountUniversityTheme(
          user.account,
        );

      const personPrimary =
        personTheme?.primary ?? "#0f172a";

      const personAccent =
        personTheme?.accent ?? "#f1f5f9";

      const sameUniversity =
        getAccountUniversityIdentityKey(
          user.account,
        ) === viewerUniversityIdentityKey;

      const sameCampusNetwork =
        !sameUniversity &&
        Boolean(
          viewerUniversity &&
            personTheme &&
            viewerUniversity.campusNetworkId ===
              personTheme.campusNetworkId,
        );

      const proximityRank = sameUniversity
        ? 0
        : sameCampusNetwork
          ? 1
          : 2;

      const networkDistance =
        personTheme
          ? distanceBetweenNetworks(
              personTheme.campusNetworkId,
            )
          : Number.POSITIVE_INFINITY;

      let searchRank = 0;

      if (
        normalized &&
        !roommateSearch &&
        !tutoringSearch
      ) {
        const normalizedUsername =
          user.profile.username.toLowerCase();

        const normalizedDisplayName =
          user.profile.displayName.toLowerCase();

        if (
          normalizedUsername === normalized ||
          normalizedDisplayName === normalized
        ) {
          searchRank = 0;
        } else if (
          normalizedUsername.startsWith(normalized) ||
          normalizedDisplayName.startsWith(normalized) ||
          nameSearchable.includes(normalized)
        ) {
          searchRank = 1;
        } else if (
          universitySearchable.includes(normalized)
        ) {
          searchRank = 2;
        } else if (
          academicSearchable.includes(normalized)
        ) {
          searchRank = 3;
        } else if (
          interestSearchable.includes(normalized)
        ) {
          searchRank = 4;
        } else if (
          clubSearchable.includes(normalized)
        ) {
          searchRank = 5;
        } else {
          searchRank = 6;
        }
      }

      const matchHint = roommateSearch
        ? "Roommate match"
        : tutoringSearch
          ? tutoringSearchSubject
            ? `${tutoringSearchSubject
                .replace(/\b\w/g, (letter) =>
                  letter.toUpperCase(),
                )} tutor`
            : "Offers tutoring"
          : null;

      return [{
        user,
        major,
        interests,
        hobbies,
        academicArea,
        matchHint,
        searchRank,
        universityShortName,
        personPrimary,
        personAccent,
        proximityRank,
        networkDistance,
      }];
    }).sort((a, b) => {
      if (
        normalized &&
        a.searchRank !== b.searchRank
      ) {
        return a.searchRank - b.searchRank;
      }

      if (a.proximityRank !== b.proximityRank) {
        return a.proximityRank - b.proximityRank;
      }

      if (a.networkDistance !== b.networkDistance) {
        return a.networkDistance - b.networkDistance;
      }

      return a.user.profile.displayName.localeCompare(
        b.user.profile.displayName,
      );
    });
  }, [
    profiles,
    query,
    tutoringOnly,
    tutoringSubject,
    viewer,
  ]);

  return (
    <div className="space-y-5">
      <div className="px-1"><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">People</h1></div>
      <label className="block"><span className="sr-only">Search people</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find friends, classmates, roommates, tutors, and collaborators…" className="w-full rounded-2xl border border-white/80 bg-white/90 px-4 py-3.5 text-sm shadow-sm outline-none focus:ring-2" style={{ caretColor: theme.primary }} /></label>

      <div className="flex flex-wrap items-center gap-2">
        <TactileButton
          type="button"
          selected={tutoringOnly}
          onClick={() => {
            setTutoringOnly(
              (current) => !current,
            );

            if (tutoringOnly) {
              setTutoringSubject(null);
            }
          }}
          className={`rounded-full border px-3 py-2 text-xs font-black ${
            tutoringOnly
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Tutoring
        </TactileButton>

        {tutoringOnly &&
          [
            "Math",
            "Science",
            "English / Writing",
            "Business",
            "Engineering",
            "Languages",
            "Computer Science",
            "Other",
          ].map((subject) => (
            <TactileButton
              key={subject}
              type="button"
              selected={
                tutoringSubject === subject
              }
              onClick={() =>
                setTutoringSubject(
                  tutoringSubject === subject
                    ? null
                    : subject,
                )
              }
              className={`rounded-full border px-3 py-2 text-xs font-bold ${
                tutoringSubject === subject
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {subject}
            </TactileButton>
          ))}
      </div>
      {results.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map(({
        user,
        major,
        interests,
        hobbies,
        academicArea,
        matchHint,
        universityShortName,
        personPrimary,
        personAccent,
      }) => (
        <TactileButton
          key={user.account.id}
          type="button"
          onClick={() =>
            onOpenProfile(user.account.id)
          }
          className="rounded-[1.5rem] border border-white/80 bg-white/90 p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: personPrimary }}
        >
          <div className="flex items-center gap-3">
            <ProfileAvatar
              user={user}
              size="md"
              primaryColor={personPrimary}
              accentColor={personAccent}
            />

            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-950">
                {user.profile.displayName}
              </h2>

              <p className="truncate text-xs text-slate-500">
                @{user.profile.username}
              </p>

              <p
                className="mt-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: personPrimary }}
              >
                {universityShortName}
              </p>
            </div>
          </div>
          {(major || academicArea) && (
            <p className="mt-4 text-xs font-bold text-slate-700">
              {[major, academicArea]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {(interests.length > 0 ||
            hobbies.length > 0) && (
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              aria-label="Visible interests and hobbies"
            >
              {[...interests, ...hobbies]
                .slice(0, 3)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{
                      backgroundColor: personAccent,
                      color: personPrimary,
                    }}
                  >
                    {item}
                  </span>
                ))}
            </div>
          )}

          {matchHint && (
            <p
              className="mt-3 text-[10px] font-black uppercase tracking-wide"
              style={{ color: personPrimary }}
            >
              {matchHint}
            </p>
          )}
        </TactileButton>
      ))}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500">No visible development profiles match this search.</div>}
    </div>
  );
}

