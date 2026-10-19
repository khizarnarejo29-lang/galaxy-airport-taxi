import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin/session";

export async function POST() {
  (await cookies()).set({ name: ADMIN_COOKIE, value: "", path: "/admin", maxAge: 0 });
  return new Response(null, { status: 303, headers: { Location: "/admin" } });
}
