import { CampusAppShell } from "@/components/shell/CampusAppShell";
import { parseCampusAppLocation } from "@/lib/navigation/appLocation";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const initialLocation = parseCampusAppLocation(await searchParams);
  return <CampusAppShell initialLocation={initialLocation} />;
}
