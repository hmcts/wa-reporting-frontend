# Example: azure-managed-redis-migration

## Overview

| Field | Value |
|---|---|
| **Skill** | `azure-managed-redis-migration` |
| **Contributor** | HMCTS Platform Operations |
| **Date** | 2026-06-02 |

## Context

A product team running `plum/recipe-backend` needs to move off the classic Azure Cache for Redis (`Standard C1`, 1 GB) onto Azure Managed Redis. The cache holds short-TTL session data and lookup caches — losing it for a few minutes during cutover is acceptable.

## Prompt Used

```
I need to migrate plum/recipe-backend from Azure Cache for Redis to Azure Managed
Redis. The current cache is plum-recipe-backend-sbox (Standard C1) in resource
group plum-shared-infrastructure-sbox. Terraform repo is at
~/repos/cnp-plum-recipes-service. Flux config is at ~/repos/cnp-flux-config and
the HelmRelease lives under apps/cnp/plum-recipe-backend/. Start with sbox.
No data migration needed — pure cache.
```

## Outcome

The skill produced:

1. A SKU recommendation: `Standard C1` → `Balanced_B0` based on observed peak `usedmemory` of 180 MB and ~120 ops/s.
2. A draft PR against `cnp-plum-recipes-service` adding the `managed_redis` module alongside the existing `azurerm_redis_cache`, plus a new Key Vault secret `azure-managed-redis-connection-string`.
3. A draft PR against `cnp-flux-config` adding a `keyVaults` block to `apps/cnp/plum-recipe-backend/sbox.yaml` with `alias: redis-connection-string` so the app code is unchanged.
4. A `recipe-backend-redis-migration-plan.md` file with pre-cutover checklist, validation steps, rollback procedure, and a decommissioning plan to remove the classic cache after a 7-day soak.

## Lessons Learned

- The biggest time-saver is the alias trick in Flux (`alias: redis-connection-string`) — the application code does not have to change.
- Keep the classic cache running until the new instance has soaked in prod. Removing it in the same PR makes rollback expensive.
- Always confirm the Managed Redis port is `10000` and the scheme is `rediss://` — easy to get wrong by copy-pasting from a classic-cache example.

## Benefits and Drawbacks

**Benefits:**
- Standardises every team on the same module (`terraform-module-azure-managed-redis`) and the same secret pattern.
- Forces an explicit data-migration decision instead of assuming the cache is disposable.
- Produces both PRs and a migration plan in one pass.

**Drawbacks:**
- Requires the user to have the product Terraform repo and `cnp-flux-config` checked out locally.
- SKU mapping is a starting point — for unusual workloads (RediSearch, very high ops/s) the recommendation needs manual review.

## Recommendation

Use for any HMCTS service planning to retire its classic Azure Cache for Redis instance. Pair with `azure-cost-saving` first if the team is also looking to right-size their existing cache before the move.
