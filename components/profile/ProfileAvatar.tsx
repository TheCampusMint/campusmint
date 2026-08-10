import type { CampusMintUser } from "@/types/profile";

type ProfileAvatarProps = {
  user: CampusMintUser;
  size?: "sm" | "md" | "lg";
  primaryColor: string;
  accentColor: string;
};

const sizes = {
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-base",
  lg: "h-24 w-24 text-2xl sm:h-28 sm:w-28 sm:text-3xl",
};

export function ProfileAvatar({
  user,
  size = "md",
  primaryColor,
  accentColor,
}: ProfileAvatarProps) {
  const initials = user.profile.photo.placeholderId ??
    `${user.profile.firstName.at(0) ?? ""}${user.profile.lastName.at(0) ?? ""}`.toUpperCase();

  return (
    <div
      role="img"
      aria-label={`${user.profile.displayName} avatar placeholder`}
      className={`flex shrink-0 items-center justify-center rounded-full border-4 border-white font-black shadow-sm ${sizes[size]}`}
      style={{ backgroundColor: accentColor, color: primaryColor }}
    >
      {initials}
    </div>
  );
}
