import Link from "next/link";

export function SetupNeeded({ message }: { message: string }) {
  return (
    <section className="section setup-needed" role="alert">
      <header className="section-head">
        <h2>Storage isn&apos;t connected</h2>
      </header>
      <p>{message}</p>
      <p>
        In the Vercel dashboard, open this project, choose Storage, create a Blob store set to Private, and connect it.
        Then redeploy. <Link href="/setup">Setup details</Link>
      </p>
    </section>
  );
}
