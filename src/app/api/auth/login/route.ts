import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { pin } = await req.json();

  if (pin === process.env.APP_PIN) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("butik_auth", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
