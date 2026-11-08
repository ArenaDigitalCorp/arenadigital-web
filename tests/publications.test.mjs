import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescriptModule } from "./helpers/load-typescript-module.mjs";
const { publicationStatus } = loadTypescriptModule(
  "src/modules/publications/model.ts",
);
const arena = "f9200000-0000-4000-8000-000000000001";
const row = {
  id: "f9300000-0000-4000-8000-000000000001",
  arena_id: arena,
  kind: "ad",
  title: "Campanha",
  description: "Texto",
  image_url: "https://example.invalid/a.png",
  cta_kind: "none",
  cta_url: null,
  cta_label: null,
  starts_at: "2026-11-07T12:00:00Z",
  ends_at: null,
  active: false,
  archived: false,
  blocked_reason: null,
  revision: 2,
  priority: 0,
  city_id: null,
  sport_id: null,
  created_at: "2026-11-07T12:00:00Z",
};
function subject({
  denyArena = false,
  denyPlatform = false,
  rpcError = null,
  cacheError = false,
} = {}) {
  const calls = [];
  const authorizationCalls = [];
  const loaded = loadTypescriptModule("src/modules/publications/actions.ts", {
    "./authorization": {
      authorizePublicationScope: async (arenaId, operation) => {
        authorizationCalls.push({ arenaId, operation });
        if (arenaId && denyArena) throw Error("Sem acesso à arena");
        if (!arenaId && denyPlatform) throw Error("Sem acesso à plataforma");
      },
    },
    "@/lib/server-auth": {
      assertArenaAdminAccess: async () => {
        if (denyArena) throw Error("Sem acesso à arena");
      },
      assertPlatformAdminAccess: async () => {
        if (denyPlatform) throw Error("Sem acesso à plataforma");
      },
    },
    "@/lib/supabase/server": {
      createSupabaseServerClient: async () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: row, error: rpcError };
        },
      }),
    },
    "next/cache": {
      revalidatePath: () => {
        if (cacheError) throw Error("Cache offline");
      },
    },
  });
  return { ...loaded, calls, authorizationCalls };
}
const input = {
  action: "pause",
  id: row.id,
  arenaId: arena,
  revision: 2,
  payload: {},
};
test("publication states prioritize moderation, archive and withdrawal over dates", () => {
  const now = Date.parse("2026-11-07T13:00:00Z");
  assert.equal(publicationStatus(row, now), "Pausada");
  assert.equal(publicationStatus({ ...row, active: true }, now), "Publicada");
  assert.equal(
    publicationStatus(
      { ...row, active: true, starts_at: "2026-11-08T12:00:00Z" },
      now,
    ),
    "Agendada",
  );
  assert.equal(
    publicationStatus(
      { ...row, active: true, ends_at: "2026-11-07T13:00:00Z" },
      now,
    ),
    "Encerrada",
  );
  assert.equal(publicationStatus({ ...row, archived: true }, now), "Arquivada");
  assert.equal(
    publicationStatus(
      { ...row, archived: true, blocked_reason: "Review" },
      now,
    ),
    "Bloqueada",
  );
});
test("arena authorization precedes mutation and prevents RPC on denial", async () => {
  const s = subject({ denyArena: true });
  assert.equal((await s.changePublication(input)).success, false);
  assert.equal(s.calls.length, 0);
});
test("moderation requires additional platform authorization", async () => {
  const s = subject({ denyPlatform: true });
  assert.equal(
    (await s.changePublication({ ...input, action: "block" })).success,
    false,
  );
  assert.equal(s.calls.length, 0);
  assert.equal((await s.changePublication(input)).success, true);
});
test("committed withdrawal remains successful if cache revalidation fails", async () => {
  const s = subject({ cacheError: true });
  const result = await s.changePublication(input);
  assert.equal(result.success, true);
  assert.equal(result.data.active, false);
  assert.equal(s.calls[0].args.p_arena_id, arena);
  assert.equal(s.calls[0].args.p_revision, 2);
});
test("mutation error never produces a success response", async () => {
  assert.equal(
    (
      await subject({
        rpcError: { message: "Conflito de edição" },
      }).changePublication(input)
    ).success,
    false,
  );
});
test("caller cannot supply an actor or a new scope outside the validated envelope", async () => {
  const s = subject();
  assert.equal(
    (await s.changePublication({ ...input, actorId: row.id })).success,
    false,
  );
  assert.equal(s.calls.length, 0);
});

test("platform moderator can read arena publications without general arena membership", async () => {
  const calls = [];
  const { authorizePublicationScope } = loadTypescriptModule(
    "src/modules/publications/authorization.ts",
    {
      "@/lib/server-auth": {
        requireAuthenticatedDbUser: async () => ({ dbUserId: "admin" }),
        getPlatformAccessLevel: async () => "platform_admin",
        assertPlatformAdminAccess: async () => calls.push("platform"),
        assertArenaAdminAccess: async () => {
          throw Error("No arena membership");
        },
      },
    },
  );
  await authorizePublicationScope(arena);
  assert.deepEqual(calls, ["platform"]);
});
test("ordinary manager must pass arena membership and cannot gain platform scope", async () => {
  const calls = [];
  const { authorizePublicationScope } = loadTypescriptModule(
    "src/modules/publications/authorization.ts",
    {
      "@/lib/server-auth": {
        requireAuthenticatedDbUser: async () => ({ dbUserId: "manager" }),
        getPlatformAccessLevel: async () => null,
        assertPlatformAdminAccess: async () => {
          throw Error("Forbidden");
        },
        assertArenaAdminAccess: async (id) => {
          calls.push(id);
          if (id !== arena) throw Error("Forbidden");
        },
      },
    },
  );
  await authorizePublicationScope(arena);
  await assert.rejects(authorizePublicationScope(null), /Forbidden/);
  await assert.rejects(authorizePublicationScope(row.id), /Forbidden/);
  assert.deepEqual(calls, [arena, row.id]);
});
class Denied extends Error {
  status = 403;
}
function uploadSubject({ denied = false, failStorage = false } = {}) {
  const calls = [];
  const { POST } = loadTypescriptModule(
    "src/app/api/publications/upload/route.ts",
    {
      "@/modules/publications/authorization": {
        authorizePublicationScope: async (id, operation) => {
          calls.push(["authorize", id, operation]);
          if (denied) throw new Denied("Forbidden");
        },
      },
      "@/lib/server-auth": { AuthorizationError: Denied },
      "@/lib/r2Client": {
        uploadToR2: async (_buffer, key, type) => {
          calls.push(["upload", key, type]);
          if (failStorage) throw Error("private storage diagnostic");
          return "https://example.invalid/upload.png";
        },
      },
    },
  );
  return { POST, calls };
}
function uploadRequest({
  arenaId = arena,
  bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  name = "a.png",
  type = "image/png",
} = {}) {
  const form = new FormData();
  if (arenaId) form.set("arenaId", arenaId);
  form.set("file", new File([bytes], name, { type }));
  return new Request("http://localhost/api/publications/upload", {
    method: "POST",
    body: form,
  });
}
test("publication upload checks scope before writing and uses server-generated object names", async () => {
  const s = uploadSubject();
  const res = await s.POST(uploadRequest());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    url: "https://example.invalid/upload.png",
  });
  assert.deepEqual(s.calls[0], ["authorize", arena, "upload"]);
  assert.match(
    s.calls[1][1],
    new RegExp(`^publications/${arena}/[a-f0-9-]+\\.png$`),
  );
  const blocked = uploadSubject({ denied: true });
  assert.equal((await blocked.POST(uploadRequest())).status, 403);
  assert.equal(blocked.calls.length, 1);
});
test("publication upload rejects spoofed images and malformed scope before storage", async () => {
  for (const options of [
    { bytes: Buffer.from("not an image") },
    { name: "a.svg", type: "image/svg+xml" },
    { arenaId: "invalid" },
  ]) {
    const s = uploadSubject();
    assert.equal((await s.POST(uploadRequest(options))).status, 400);
    assert.equal(s.calls.filter((c) => c[0] === "upload").length, 0);
  }
});
test("platform image upload supports null arena and hides storage failure details", async () => {
  const s = uploadSubject({ failStorage: true });
  const res = await s.POST(uploadRequest({ arenaId: null }));
  assert.equal(res.status, 500);
  assert.equal(s.calls[0][1], null);
  assert.match(s.calls[1][1], /^publications\/platform\//);
  assert.doesNotMatch(JSON.stringify(await res.json()), /private storage/);
});

test("authorship operations cannot use platform authority to impersonate an arena, even if also a manager", async () => {
  let arenaMembershipChecks = 0;
  const { authorizePublicationScope } = loadTypescriptModule(
    "src/modules/publications/authorization.ts",
    {
      "@/lib/server-auth": {
        AuthorizationError: Denied,
        requireAuthenticatedDbUser: async () => ({ dbUserId: "admin-owner" }),
        getPlatformAccessLevel: async () => "super_admin",
        assertPlatformAdminAccess: async () => {},
        assertArenaAdminAccess: async () => {
          arenaMembershipChecks++;
        },
      },
    },
  );
  for (const action of ["save", "publish", "archive", "restore", "upload"]) {
    await assert.rejects(
      authorizePublicationScope(arena, action),
      /somente como Arena Digital/,
    );
    await authorizePublicationScope(null, action);
  }
  for (const action of ["read", "pause", "block", "unblock"]) {
    await authorizePublicationScope(arena, action);
  }
  assert.equal(arenaMembershipChecks, 0);
});

test("server action passes the requested operation to the authorship guard", async () => {
  const s = subject();
  await s.changePublication({ ...input, action: "publish" });
  assert.deepEqual(s.authorizationCalls, [
    { arenaId: arena, operation: "publish" },
  ]);
});

test("platform upload cannot write arena media even when general arena access would succeed", async () => {
  const writes = [];
  const { POST } = loadTypescriptModule(
    "src/app/api/publications/upload/route.ts",
    {
      "@/lib/server-auth": {
        AuthorizationError: Denied,
        requireAuthenticatedDbUser: async () => ({ dbUserId: "admin-owner" }),
        getPlatformAccessLevel: async () => "super_admin",
        assertPlatformAdminAccess: async () => {},
        assertArenaAdminAccess: async () => {},
      },
      "@/lib/r2Client": {
        uploadToR2: async (...args) => {
          writes.push(args);
          return "https://example.invalid/a.png";
        },
      },
    },
  );
  const response = await POST(uploadRequest());
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /somente como Arena Digital/);
  assert.equal(writes.length, 0);
  assert.equal((await POST(uploadRequest({ arenaId: null }))).status, 200);
  assert.equal(writes.length, 1);
});
