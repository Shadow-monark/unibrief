import { AskCampusApp } from "@/components/AskCampusApp";
import { getEngineStatus } from "@/lib/ai";
import { getDbState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialState = await getDbState();
  const initialEngineStatus = getEngineStatus();

  return (
    <AskCampusApp
      initialState={initialState}
      initialEngineStatus={initialEngineStatus}
    />
  );
}
