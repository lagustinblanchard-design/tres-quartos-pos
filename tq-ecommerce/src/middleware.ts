import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_PATHS = ["/admin"];
const VENDOR_PATHS = ["/admin/pos", "/admin/pedidos", "/admin/facturacion"];
const AUTH_PATHS = ["/cuenta", "/checkout"];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;

  const isAdminPath = ADMIN_PATHS.some((p) => path.startsWith(p));
  const isAuthPath = AUTH_PATHS.some((p) => path.startsWith(p));

  if (!session && (isAdminPath || isAuthPath)) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (session && isAdminPath) {
    const role = session.user?.role;
    const isVendorOnly = VENDOR_PATHS.some((p) => path.startsWith(p));

    if (role === "CLIENTE") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    if (role === "VENDEDOR" && !isVendorOnly) {
      return NextResponse.redirect(new URL("/admin/pos", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
