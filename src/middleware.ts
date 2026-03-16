import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const auth = req.cookies.get("butik_auth")?.value;
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/giris") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (auth !== "1") {
    const url = req.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
