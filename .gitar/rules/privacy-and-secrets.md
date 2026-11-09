---
title: "Privacy and secrets"
description: "Keep the public repo free of secrets and keep personal data out of telemetry and away from LinkedIn scraping."
when: "Any PR"
actions: "Request changes when a diff contains a secret, logs personal text, or fetches LinkedIn"
---

The repo and images are public, and the hackathon rules ban private, personal or login-protected data.

Request changes when the diff:

1. Contains an API key, token, password, kubeconfig, private key or a filled-in `.env` (only `.env.example` with empty values is allowed).
2. Puts names, headlines, about text, LinkedIn URLs, coin notes or photos into span attributes, metrics, or log lines (IDs are fine; spec 000 "Telemetry conventions").
3. Requests linkedin.com or any profile page from server or browser code, or adds scraping (spec 000 non-goals). Storing and linking the attendee's pasted URL is allowed.
4. Sends personal text to OpenAI beyond what the specs allow (030 Behavior 4 and 19).
