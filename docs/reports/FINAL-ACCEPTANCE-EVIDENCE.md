# Final Acceptance Evidence

This index maps the six requested experience scenarios to repeatable checks. It records the current runnable implementation, not a claim that the full art direction or an external paid model has been delivered.

| Scenario | Reproduction | Evidence |
| --- | --- | --- |
| A: living settlement | `pnpm exec vitest run tests/m1.test.ts`; browser login/map/reload; continuous walkthrough opens a seeded town | `tests/m1.test.ts`, `tests/browser/m0.spec.ts`, `tests/browser/a17.spec.ts`, `A17-A-live-town.png` |
| B: private memory | `pnpm exec vitest run tests/m2.test.ts`; verifies a private exchange is absent from another resident's context and public snapshot | `tests/m2.test.ts`, `A17-B-private-view.png` |
| C: water policy conflict | `pnpm exec vitest run tests/m4.test.ts`; verifies differentiated opinions, a real ration policy and non-fictional resource balance | `tests/m4.test.ts`, `A17-C-rationing.png` |
| D: unaffordable water tower | `pnpm exec vitest run tests/m5.test.ts`; verifies insufficient funds leave the project unstarted and explain the limit | `tests/m5.test.ts`, `A17-D-water-tower-unfunded.png` |
| E: completed construction | Same M5 test advances a funded water tower to completion and checks map, storage, labor cost, inventory and memory effects | `tests/m5.test.ts`, `A17-E-water-tower-built.png` |
| F: model outage | `pnpm exec vitest run tests/m2-provider.test.ts tests/m1.test.ts`; HTTP failures fall back, rule simulation keeps progressing | `tests/m2-provider.test.ts`, `tests/m1.test.ts`, `A17-F-model-offline.png` |

Operational checks: `tests/reliability.test.ts` rejects malformed imports, exports and restores a distinct save, checks that metrics show balanced accounts and queue depth, and records synthetic 20/50-resident rule throughput. `tests/m0.test.ts` verifies eight concurrent Tick attempts commit exactly once and login throttling returns 429 after five failures. The existing restart script records world/map checksums before and after server/worker restarts.

Run `pnpm test` for the underlying suite, `pnpm test:browser` for desktop and 390px mobile flows, and `PLAYWRIGHT_BASE_URL=http://localhost:5189 pnpm exec playwright test tests/browser/a17.spec.ts` for the continuous A-F browser walkthrough. That single-session walkthrough verifies private data stays out of the public view, a rationing proposal reaches opposing resident opinions, an unfunded tower is rejected, a funded tower is completed and traceable in the event log, and simulation keeps advancing when the model is disabled. Its six screenshots are `A17-A-live-town.png` through `A17-F-model-offline.png`. The separate rule-versus-LLM-versus-Jev comparison is an experiment; it does not automatically execute world actions.
