import { cookies } from "next/headers";
import { adminCookie, adminPassword, createAdminSession, passwordMatches } from "@/lib/admin/session";

const back = (query = "") => new Response(null, { status: 303, headers: { Location: `/admin${query}` } });

export async function POST(request: Request) {
  const expected = adminPassword();
  if (!expected) return back();
  const form = await request.formData().catch(() => null);
  const given = form?.get("password");
  if (typeof given !== "string" || !passwordMatches(given, expected)) {
    // Slows down guessing.
    await new Promise((r) => setTimeout(r, 1500));
    return back("?error=1");
  }
  (await cookies()).set(adminCookie(createAdminSession(), { secure: process.env.NODE_ENV === "production" }));
  return back();
}
