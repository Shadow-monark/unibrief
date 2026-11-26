import { AskCampusApp } from "@/components/AskCampusApp";
import { getDbState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialState = await getDbState();

  return <AskCampusApp initialState={initialState} />;
}
