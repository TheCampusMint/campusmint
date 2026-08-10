import type { DiscoverySource, HousingEntity } from "@/types/discovery";

const tamuHousingSource: DiscoverySource = {
  type: "university_official", label: "Texas A&M Residence Life",
  url: "https://reslife.tamu.edu/housing-options/", lastVerifiedAt: "2026-08-08", isDevelopment: false,
};
const blinnHousingSource: DiscoverySource = {
  type: "university_official", label: "Blinn College Housing and Residence Life",
  url: "https://www2.blinn.edu/housing/index.html", lastVerifiedAt: "2026-08-08", isDevelopment: false,
};
const developmentSource: DiscoverySource = {
  type: "development", label: "Campus Mint development dataset", url: null, lastVerifiedAt: null, isDevelopment: true,
};
const zeroCampusMintReviews = { rating: null, reviewCount: 0 } as const;

export const housingEntities: HousingEntity[] = [
  {
    id: "housing-tamu-clements", entityId: "h1000000-0000-4000-8000-000000000001",
    universityId: "tamu", accessibleUniversityIds: ["tamu"], campusId: "tamu",
    campusName: "Texas A&M · College Station", name: "Clements Hall", address: null,
    description: "An official Texas A&M Residence Life housing option. Room details and current rates should be confirmed on the official site.",
    scope: "on_campus", housingType: "residence_hall",
    website: "https://reslife.tamu.edu/housing-options/", phone: null, distanceMiles: null, coordinates: null,
    units: [], rates: [], amenities: [], capacity: null, restrictions: [], petPolicy: null,
    parking: null, furnished: null, photos: [], externalReviews: null,
    campusMintReviews: zeroCampusMintReviews, source: tamuHousingSource, status: "open",
  },
  {
    id: "housing-tamu-gardens", entityId: "h1000000-0000-4000-8000-000000000002",
    universityId: "tamu", accessibleUniversityIds: ["tamu"], campusId: "tamu",
    campusName: "Texas A&M · College Station", name: "The Gardens Apartments", address: null,
    description: "An official Texas A&M university-apartment option. Eligibility and current rates should be confirmed with Residence Life.",
    scope: "on_campus", housingType: "university_apartment",
    website: "https://reslife.tamu.edu/housing-options/", phone: null, distanceMiles: null, coordinates: null,
    units: [], rates: [], amenities: [], capacity: null,
    restrictions: ["Official eligibility restrictions apply; confirm with Texas A&M Residence Life."],
    petPolicy: null, parking: null, furnished: null, photos: [], externalReviews: null,
    campusMintReviews: zeroCampusMintReviews, source: tamuHousingSource, status: "open",
  },
  {
    id: "housing-blinn-beazley", entityId: "h2000000-0000-4000-8000-000000000001",
    universityId: "blinn", accessibleUniversityIds: ["blinn"], campusId: "blinn-brenham",
    campusName: "Blinn College · Brenham", name: "Beazley Dormitories", address: "902 College Ave, Brenham, TX 77833",
    description: "Official Blinn-Brenham on-campus housing. Blinn is the only Blinn campus with on-campus residence life.",
    scope: "on_campus", housingType: "residence_hall",
    website: "https://www2.blinn.edu/housing/index.html", phone: "979-830-4461", distanceMiles: null, coordinates: null,
    units: [{ id: "unit-blinn-beazley-2bed", name: "2-bed dormitory", bedroomCount: 2, bathroomCount: null, occupantsPerBedroom: 2, furnished: null }],
    rates: [{ id: "rate-blinn-beazley-2026", unitType: "2-bed dormitory", termLabel: "Fall 2026–Spring 2027", amount: 2058, currency: "USD", cadence: "semester", sourceUrl: "https://www2.blinn.edu/housing/index.html" }],
    amenities: [], capacity: 42, restrictions: ["Male housing"], petPolicy: null, parking: null,
    furnished: null, photos: [], externalReviews: null, campusMintReviews: zeroCampusMintReviews,
    source: blinnHousingSource, status: "open",
  },
  {
    id: "housing-blinn-park", entityId: "h2000000-0000-4000-8000-000000000002",
    universityId: "blinn", accessibleUniversityIds: ["blinn"], campusId: "blinn-brenham",
    campusName: "Blinn College · Brenham", name: "Blinn College Park Apartments", address: "902 College Ave, Brenham, TX 77833",
    description: "Official Blinn-Brenham apartment housing with published unit configurations and per-semester rates.",
    scope: "on_campus", housingType: "university_apartment",
    website: "https://www2.blinn.edu/housing/index.html", phone: "979-830-4461", distanceMiles: null, coordinates: null,
    units: [
      { id: "unit-blinn-park-4-2", name: "4-bed / 2-bath", bedroomCount: 4, bathroomCount: 2, occupantsPerBedroom: 1, furnished: null },
      { id: "unit-blinn-park-2-1", name: "2-bed / 1-bath", bedroomCount: 2, bathroomCount: 1, occupantsPerBedroom: 1, furnished: null },
    ],
    rates: [{ id: "rate-blinn-park-2026", unitType: "2-bed or 4-bed apartment", termLabel: "Fall 2026–Spring 2027", amount: 3741, currency: "USD", cadence: "semester", sourceUrl: "https://www2.blinn.edu/housing/index.html" }],
    amenities: [], capacity: 336, restrictions: [], petPolicy: null, parking: null,
    furnished: null, photos: [], externalReviews: null, campusMintReviews: zeroCampusMintReviews,
    source: blinnHousingSource, status: "open",
  },
  {
    id: "housing-dev-off-campus", entityId: "hd000000-0000-4000-8000-000000000001",
    universityId: null, accessibleUniversityIds: ["tamu", "blinn"], campusId: "bryan-college-station",
    campusName: "Bryan–College Station", name: "Off-Campus Apartment (Development Example)",
    address: "Development-only property — not a live listing",
    description: "A layout-only property record. Connect an authorized feed or Google Places for real business metadata.",
    scope: "off_campus", housingType: "apartment", website: null, phone: null,
    distanceMiles: null, coordinates: null, units: [], rates: [], amenities: [], capacity: null,
    restrictions: [], petPolicy: null, parking: null, furnished: null, photos: [],
    externalReviews: null, campusMintReviews: zeroCampusMintReviews, source: developmentSource, status: "open",
  },
];
