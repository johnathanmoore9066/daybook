import Link from "next/link";
import { logout } from "@/app/actions";
import { gateMode } from "@/lib/config";

type Page = "today" | "area" | "setup";

export function Masthead({ page }: { page: Page }) {
  const current = (p: Page) => (p === page ? ("page" as const) : undefined);
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="wordmark" aria-current={current("today")}>
          Daybook
        </Link>
        <nav aria-label="Main" className="masthead-nav">
          <ul>
            <li>
              <Link href="/#week">Week</Link>
            </li>
            <li>
              <Link href="/#school">School</Link>
            </li>
            <li>
              <Link href="/#work">Work</Link>
            </li>
            <li>
              <Link href="/area" aria-current={current("area")}>
                Area report
              </Link>
            </li>
            <li>
              <Link href="/setup" aria-current={current("setup")}>
                Setup
              </Link>
            </li>
          </ul>
        </nav>
        {gateMode() === "locked" && (
          <form action={logout} className="masthead-lock">
            <button type="submit" className="link-button">
              Lock
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
