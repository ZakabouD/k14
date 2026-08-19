import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production. Session tokens cannot be safely signed or verified.");
    }
    return new TextEncoder().encode("insecure_development_only_jwt_secret_do_not_use_in_production");
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecretKey());
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getSecretKey(), {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function createSession(adminId: string, userPayload?: any) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const session = await encrypt({ adminId, expires, ...userPayload });

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  const payload = await decrypt(session);
  if (!payload) return null;

  // Apply fallback for master admin session
  if (payload.adminId === "admin") {
    payload.role = "SUPERADMIN";
    payload.name = payload.name || "Administrateur Système";
    payload.email = payload.email || process.env.ADMIN_EMAIL || "admin@example.com";
    payload.permissions = {
      canManagePersonnel: true,
      canManageShifts: true,
      canManageLeaves: true,
      canViewSalaries: true,
      canManageSettings: true
    };
  }

  return payload;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
