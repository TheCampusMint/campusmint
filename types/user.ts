import type { UniversityId } from "@/data/universities";
import type { UserRole } from "@/data/userRoles";

export type TemporaryUser = {
  id: string;
  firstName: string;
  universityId: UniversityId;
  role: UserRole;
  major: string;
  graduationYear: number;
  verifiedStudent?: boolean;
};
