import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RootRedirect } from "./root-redirect";

export default async function RootPage() {
  const hasSession = (await cookies()).has("edunest_token");
  if (!hasSession) redirect("/login");
  return <RootRedirect />;
}
