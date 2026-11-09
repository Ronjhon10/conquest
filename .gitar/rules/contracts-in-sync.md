---
title: "Contracts and spec stay in sync"
description: "API routes, shared types and index names must match packages/contracts and specs/000-overview.md."
when: "A PR changes packages/contracts, adds or changes an HTTP route in services/, or changes an API call in apps/web"
actions: "Compare the change with packages/contracts and specs/000-overview.md and request changes on drift"
---

The four lanes build in parallel against the contracts in `specs/000-overview.md` (Contracts, HTTP API) mirrored in `packages/contracts`.

1. If `packages/contracts` changes, `specs/000-overview.md` must change in the same PR, and the PR title should say "contract change". Otherwise request changes.
2. New or changed routes in `services/search-api` or `services/game-api` must use the request/response schemas from `@conquest/contracts`, not local copies.
3. Calls in `apps/web/src/lib/api.ts` must match the route paths and bodies in 000.
4. Elasticsearch index names come from `INDEX` in `@conquest/contracts`.
