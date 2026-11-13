import React from "react";
import { redirect } from "next/navigation";
import { OptiLuxShell } from "@/components/OptiLuxShell";
import { getSessionUser } from "@/server/api";
import { buildErpState } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const initialData = await buildErpState();

  return <OptiLuxShell initialData={initialData} currentUser={user} />;
}
