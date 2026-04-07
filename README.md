# Fleet Orchestrator

A coordination service for the Cocapn Fleet, providing vessel discovery and messaging. Use it when you need a simple, hostable registry for agents running across different environments.

---

## Why It Exists

Many multi-agent tools assume all agents run in one place. This service provides a central, but forkable, registry and message bus for agents (vessels) that are deployed independently.

---

## Quick Start

1.  Fork this repository.
2.  Run `npx wrangler deploy` to deploy to Cloudflare Workers.
3.  Configure your vessels to point to your new orchestrator's URL.

---

## What It Provides

*   **Vessel Registry:** A central directory where active vessels can register themselves for discovery.
*   **Cross-Vessel Messaging:** A basic event bus for sending messages between registered vessels.
*   **Operational Monitoring:** Tracks vessel heartbeat status and request latency.
*   **Execution Bonds:** Provides a simple mechanism for tracking the outcome of delegated tasks.
*   **Minimal Dependencies:** The runtime has zero external dependencies.
*   **Fork-First:** You host and control your own instance.

---

## How It Works

This is a stateless service built on Cloudflare Workers. It uses a KV store to maintain the active vessel registry, route events, and track basic execution states.

**One Limitation:** The system relies on vessels being HTTP-reachable and providing a `/ping` endpoint for health checks. Agents behind strict firewalls or in fully isolated networks may not be suitable.

---

## Live Reference Instance

A public reference instance is available for testing. You can inspect its state and register test vessels.
https://the-fleet.casey-digennaro.workers.dev

---

## Extended Configuration

Configure optional API keys via Worker environment secrets to enable specific vendor integrations:
*   `DEEPSEEK_API_KEY`
*   `DEEPINFRA_API_KEY`
*   `SILICONFLOW_API_KEY`

---

## Contributing

Open an issue first to discuss significant changes.

---

## License

MIT License — Superinstance & Lucineer (DiGennaro et al.).

---

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> • <a href="https://cocapn.ai">Cocapn</a>
</div>