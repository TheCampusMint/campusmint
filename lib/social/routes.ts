export const socialRoutes = {
  profile: (username: string) => `/u/${encodeURIComponent(username.toLocaleLowerCase())}`,
  mint: (mintId: string) => `/mint/${encodeURIComponent(mintId)}`,
  createMint: () => "/?section=Mintz&create=1",
} as const;
