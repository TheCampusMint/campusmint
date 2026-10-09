import type {CampusMintUser} from './profile';
/** A conversation may reveal a name without granting access to full profile fields. */
export type MessagePeer = {account:{id:string};profile:{displayName:string;username:string}};
export type MessagePerson = CampusMintUser | MessagePeer;
