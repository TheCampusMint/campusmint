export async function sharePublicItem(title: string, path: string) {
  const url = new URL(path, window.location.origin).href;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return "Shared"; }
    await navigator.clipboard.writeText(url); return "Link copied";
  } catch (error) { return error instanceof Error && error.name === "AbortError" ? "" : "Couldn’t share. Try again."; }
}
