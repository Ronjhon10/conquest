import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  EncryptJWT,
  jwtDecrypt,
  jwtVerify,
  createRemoteJWKSet,
  type JWTVerifyGetKey,
} from "jose";
import { errorBody } from "@conquest/contracts";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

// This module is only imported by Server Components and Route Handlers.
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const ISSUER = "https://www.linkedin.com";
const FLOW_COOKIE = "conquest_linkedin_flow";
const PROFILE_COOKIE = "conquest_linkedin_profile";
const COOKIE_PATH = "/api/auth/linkedin";
const TTL = 10 * 60;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const jwks = createRemoteJWKSet(
  new URL("https://www.linkedin.com/oauth/openid/jwks"),
);

type Config = {
  clientId: string;
  clientSecret: string;
  redirect: URL;
  key: Uint8Array;
};
type Flow = { conference: string; state: string; nonce: string };
type ImportedProfile = {
  conference: string;
  name: string;
  picture: string | null;
};
type Dependencies = { fetch: typeof fetch; verifyKey: JWTVerifyGetKey };
const defaults: Dependencies = {
  fetch: (...args) => fetch(...args),
  verifyKey: jwks,
};

export function linkedinConfig(
  env: Record<string, string | undefined> = process.env,
): Config | null {
  const clientId = env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = env.LINKEDIN_CLIENT_SECRET?.trim();
  const secret = env.LINKEDIN_COOKIE_SECRET;
  if (!clientId || !clientSecret || !secret || secret.length < 32) return null;
  try {
    const redirect = new URL(env.LINKEDIN_REDIRECT_URI ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      redirect.hostname,
    );
    if (
      (redirect.protocol !== "https:" &&
        !(local && redirect.protocol === "http:")) ||
      redirect.username ||
      redirect.password ||
      redirect.search ||
      redirect.hash ||
      redirect.pathname !== "/api/auth/linkedin/callback"
    )
      return null;
    return {
      clientId,
      clientSecret,
      redirect,
      key: createHash("sha256").update(secret).digest(),
    };
  } catch {
    return null;
  }
}

export function linkedinAvailable(): boolean {
  return linkedinConfig() !== null;
}

function cookieOptions(config: Config) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.redirect.protocol === "https:",
    path: COOKIE_PATH,
    maxAge: TTL,
  };
}
function noCache(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
function signupUrl(config: Config, conference: string, status: string) {
  const url = new URL(
    `/c/${encodeURIComponent(conference)}/join`,
    config.redirect.origin,
  );
  url.searchParams.set("linkedin", status);
  return url;
}
function validConference(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}
async function seal(
  config: Config,
  purpose: string,
  data: Flow | ImportedProfile,
) {
  return new EncryptJWT({ ...data, purpose })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .setIssuer("conquest")
    .setAudience("linkedin-import")
    .encrypt(config.key);
}
async function unseal(
  config: Config,
  purpose: string,
  value: string | undefined,
) {
  if (!value || value.length > 4096) return null;
  try {
    const { payload } = await jwtDecrypt(value, config.key, {
      issuer: "conquest",
      audience: "linkedin-import",
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
      requiredClaims: ["exp", "iat"],
    });
    return payload.purpose === purpose && validConference(payload.conference)
      ? payload
      : null;
  } catch {
    return null;
  }
}
function equalState(actual: string | null, expected: string) {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function unavailable() {
  return noCache(
    NextResponse.json(
      errorBody(
        "not_configured",
        "LinkedIn sign-in is not configured. You can still enter your profile manually.",
      ),
      { status: 503 },
    ),
  );
}

export async function startLinkedin(
  request: NextRequest,
  config = linkedinConfig(),
) {
  if (!config) return unavailable();
  const conference = request.nextUrl.searchParams.get("conference");
  if (!validConference(conference))
    return noCache(
      NextResponse.json(
        errorBody("invalid_request", "Choose a conference before signing in."),
        { status: 400 },
      ),
    );
  const flow: Flow = {
    conference,
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
  };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirect.href,
    scope: "openid profile",
    state: flow.state,
    nonce: flow.nonce,
  }).toString();
  const response = noCache(NextResponse.redirect(url, 303));
  response.cookies.set(
    FLOW_COOKIE,
    await seal(config, "flow", flow),
    cookieOptions(config),
  );
  // A fresh attempt must never reuse a profile from a previous LinkedIn account.
  response.cookies.set(PROFILE_COOKIE, "", {
    ...cookieOptions(config),
    maxAge: 0,
  });
  return response;
}

function photoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1800) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    // Only LinkedIn's photo CDN. Never proxy arbitrary URLs, including redirects.
    return url.hostname.endsWith(".licdn.com") ||
      url.hostname.endsWith(".licdn-ei.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function callbackLinkedin(
  request: NextRequest,
  config = linkedinConfig(),
  deps = defaults,
) {
  if (!config) return unavailable();
  const data = await unseal(
    config,
    "flow",
    request.cookies.get(FLOW_COOKIE)?.value,
  );
  const clearFlow = (response: NextResponse) => {
    response.cookies.set(FLOW_COOKIE, "", {
      ...cookieOptions(config),
      maxAge: 0,
    });
    return noCache(response);
  };
  if (
    !data ||
    typeof data.state !== "string" ||
    typeof data.nonce !== "string" ||
    !equalState(request.nextUrl.searchParams.get("state"), data.state)
  ) {
    const destination = data
      ? signupUrl(config, data.conference as string, "failed")
      : new URL("/auth/linkedin/error", config.redirect.origin);
    return clearFlow(NextResponse.redirect(destination, 303));
  }
  const conference = data.conference as string;
  const failed = (status: string) =>
    clearFlow(
      NextResponse.redirect(signupUrl(config, conference, status), 303),
    );
  if (request.nextUrl.searchParams.has("error")) return failed("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 4096) return failed("failed");
  try {
    const tokenResponse = await deps.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirect.href,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) return failed("failed");
    const tokens = await tokenResponse.json();
    if (
      typeof tokens.id_token !== "string" ||
      typeof tokens.access_token !== "string"
    )
      return failed("failed");
    const { payload } = await jwtVerify(tokens.id_token, deps.verifyKey, {
      issuer: ISSUER,
      audience: config.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (
      payload.nonce !== data.nonce ||
      !payload.sub ||
      (Array.isArray(payload.aud) &&
        payload.aud.length > 1 &&
        payload.azp !== config.clientId)
    )
      return failed("failed");
    const userResponse = await deps.fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!userResponse.ok) return failed("failed");
    const user = await userResponse.json();
    if (
      user.sub !== payload.sub ||
      typeof user.name !== "string" ||
      !user.name.trim()
    )
      return failed("failed");
    const profile: ImportedProfile = {
      conference,
      name: user.name.trim().slice(0, 200),
      picture: photoUrl(user.picture),
    };
    const response = clearFlow(
      NextResponse.redirect(signupUrl(config, conference, "connected"), 303),
    );
    response.cookies.set(
      PROFILE_COOKIE,
      await seal(config, "profile", profile),
      cookieOptions(config),
    );
    // Provider tokens are never persisted or returned to the browser.
    return response;
  } catch {
    return failed("failed");
  }
}

async function importPhoto(
  url: string,
  fetcher: typeof fetch,
): Promise<string | null> {
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/") ||
      !response.body
    )
      return null;
    if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES)
      return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const image = sharp(Buffer.concat(chunks), {
      limitInputPixels: 16_000_000,
      animated: false,
    })
      .rotate()
      .resize(256, 256, { fit: "cover", position: "centre" })
      .flatten({ background: "#ffffff" });
    for (const quality of [85, 65, 45, 25]) {
      const bytes = await image.clone().jpeg({ quality }).toBuffer();
      const photo = `data:image/jpeg;base64,${bytes.toString("base64")}`;
      if (photo.length <= 40 * 1024) return photo;
    }
    return null;
  } catch {
    return null;
  }
}

export async function profileLinkedin(
  request: NextRequest,
  config = linkedinConfig(),
  fetcher: typeof fetch = defaults.fetch,
) {
  if (!config) return unavailable();
  const data = await unseal(
    config,
    "profile",
    request.cookies.get(PROFILE_COOKIE)?.value,
  );
  if (
    !data ||
    data.conference !== request.nextUrl.searchParams.get("conference") ||
    typeof data.name !== "string"
  ) {
    return noCache(
      NextResponse.json(
        errorBody(
          "invalid_import",
          "Your LinkedIn import expired. Sign in again or enter your details below.",
        ),
        { status: 401 },
      ),
    );
  }
  const picture = photoUrl(data.picture);
  const photo = picture ? await importPhoto(picture, fetcher) : null;
  return noCache(
    NextResponse.json({
      name: data.name,
      photo,
      photoNotice: photo
        ? null
        : "Your LinkedIn photo couldn't be imported. Choose a photo below or use your class character.",
    }),
  );
}
