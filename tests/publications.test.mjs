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
      authorizePublicationScope: async (arenaId, operation, context) => {
        authorizationCalls.push({ arenaId, operation, context });
        if (context === "arena" && denyArena) throw Error("Sem acesso à arena");
        if (context === "platform" && denyPlatform) throw Error("Sem acesso à plataforma");
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
          return { data: name === "list_home_publications" ? [row] : name === "home_publication_history" ? [] : row, error: rpcError };
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
  context: "arena",
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
    (await s.changePublication({ ...input, action: "block", context: "platform" })).success,
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

class Denied extends Error {
  constructor(message, status = 403) { super(message); this.status = status; }
}
function authorizationSubject({ platform = true, ownedArenas = [arena], rpcError = null } = {}) {
  const calls = [];
  const imports = {
    "@/lib/server-auth": {
      AuthorizationError: Denied,
      requireAuthenticatedDbUser: async () => ({ dbUserId: platform ? "admin-owner" : "manager" }),
      getPlatformAccessLevel: async () => platform ? "super_admin" : null,
      assertPlatformAdminAccess: async () => {
        calls.push(["platform"]);
        if (!platform) throw new Denied("Forbidden");
      },
      // An existing general admin guard must not bypass the publication-specific
      // membership check, even when the platform account is highly privileged.
      assertArenaAdminAccess: async () => { throw Error("Use explicit publication membership"); },
    },
    "@/lib/supabase/server": {
      createSupabaseServerClient: async () => ({ rpc: async (name, args) => {
        calls.push(["membership", name, args.p_arena_id]);
        assert.equal(name, "can_author_home_publication");
        return {data: ownedArenas.includes(args.p_arena_id), error: rpcError};
      }}),
    },
  };
  return { ...loadTypescriptModule("src/modules/publications/authorization.ts", imports), calls, imports };
}

test("platform moderation context can read and remove arena publications without ownership", async () => {
  const s = authorizationSubject({ownedArenas: []});
  for (const action of ["read", "pause", "block", "unblock"]) {
    await s.authorizePublicationScope(arena, action, "platform");
  }
  assert.deepEqual(s.calls, [["platform"], ["platform"], ["platform"], ["platform"]]);
});

test("dual-role account authors its arena through explicit membership, never platform privilege", async () => {
  const s = authorizationSubject();
  for (const action of ["read", "save", "publish", "pause", "archive", "restore", "upload"]) {
    await s.authorizePublicationScope(arena, action, "arena");
  }
  assert.equal(s.calls.length, 7);
  assert.ok(s.calls.every(call => call[0] === "membership" && call[2] === arena));
});

test("platform authority cannot authorize authorship for an unrelated arena", async () => {
  const s = authorizationSubject();
  for (const action of ["read", "save", "publish", "pause", "archive", "restore", "upload"]) {
    await assert.rejects(s.authorizePublicationScope(row.id, action, "arena"));
  }
  assert.equal(s.calls.filter(call => call[0] === "platform").length, 0);
});

test("ordinary arena manager cannot request platform authority", async () => {
  const s = authorizationSubject({platform:false});
  await s.authorizePublicationScope(arena, "save", "arena");
  await assert.rejects(s.authorizePublicationScope(null, "save", "platform"), /Forbidden/);
  await assert.rejects(s.authorizePublicationScope(arena, "block", "platform"), /Forbidden/);
  await assert.rejects(s.authorizePublicationScope(row.id, "save", "arena"));
});

test("arena context cannot target global content or perform platform moderation", async () => {
  const s = authorizationSubject();
  await assert.rejects(s.authorizePublicationScope(null, "save", "arena"));
  for (const action of ["block", "unblock"]) {
    await assert.rejects(s.authorizePublicationScope(arena, action, "arena"));
  }
});

test("platform authorship remains global even when the account owns the target arena", async () => {
  const s = authorizationSubject();
  for (const action of ["save", "publish", "archive", "restore", "upload"]) {
    await assert.rejects(s.authorizePublicationScope(arena, action, "platform"));
    await s.authorizePublicationScope(null, action, "platform");
  }
  assert.equal(s.calls.filter(call => call[0] === "membership").length, 0);
});

test("unavailable membership verification fails closed", async () => {
  const s = authorizationSubject({rpcError:{message:"Unavailable"}});
  await assert.rejects(s.authorizePublicationScope(arena, "publish", "arena"));
});

test("authorization rejects malformed contexts and arena identifiers before any privilege check", async () => {
  const s = authorizationSubject();
  for (const context of [null, "unknown", {}]) {
    await assert.rejects(s.authorizePublicationScope(arena, "read", context));
  }
  await assert.rejects(s.authorizePublicationScope("invalid", "read", "arena"));
  assert.equal(s.calls.length, 0);
});

test("omitted read context follows the arena scope without a platform bypass", async () => {
  const s = authorizationSubject();
  await s.authorizePublicationScope(arena);
  await s.authorizePublicationScope(null);
  assert.deepEqual(s.calls, [["membership", "can_author_home_publication", arena], ["platform"]]);
});

function uploadSubject({ denied = false, failStorage = false } = {}) {
  const calls = [];
  const { POST } = loadTypescriptModule(
    "src/app/api/publications/upload/route.ts",
    {
      "@/modules/publications/authorization": {
        authorizePublicationScope: async (id, operation, context) => {
          calls.push(["authorize", id, operation, context]);
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
  context = arenaId ? "arena" : "platform",
  bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  name = "a.png",
  type = "image/png",
} = {}) {
  const form = new FormData();
  if (arenaId) form.set("arenaId", arenaId);
  if (context !== null) form.set("context", context);
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
  assert.deepEqual(s.calls[0], ["authorize", arena, "upload", "arena"]);
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
    { context: null },
    { context: "unknown" },
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

test("server mutation forwards context and revision as part of the authorized RPC envelope", async () => {
  for (const context of ["arena", "platform"]) {
    const s = subject();
    const value = {...input, action:context === "arena" ? "publish" : "block", context};
    await s.changePublication(value);
    assert.deepEqual(s.authorizationCalls, [{arenaId:arena,operation:value.action,context}]);
    assert.equal(s.calls.length,1);
    assert.equal(s.calls[0].args.p_context,context);
    assert.equal(s.calls[0].args.p_revision,2);
    assert.equal(s.calls[0].args.p_arena_id,arena);
  }
});

test("missing or invalid mutation context never reaches authorization or the database", async () => {
  for (const context of [undefined,null,"super_admin",{}]) {
    const s=subject();
    const result=await s.changePublication({...input,context});
    assert.equal(result.success,false);
    assert.equal(s.authorizationCalls.length,0);
    assert.equal(s.calls.length,0);
  }
});

test("list and history retain the selected context for their authorization", async () => {
  const s=subject();
  await s.listPublications(arena,"arena");
  await s.publicationHistory(row.id,arena,"platform");
  assert.deepEqual(s.authorizationCalls,[
    {arenaId:arena,operation:"read",context:"arena"},
    {arenaId:arena,operation:"read",context:"platform"},
  ]);
});

test("arena history accepts only a publication returned in the authorized arena", async () => {
  const s = subject();
  const result = await s.publicationHistory(row.id, arena, "arena");
  assert.equal(result.success, true);
  assert.deepEqual(s.authorizationCalls, [
    { arenaId: arena, operation: "read", context: "arena" },
    { arenaId: arena, operation: "read", context: "arena" },
  ]);
  assert.deepEqual(s.calls.map(call => call.name), ["list_home_publications", "home_publication_history"]);
  assert.equal(s.calls[0].args.p_arena_id, arena);
  assert.equal(s.calls[1].args.p_id, row.id);
});

test("arena history cannot expose a publication from another scope through its ID", async () => {
  const s = subject();
  const result = await s.publicationHistory("f9300000-0000-4000-8000-000000000002", arena, "arena");
  assert.equal(result.success, false);
  assert.deepEqual(s.calls.map(call => call.name), ["list_home_publications"]);
});

test("upload isolates platform and arena media even for the same dual-role account", async () => {
  const writes=[];
  const s=authorizationSubject();
  const {POST}=loadTypescriptModule("src/app/api/publications/upload/route.ts",{
    ...s.imports,
    "@/lib/r2Client":{uploadToR2:async(_buffer,key)=>{writes.push(key);return "https://example.invalid/a.png";}},
  });
  const denied=await POST(uploadRequest({context:"platform"}));
  assert.equal(denied.status,403);
  assert.equal(writes.length,0);
  const global=await POST(uploadRequest({arenaId:null,context:"platform"}));
  assert.equal(global.status,200);
  assert.match(writes[0],/^publications\/platform\//);
  const owned=await POST(uploadRequest({context:"arena"}));
  assert.equal(owned.status,200);
  assert.ok(writes[1].startsWith(`publications/${arena}/`));
  assert.equal((await POST(uploadRequest({arenaId:row.id,context:"arena"}))).status,403);
  assert.equal((await POST(uploadRequest({arenaId:null,context:"arena"}))).status,403);
  assert.equal(writes.length,2);
});
