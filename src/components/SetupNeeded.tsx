import Link from "next/link";

export function SetupNeeded({ message }: { message: string }) {
  return (
    <section className="section setup-needed" role="alert">
      <header className="section-head">
        <h2>Storage isn&apos;t working</h2>
      </header>
      <p>{message}</p>
      <p>
        <Link href="/setup">Setup</Link> lists the Blob settings this deployment can see. Settings changed in Vercel only
        apply to deployments made after the change, so redeploy once they look right.
      </p>
    </section>
  );
}
