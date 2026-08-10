"use client";

import {
  userRoleOptions,
  type UserRole,
} from "@/data/userRoles";

type DeveloperRoleSwitcherProps = {
  selectedRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  primaryColor: string;
  secondaryColor: string;
};

export function DeveloperRoleSwitcher({
  selectedRole,
  onRoleChange,
  primaryColor,
  secondaryColor,
}: DeveloperRoleSwitcherProps) {
  return (
    <label
      className="flex min-w-0 flex-col gap-1 text-xs font-semibold"
      style={{ color: secondaryColor }}
    >
      <span className="opacity-85">Dev: Role</span>
      <select
        value={selectedRole}
        onChange={(event) => onRoleChange(event.target.value as UserRole)}
        className="w-44 max-w-full rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          backgroundColor: secondaryColor,
          borderColor: secondaryColor,
          color: primaryColor,
          outlineColor: secondaryColor,
        }}
      >
        {userRoleOptions.map((role) => (
          <option key={role.id} value={role.id}>
            {role.label}
          </option>
        ))}
      </select>
    </label>
  );
}
