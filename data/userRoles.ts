export const userRoleOptions = [
  { id: "student", label: "Student" },
  { id: "alumni", label: "Alumni" },
  { id: "supporter", label: "Supporter / Fan" },
  { id: "university-admin", label: "University Admin" },
  { id: "local-business", label: "Local Business" },
] as const;

export type UserRole = (typeof userRoleOptions)[number]["id"];

export function getUserRoleLabel(role: UserRole) {
  return userRoleOptions.find((option) => option.id === role)?.label ?? role;
}
