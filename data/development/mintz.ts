import { getCampusNetworkForUniversity } from "@/data/campusNetworks";
import { createExpiresAt, EVENT_CONTENT_DURATION_HOURS } from "@/lib/content/expiration";
import type { Mint } from "@/types/mint";

export const DEVELOPMENT_MINT_REFERENCE_TIME = 1_786_381_200_000;

function networkId(universityId: "tamu" | "blinn") {
  const network = getCampusNetworkForUniversity(universityId);
  if (!network) throw new Error(`Missing development Campus Network for ${universityId}.`);
  return network.id;
}

export function createDevelopmentMintz(referenceTime: number): Mint[] {
  const createdAt = (hoursAgo: number) => new Date(referenceTime - hoursAgo * 60 * 60 * 1000).toISOString();
  const mayaCreatedAt = createdAt(4);
  const jordanCreatedAt = createdAt(3);
  const eventCreatedAt = createdAt(2);
  const clubCreatedAt = createdAt(1);

  return [
    {
      id: "dev-mint-maya-campus",
      publishFormat: "mint",
      authorId: "demo-seller-tamu",
      universityId: "tamu",
      campusNetworkId: networkId("tamu"),
      contentType: "image",
      postType: "personal",
      media: [{ id: "dev-media-maya-1", type: "image", url: null, thumbnailUrl: null, width: null, height: null, durationSeconds: null, order: 0, isDevelopmentPlaceholder: true }],
      caption: "Development Mint: a fictional campus photo placeholder used to test the permanent social post architecture.",
      hashtags: ["campuslife", "tamu"],
      mentions: [],
      taggedUserIds: ["demo-tamu-jordan"],
      location: { source: "custom", entityId: null, label: "Texas A&M campus area (development placeholder)", details: null },
      music: null,
      createdAt: mayaCreatedAt,
      updatedAt: mayaCreatedAt,
      expiresAt: null,
      commentsEnabled: true,
      likesVisible: true,
      eventData: null,
      status: "active",
      privacy: "account",
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      archivedAt: null,
      isDevelopment: true,
    },
    {
      id: "dev-mint-jordan-private",
      publishFormat: "mint",
      authorId: "demo-tamu-jordan",
      universityId: "tamu",
      campusNetworkId: networkId("tamu"),
      contentType: "text",
      postType: "personal",
      media: [],
      caption: "Private development Mint used to verify that captions and engagement never leak to unconnected viewers.",
      hashtags: ["robotics"],
      mentions: [],
      taggedUserIds: [],
      location: null,
      music: null,
      createdAt: jordanCreatedAt,
      updatedAt: jordanCreatedAt,
      expiresAt: null,
      commentsEnabled: true,
      likesVisible: false,
      eventData: null,
      status: "active",
      privacy: "account",
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      archivedAt: null,
      isDevelopment: true,
    },
    {
      id: "dev-mint-avery-event",
      publishFormat: "mint",
      authorId: "demo-seller-blinn",
      universityId: "blinn",
      campusNetworkId: networkId("blinn"),
      contentType: "text",
      postType: "event",
      media: [],
      caption: "Development Event Mint linked to the existing Campus Mint Event record.",
      hashtags: ["event", "campusnetwork"],
      mentions: [],
      taggedUserIds: [],
      location: { source: "event", entityId: "aggie-kickoff-tailgate", label: "Existing Campus Mint Event", details: null },
      music: null,
      createdAt: eventCreatedAt,
      updatedAt: eventCreatedAt,
      expiresAt: createExpiresAt(eventCreatedAt, EVENT_CONTENT_DURATION_HOURS, EVENT_CONTENT_DURATION_HOURS),
      commentsEnabled: true,
      likesVisible: true,
      eventData: { eventId: "aggie-kickoff-tailgate", title: null, eventStartAt: null, eventEndAt: null, timeZone: "America/Chicago", location: null, locationDetails: null, description: null },
      status: "active",
      privacy: "public",
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      archivedAt: null,
      isDevelopment: true,
    },
    {
      id: "dev-mint-blinn-coding-official",
      publishFormat: "mint",
      authorId: "current-demo-student",
      universityId: "blinn",
      campusNetworkId: networkId("blinn"),
      contentType: "text",
      postType: "club",
      media: [],
      caption: "Development Club Mint: this official club update references the Coding Circle organization without copying its profile data.",
      hashtags: ["coding", "clubs"],
      mentions: [],
      taggedUserIds: [],
      location: null,
      music: null,
      createdAt: clubCreatedAt,
      updatedAt: clubCreatedAt,
      expiresAt: null,
      commentsEnabled: true,
      likesVisible: true,
      eventData: null,
      organizationId: "dev-blinn-coding-circle",
      taggedOrganizationIds: [],
      organizationAudience: "public",
      status: "active",
      privacy: "public",
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      archivedAt: null,
      isDevelopment: true,
    },
  ];
}

export function getDevelopmentMintById(mintId: string, referenceTime = Date.now()) {
  return createDevelopmentMintz(referenceTime).find((mint) => mint.id === mintId) ?? null;
}
