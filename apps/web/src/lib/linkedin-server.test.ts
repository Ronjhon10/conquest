import { beforeAll, expect, it, vi } from "vitest";
import {
  createLocalJWKSet,
  EncryptJWT,
  exportJWK,
  generateKeyPair,
  jwtDecrypt,
  SignJWT,
} from "jose";
import { ErrorBody } from "@conquest/contracts";
import { NextRequest } from "next/server";
import sharp from "sharp";
import {
  callbackLinkedin,
  linkedinConfig,
  profileLinkedin,
  startLinkedin,
} from "./linkedin-server";

const env = {
  LINKEDIN_CLIENT_ID: "test-client",
  LINKEDIN_CLIENT_SECRET: "test-client-secret",
  LINKEDIN_COOKIE_SECRET: "test-cookie-encryption-key-at-least-32-characters",
  LINKEDIN_REDIRECT_URI: "http://localhost:3000/api/auth/linkedin/callback",
};
const config = linkedinConfig(env)!;
let signingKey: CryptoKey;
let verifyKey: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  signingKey = keys.privateKey;
  verifyKey = createLocalJWKSet({
    keys: [
      {
        ...(await exportJWK(keys.publicKey)),
        kid: "test",
        alg: "RS256",
        use: "sig",
      },
    ],
  });
});
const startRequest = () =>
  new NextRequest(
    "http://localhost:3000/api/auth/linkedin/start?conference=conf-demo",
  );
async function fixture(tokenChanges: Record<string, unknown> = {}) {
  const start = await startLinkedin(startRequest(), config);
  const flow = start.cookies.get("conquest_linkedin_flow")!.value;
  const { payload } = await jwtDecrypt(flow, config.key);
  const token = await new SignJWT({
    sub: "member-1",
    nonce: payload.nonce,
    ...tokenChanges,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer("https://www.linkedin.com")
    .setAudience("test-client")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).includes("accessToken"))
      return Response.json({
        access_token: "secret-provider-token",
        id_token: token,
      });
    if (String(url).includes("userinfo"))
      return Response.json({
        sub: "member-1",
        name: "Danny Nef",
        picture: "https://media.licdn.com/dms/image/photo",
      });
    throw new Error("Unexpected remote call");
  });
  const request = new NextRequest(
    `http://localhost:3000/api/auth/linkedin/callback?code=provider-code&state=${payload.state}`,
    { headers: { cookie: `conquest_linkedin_flow=${flow}` } },
  );
  return { flow, payload, fetcher, request };
}
it("WEB-21 keeps LinkedIn disabled until all server-only settings are valid", async () => {
  expect(linkedinConfig({})).toBeNull();
  expect(
    linkedinConfig({ ...env, LINKEDIN_COOKIE_SECRET: "short" }),
  ).toBeNull();
  expect(
    linkedinConfig({
      ...env,
      LINKEDIN_REDIRECT_URI: "http://public.example/api/auth/linkedin/callback",
    }),
  ).toBeNull();
  expect(
    linkedinConfig({
      ...env,
      LINKEDIN_REDIRECT_URI: "https://example.com/api/auth/linkedin/callback",
    }),
  ).not.toBeNull();
  expect((await startLinkedin(startRequest(), null)).status).toBe(503);
});
it("OV-4 LinkedIn route errors use the shared error body", async () => {
  const responses = [
    {
      response: await startLinkedin(startRequest(), null),
      status: 503,
      code: "not_configured",
      message:
        "LinkedIn sign-in is not configured. You can still enter your profile manually.",
    },
    {
      response: await startLinkedin(
        new NextRequest("http://localhost:3000/api/auth/linkedin/start"),
        config,
      ),
      status: 400,
      code: "invalid_request",
      message: "Choose a conference before signing in.",
    },
    {
      response: await profileLinkedin(
        new NextRequest(
          "http://localhost:3000/api/auth/linkedin/profile?conference=conf-demo",
        ),
        config,
      ),
      status: 401,
      code: "invalid_import",
      message:
        "Your LinkedIn import expired. Sign in again or enter your details below.",
    },
  ];

  for (const { response, status, code, message } of responses) {
    expect(response.status).toBe(status);
    expect(ErrorBody.parse(await response.json())).toEqual({
      error: { code, message },
    });
  }
});
it("WEB-21 starts OIDC with only openid/profile, unpredictable state, encrypted HttpOnly cookies, and a fixed callback", async () => {
  const first = await startLinkedin(startRequest(), config);
  const second = await startLinkedin(startRequest(), config);
  const url = new URL(first.headers.get("location")!);
  expect(url.origin).toBe("https://www.linkedin.com");
  expect(url.searchParams.get("scope")).toBe("openid profile");
  expect(url.searchParams.get("redirect_uri")).toBe(env.LINKEDIN_REDIRECT_URI);
  expect(url.searchParams.get("state")).not.toBe(
    new URL(second.headers.get("location")!).searchParams.get("state"),
  );
  const cookie = first.cookies.get("conquest_linkedin_flow")!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("lax");
  expect(cookie.path).toBe("/api/auth/linkedin");
  expect(cookie.value).not.toContain(url.searchParams.get("state"));
  expect(first.headers.get("location")).not.toContain(
    env.LINKEDIN_CLIENT_SECRET,
  );
  expect(first.headers.get("cache-control")).toBe("no-store");
  expect(
    (
      await startLinkedin(
        new NextRequest(
          "http://localhost:3000/api/auth/linkedin/start?conference=//evil.example",
        ),
        config,
      )
    ).status,
  ).toBe(400);
});
it("WEB-22 rejects missing, tampered, or mismatched state without exchanging a code", async () => {
  const { request, fetcher } = await fixture();
  const wrongState = new NextRequest(
    request.url.replace(/state=[^&]+/, "state=wrong"),
    { headers: request.headers },
  );
  expect(
    (
      await callbackLinkedin(wrongState, config, { fetch: fetcher, verifyKey })
    ).headers.get("location"),
  ).toContain("linkedin=failed");
  const missingCookie = new NextRequest(request.url);
  expect(
    (
      await callbackLinkedin(missingCookie, config, {
        fetch: fetcher,
        verifyKey,
      })
    ).headers.get("location"),
  ).toBe("http://localhost:3000/auth/linkedin/error");
  expect(fetcher).not.toHaveBeenCalled();
});
it("WEB-22 handles cancelled consent without calling the provider and clears the flow cookie", async () => {
  const { request, fetcher } = await fixture();
  const url = new URL(request.url);
  url.searchParams.set("error", "access_denied");
  const result = await callbackLinkedin(
    new NextRequest(url, { headers: request.headers }),
    config,
    { fetch: fetcher, verifyKey },
  );
  expect(result.headers.get("location")).toBe(
    "http://localhost:3000/c/conf-demo/join?linkedin=cancelled",
  );
  expect(result.cookies.get("conquest_linkedin_flow")?.maxAge).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});
it("WEB-22 validates the signed ID token and subject before importing name/photo, and never persists provider tokens", async () => {
  const { request, fetcher } = await fixture();
  const result = await callbackLinkedin(request, config, {
    fetch: fetcher,
    verifyKey,
  });
  expect(result.headers.get("location")).toBe(
    "http://localhost:3000/c/conf-demo/join?linkedin=connected",
  );
  const cookie = result.cookies.get("conquest_linkedin_profile")!;
  const { payload } = await jwtDecrypt(cookie.value, config.key);
  expect(payload).toMatchObject({
    conference: "conf-demo",
    name: "Danny Nef",
    picture: "https://media.licdn.com/dms/image/photo",
  });
  expect(JSON.stringify(payload)).not.toContain("secret-provider-token");
  expect(JSON.stringify(payload)).not.toContain("provider-code");
  expect(cookie.httpOnly).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("WEB-22 rejects a signed token from another login transaction", async () => {
  const { request, fetcher } = await fixture({ nonce: "another-login" });
  const result = await callbackLinkedin(request, config, {
    fetch: fetcher,
    verifyKey,
  });
  expect(result.headers.get("location")).toContain("linkedin=failed");
  expect(result.cookies.has("conquest_linkedin_profile")).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("WEB-22 rejects untrusted signatures, wrong audiences, and expired tokens", async () => {
  const { request, fetcher } = await fixture();
  for (const token of [
    await new SignJWT({ nonce: "irrelevant" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://www.linkedin.com")
      .setSubject("member-1")
      .setAudience("another-client")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signingKey),
    await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://www.linkedin.com")
      .setSubject("member-1")
      .setAudience("test-client")
      .setIssuedAt()
      .setExpirationTime(1)
      .sign(signingKey),
    "invalid.jwt.signature",
  ]) {
    fetcher.mockResolvedValueOnce(
      Response.json({ access_token: "secret", id_token: token }),
    );
    const result = await callbackLinkedin(request, config, {
      fetch: fetcher,
      verifyKey,
    });
    expect(result.headers.get("location")).toContain("linkedin=failed");
    expect(result.cookies.has("conquest_linkedin_profile")).toBe(false);
  }
});
it("WEB-22 rejects userinfo for a different member and gives a safe retry on provider failure", async () => {
  const { request, fetcher } = await fixture();
  fetcher.mockResolvedValueOnce(
    Response.json({ error: "provider secret text" }, { status: 500 }),
  );
  let result = await callbackLinkedin(request, config, {
    fetch: fetcher,
    verifyKey,
  });
  expect(result.headers.get("location")).toContain("linkedin=failed");
  expect(result.headers.get("location")).not.toContain("provider secret");
  const another = await fixture();
  const tokenResponse = await another.fetcher(
    "https://www.linkedin.com/oauth/v2/accessToken",
  );
  another.fetcher
    .mockResolvedValueOnce(tokenResponse)
    .mockResolvedValueOnce(
      Response.json({ sub: "different-member", name: "Wrong Person" }),
    );
  result = await callbackLinkedin(another.request, config, {
    fetch: another.fetcher,
    verifyKey,
  });
  expect(result.headers.get("location")).toContain("linkedin=failed");
});
async function profileRequest(picture?: string) {
  const { request, fetcher } = await fixture();
  if (picture) {
    const tokenResponse = await fetcher(
      "https://www.linkedin.com/oauth/v2/accessToken",
    );
    fetcher
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce(
        Response.json({ sub: "member-1", name: "Danny Nef", picture }),
      );
  }
  const callback = await callbackLinkedin(request, config, {
    fetch: fetcher,
    verifyKey,
  });
  const cookie = callback.cookies.get("conquest_linkedin_profile")!.value;
  return new NextRequest(
    "http://localhost:3000/api/auth/linkedin/profile?conference=conf-demo",
    { headers: { cookie: `conquest_linkedin_profile=${cookie}` } },
  );
}
it("WEB-23 imports a 256-square JPEG below 40 KB and binds the import to its conference", async () => {
  const request = await profileRequest();
  const image = await sharp({
    create: { width: 500, height: 300, channels: 3, background: "#aa7755" },
  })
    .png()
    .toBuffer();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(new Uint8Array(image), {
        headers: { "Content-Type": "image/png" },
      }),
    );
  const response = await profileLinkedin(request, config, fetcher);
  const data = await response.json();
  expect(data.name).toBe("Danny Nef");
  expect(data.photo.length).toBeLessThanOrEqual(40 * 1024);
  const metadata = await sharp(
    Buffer.from(data.photo.split(",")[1], "base64"),
  ).metadata();
  expect(metadata).toMatchObject({ width: 256, height: 256, format: "jpeg" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  const wrongConference = new NextRequest(
    request.url.replace("conf-demo", "conf-other"),
    { headers: request.headers },
  );
  expect((await profileLinkedin(wrongConference, config, fetcher)).status).toBe(
    401,
  );
});
it("WEB-23 refuses arbitrary photo URLs and oversized streams while preserving the imported name", async () => {
  for (const picture of [
    "http://169.254.169.254/latest/meta-data",
    "https://evil.example/photo",
    "https://media.licdn.com.evil.example/photo",
  ]) {
    const request = await profileRequest(picture);
    const fetcher = vi.fn<typeof fetch>();
    const data = await (await profileLinkedin(request, config, fetcher)).json();
    expect(data).toMatchObject({ name: "Danny Nef", photo: null });
    expect(fetcher).not.toHaveBeenCalled();
  }
  const request = await profileRequest();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(new Uint8Array(5 * 1024 * 1024 + 1), {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
  expect(
    await (await profileLinkedin(request, config, fetcher)).json(),
  ).toMatchObject({ name: "Danny Nef", photo: null });
});
it("WEB-23 refuses missing and altered import cookies without any photo request", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const request = new NextRequest(
    "http://localhost:3000/api/auth/linkedin/profile?conference=conf-demo",
    { headers: { cookie: "conquest_linkedin_profile=tampered" } },
  );
  expect((await profileLinkedin(request, config, fetcher)).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
});
it("WEB-22 rejects an expired transaction cookie before contacting LinkedIn", async () => {
  const expired = await new EncryptJWT({
    conference: "conf-demo",
    purpose: "flow",
    state: "state",
    nonce: "nonce",
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(1)
    .setExpirationTime(2)
    .setIssuer("conquest")
    .setAudience("linkedin-import")
    .encrypt(config.key);
  const fetcher = vi.fn<typeof fetch>();
  const request = new NextRequest(
    "http://localhost:3000/api/auth/linkedin/callback?state=state&code=code",
    { headers: { cookie: `conquest_linkedin_flow=${expired}` } },
  );
  const response = await callbackLinkedin(request, config, {
    fetch: fetcher,
    verifyKey,
  });
  expect(response.headers.get("location")).toBe(
    "http://localhost:3000/auth/linkedin/error",
  );
  expect(response.cookies.get("conquest_linkedin_flow")?.maxAge).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});
