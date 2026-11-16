# API build provenance

`GET /api/healthz` keeps its existing status code and JSON body,
`{"status":"ok"}`. It now sends `Cache-Control: no-store` and two optional
diagnostic headers:

- `X-Hint-Build: sha256:<64 lowercase hex characters>` identifies the completed
  emitted API artifact set.
- `X-Hint-Schema: sha256:<64 lowercase hex characters>` identifies the embedded
  **expected** migration manifest. It does not say migrations ran.
- Both are `unknown` if startup verification cannot establish either value.

Older builds can omit these headers. Neither omission nor `unknown` identifies
a revision. Browser CORS exposure is unchanged; use operator HTTP tooling to
inspect the headers. No generated client or JSON schema change is required.

## Generation and verification

The existing `node build.mjs` command first completes esbuild, then writes
`dist/build-provenance.json`. Its versioned payload contains a sorted list of
every emitted filename and its SHA-256 (including logging workers and source
maps), plus the SHA-256 of the JSON embedded expected migration list. The build
fingerprint is the SHA-256 of UTF-8 `JSON.stringify` of these keys in order:
`{format:"hint-api-artifacts-v1", files, schemaSha256}`. Each file record has
`name`, then `sha256`. The sidecar is excluded, so the digest never depends on
itself. There are no Git commands, revision fallbacks, timestamps or environment
values in this metadata generation.

At startup the bundled helper verifies the exact directory file list, regular
files, safe basenames, each file's bytes, the payload digest and the embedded
expected schema digest. Invalid, missing or unreadable metadata/files return
`unknown` silently. Direct source execution also returns `unknown`. Validation
is bounded to 32 files, 32 KiB metadata and 64 MiB per emitted file. Current
builds are well below those bounds.

Preserve **all** emitted files and their names when copying a build. A byte-for-
byte copy retains its identity regardless of location, working directory or
runtime environment. Missing source maps, extra files or modified artifacts
yield `unknown`. A fresh build can have a different digest if its output bytes
differ (including source maps, toolchain or dependency output); this is an
artifact identity, not a normalized source-tree identifier. External packages,
Node/OS versions and runtime configuration are outside its coverage.

## Future authorized test deployment

1. Build the intended reviewed source using its pinned tooling. Retain its
   exact source tree, build command, tool versions and resulting sidecar in
   operator-controlled deployment evidence. Confirm the listed file digests
   against that artifact. Do not use an inherited Git HEAD as the tree identity.
2. Deploy the unchanged complete `dist` directory only after separate rollout
   authorization. Reconcile the hosting control-plane service/deployment and
   artifact/version records with that evidence.
3. Inspect the test host's `/api/healthz` headers. Compare both digests with the
   recorded sidecar, and check the unchanged JSON body. An absent/unknown value
   or mismatch is unresolved provenance; never label it an accepted candidate.
4. Check `/api/readyz` independently for its existing 200/503 behavior and verify
   private-route authentication. Provider/persistence acceptance remains a
   separate, authorized synthetic-data exercise.

These are **self-reported startup diagnostics**, not cryptographic attestation,
a signature, candidate acceptance, healthy providers or proof of a database
migration. Modified code could lie. In-place file changes after startup are not
continuously rehashed; treat deployed files as immutable and restart to verify
a changed artifact. Health remains live even when provenance is unknown or the
server is draining. Readiness and authentication logic are unchanged.

Local checks (from `artifacts/api-server`, with existing pinned dependencies):

```text
node node_modules/vitest/vitest.mjs run src/lib/buildProvenance.test.ts src/routes/healthProvenance.test.ts
node --test build.provenance.test.mjs
```

The production test builds actual bundles, uses temporary source archives and
synthetic configuration, binds listeners to loopback and rejects outbound
connections. It never calls a live provider or applies migrations. Rollback is
redeploying a prior authorized complete artifact; its health JSON still works,
and absent headers must be treated as unknown. No migration/data rollback is
needed for this patch.
