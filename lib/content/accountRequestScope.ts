/** Cancels account reads and rejects late results even when transport ignores abort. */
export function createAccountRequestScope(accountId: string) {
  return { accountId, version: 0, controller: null as AbortController | null };
}
type AccountRequestScope = ReturnType<typeof createAccountRequestScope>;

export function activateAccountRequestScope(scope: AccountRequestScope, accountId: string) {
  scope.controller?.abort();
  scope.controller = null;
  scope.accountId = accountId;
  scope.version += 1;
}

export function beginAccountRequest(scope: AccountRequestScope, accountId: string) {
  if (scope.accountId !== accountId) return null;
  scope.controller?.abort();
  const controller = new AbortController();
  scope.controller = controller;
  const version = ++scope.version;
  return { signal: controller.signal, isCurrent: () => scope.accountId === accountId && scope.version === version && !controller.signal.aborted };
}

export function accountScopedValue<T>(storedAccountId: string, currentAccountId: string, value: T, empty: T): T {
  return storedAccountId === currentAccountId ? value : empty;
}
