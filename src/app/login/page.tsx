import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { gateMode } from "@/lib/config";
import { describeDay, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Sign in · Daybook" };

async function DateBlock() {
  await connection();
  const day = describeDay(todayIn());
  return (
    <h1 className="tearoff tearoff-small">
      <span className="tearoff-month">{day.month}</span>
      <span className="tearoff-day">{day.day}</span>
      <span className="tearoff-dow">Daybook</span>
    </h1>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  if (gateMode() === "open") redirect("/");
  return (
    <main className="login">
      <Suspense fallback={<h1 className="tearoff tearoff-small">Daybook</h1>}>
        <DateBlock />
      </Suspense>
      <Suspense fallback={<LoginForm next="/" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
