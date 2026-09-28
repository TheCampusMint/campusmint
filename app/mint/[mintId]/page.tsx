/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { publicMint } from "@/lib/sharing/publicContent";
import { SharedItem } from "@/components/sharing/SharedItem";
export const dynamic = "force-dynamic";
export const metadata = { title:"Shared Mint", robots:{index:false,follow:false} };
export default async function MintPage({params}:{params:Promise<{mintId:string}>}) {
  const {mintId} = await params;
  const mint = await publicMint(mintId);
  if (!mint) notFound();
  return <SharedItem><header><p className="font-semibold">{mint.author}</p><time className="text-xs text-[var(--app-text-secondary)]" dateTime={mint.createdAt}>{new Date(mint.createdAt).toLocaleDateString()}</time></header>
    {mint.caption && <p className="whitespace-pre-wrap break-words text-lg">{mint.caption}</p>}
    {mint.media.map(media=>media.url && (media.type === "video" ? <video key={media.id} controls playsInline preload="metadata" src={media.url} className="mx-auto max-h-[75dvh] max-w-full rounded-2xl object-contain"/> : <img key={media.id} src={media.url} alt="Post attachment" width={media.width ?? undefined} height={media.height ?? undefined} className="mx-auto h-auto max-h-[75dvh] max-w-full rounded-2xl object-contain"/>))}
    {mint.poll && <section aria-label="Poll"><h1 className="font-bold">{mint.poll.question}</h1><ul className="mt-3 space-y-2">{mint.poll.options.map(option=><li key={option.id} className="rounded-2xl bg-[var(--app-surface-elevated)] px-4 py-3">{option.label}</li>)}</ul></section>}
  </SharedItem>;
}
