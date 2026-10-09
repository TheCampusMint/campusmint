import {ProfileAvatar} from '@/components/profile/ProfileAvatar';
import type {MessagePerson} from '@/types/messagePerson';
import type {UniversityTheme} from '@/data/universities';
export function MessageAvatar({user,theme,size='sm'}:{user:MessagePerson;theme:UniversityTheme;size?:'sm'|'md'}) {
  if('privacy' in user)return <ProfileAvatar user={user} size={size} primaryColor={theme.primary} accentColor={theme.accent}/>;
  return <span role="img" aria-label={`${user.profile.displayName} avatar`} className={`grid shrink-0 place-items-center rounded-full bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)] ${size==='md'?'h-14 w-14':'h-10 w-10'}`}>{user.profile.displayName.slice(0,1).toUpperCase()}</span>;
}
