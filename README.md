# Fleet Orchestrator

You built good agents. Now you can coordinate them together, without relying on a third-party's server.

This is the stateless coordination hub for the Cocapn Fleet. It handles service discovery and messaging for your distributed vessels. You host it, so there's no vendor lock-in or mandatory uptime promises. It’s designed to be forked and run on the edge.

---

## Why Fork This?

Most orchestrators are built for the platform that sells them. This one is built for you to run agents that work together. It deploys in under a minute and you never need permission to change how it works.

*   **You Host It:** There is no central authority. You control every part of your fleet's coordination.
*   **Zero Runtime Dependencies:** Runs on Cloudflare Workers with no databases or external services.
*   **Fork-First Philosophy:** This is code you copy, modify, and run. It is not a SaaS.
*   **Failure Aware:** Isolates misbehaving vessels to prevent cascade failures.

---

## Try It First

You can test against the public reference instance:
https://the-fleet.casey-digennaro.workers.dev

This is a live deployment of this repository. Use it to register test vessels and send messages before you deploy your own.

---

## What It Does

*   **Vessel Registry & Discovery:** Active vessels register with heartbeats. Others can discover them by capability or health.
*   **Circuit Quarantine:** Automatically isolates misbehaving vessels at the circuit level to protect the wider fleet.
*   **Execution Bonds:** Tracks delegated work end-to-end for auditability.
*   **Cross-Vessel Messaging:** Send broadcast or direct messages with a best-effort exactly-once delivery.
*   **Heartbeat Monitoring:** Passive health tracking without adding network overhead.

**One Limitation:** As a stateless edge service, it uses Cloudflare KV which offers eventual consistency. This means rare, brief delays in vessel discovery after registration are possible.

---

## Quick Start

1.  **Fork** this repository.
2.  **Deploy** to Cloudflare Workers:
    ```bash
    npx wrangler deploy
    ```
3.  Configure your Cocapn-compatible vessels to use your new orchestrator's URL.

---

## Architecture

A stateless coordination service built for Cloudflare Workers. It uses Edge KV for the vessel registry and bond tracking. There are no external services, message brokers, or background processes.

It will run on the Workers free tier for small to medium fleets.

---

## Model Integrations

Configure these optional Worker secrets to enable direct model API calls:
*   `DEEPSEEK_API_KEY`
*   `DEEPINFRA_API_KEY`
*   `SILICONFLOW_API_KEY`

---

## Contributing

Open an issue first to discuss significant changes. Minor fixes and clarifications are welcome.

---

## License

MIT License.

Superinstance & Lucineer (DiGennaro et al.).

---

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> • <a href="https://cocapn.ai">Cocapn</a>
</div>