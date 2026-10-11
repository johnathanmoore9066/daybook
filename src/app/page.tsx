import { Suspense } from "react";
import { connection } from "next/server";
import { AreaPanel } from "@/components/AreaPanel";
import { Loading } from "@/components/Loading";
import { Masthead } from "@/components/Masthead";
import { SchoolPanel } from "@/components/SchoolPanel";
import { SetupNeeded } from "@/components/SetupNeeded";
import { TodayBlock } from "@/components/TodayBlock";
import { WeekAgenda } from "@/components/WeekAgenda";
import { WorkPanel } from "@/components/WorkPanel";
import { loadDashboard } from "@/lib/dashboard";
import { StorageNotConfiguredError } from "@/lib/store";

async function Dashboard() {
  await connection();
  let d;
  try {
    d = await loadDashboard();
  } catch (error) {
    if (!(error instanceof StorageNotConfiguredError)) throw error;
    return <SetupNeeded message={error.message} />;
  }

  return (
    <div className="home">
      <div className="home-main">
        <TodayBlock d={d} />
        <WeekAgenda d={d} />
      </div>
      <div className="home-side">
        <AreaPanel d={d} />
        <SchoolPanel d={d} />
        <WorkPanel d={d} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Masthead page="today" />
      <main className="page">
        <Suspense fallback={<Loading label="Opening today's page" />}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}
