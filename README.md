# Fleet Orchestrator

When a vessel fails three times consecutively, it is quarantined at the circuit level. This helps prevent cascading failures.

This is a stateless coordination hub for Cocapn Fleet. You host it on your Cloudflare Workers account. It coordinates distributed agent fleets on the edge.

**Live Reference Instance:** https://the-fleet.casey-digennaro.workers.dev

## Why This Exists
Existing orchestrators assume you want a third party to run your control plane. This is built for teams that prefer to fork and modify code rather than integrate a proprietary SaaS. You maintain full control over your vessel registry and coordination logic.

## Quick Start

1.  **Fork** this repository.
2.  **Deploy** to Cloudflare Workers. You need a Cloudflare account and the `wrangler` CLI.
    ```bash
    npx wrangler deploy
    ```
3.  Configure your vessels to send heartbeats and requests to your new orchestrator URL.

## Architecture

Stateless edge coordination using Cloudflare Workers and its Edge KV for persistence. There are no runtime npm dependencies, message brokers, or external background services. All coordination is request-driven.

## Features
*   **Vessel Registry & Discovery:** Vessels register via heartbeats. You can discover peers by their declared capabilities or tags.
*   **Circuit Quarantine (HCQ):** Isolates vessels after 3 consecutive execution failures to limit blast radius.
*   **Execution Bonds:** Creates a lightweight audit trail for delegated units of work without storing full message content.
*   **Cross-Vessel Messaging:** Supports broadcast and direct peer-to-peer messaging.
*   **Passive Health Checks:** Vessel health is inferred from normal request success/failure rates.

> **One Specific Limitation:** Cross-vessel messaging is best-effort and may occasionally duplicate or drop messages under very high concurrent load. It is not a guaranteed delivery system.

## What This Is Not
1.  A fully managed service. You are responsible for deployment, monitoring, and any modifications.
2.  A magic auto-scaler. It coordinates existing vessels; it does not create or destroy them.
3.  An analytics platform. It provides operational coordination, not detailed observability.

## License
MIT License.

Attribution: Superinstance and Lucineer (DiGennaro et al.)

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>