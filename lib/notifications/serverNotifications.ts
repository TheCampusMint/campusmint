import type { CampusNotification, CampusNotificationType, NotificationDestination } from '../../types/notification.ts';

export type ServerNotification = {
  id: string; actor_id: string | null; kind: string; payload: Record<string, unknown>;
  created_at: string; read_at: string | null; username: string | null; display_name: string | null;
};

/** Only known destinations are actionable; server payload text is never HTML. */
export function mapServerNotification(row: ServerNotification, recipientId: string): CampusNotification | null {
  let destination: NotificationDestination;
  let type: CampusNotificationType;
  let body: string;
  const name = row.display_name || row.username || 'Someone';
  if (row.kind === 'private_message' && row.actor_id) {
    destination = {scene:'message',userId:row.actor_id}; type = 'private_message'; body = `${name} sent you a message`;
  } else if (['person_follow','follow_request','follow_request_accepted','follow_request_declined'].includes(row.kind) && row.actor_id) {
    destination = {scene:'profile',userId:row.actor_id}; type = row.kind as CampusNotificationType;
    body = row.kind === 'person_follow' ? `${name} followed you` : row.kind === 'follow_request' ? `${name} requested to connect` : row.kind === 'follow_request_accepted' ? `${name} accepted your request` : `${name} declined your request`;
  } else if (['club_invite','club_announcement','group_request_accepted','group_request_denied'].includes(row.kind) && typeof row.payload.organizationId === 'string') {
    destination = {scene:'organization',organizationId:row.payload.organizationId}; type = row.kind as CampusNotificationType;
    body = row.kind === 'club_invite' ? 'Club invitation' : row.kind === 'group_request_accepted' ? 'Club request accepted' : row.kind === 'group_request_denied' ? 'Club request declined' : 'Club update';
  } else if (['event_invite','event_update'].includes(row.kind) && typeof row.payload.eventId === 'string') {
    destination = {scene:'event',eventId:row.payload.eventId}; type = row.kind as CampusNotificationType;
    body = row.kind === 'event_invite' ? 'Event invitation' : 'Event update';
  } else return null;
  return {
    id:row.id, recipientId, type, actor:{kind:'person',id:row.actor_id ?? row.id,userId:row.actor_id,displayName:name},
    body,preview:null,createdAt:row.created_at,readAt:row.read_at,destination,
    soundEvent:type === 'private_message' ? 'direct_message_received' : 'standard_notification',metadata:{},isDevelopment:false,
  };
}
