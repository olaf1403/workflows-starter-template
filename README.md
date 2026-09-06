# Relay Omnichannel AI Inbox

Relay is a responsive, installable team inbox that brings WhatsApp, Instagram, web chat, email, and SMS conversations into one workspace. Its AI receptionist produces a reply and confidence score, while deterministic policy rules decide whether to **auto-answer**, **prepare a suggestion**, or **hand the conversation to a person**.

The current repository contains a polished working prototype, a Cloudflare Worker API, confidence-routing tests, and Progressive Web App support for laptops, Android phones, iPhones, and tablets. Demo conversations are local sample data until production channel credentials and persistence are connected.

## What is included

The inbox includes channel and status filters, conversation search, unread counts, customer context, AI summaries, suggested replies, manual takeover, resolution, and an adaptive reply composer. The control center persists settings in the browser and exposes every material AI policy as a dashboard control. The Worker endpoint at `POST /api/ai/reply` supports structured AI output with a safe deterministic fallback.

### Confidence policy

| AI confidence and policy state | Result |
| --- | --- |
| At or above **Auto-answer** and no guardrail applies | The reply can be sent immediately. |
| Between **Suggest** and **Auto-answer** | A draft is prepared for teammate review. |
| Below **Suggest**, the model requests help, or a guardrail applies | The conversation is handed to a person. |

Guardrails always take priority over model confidence. A model cannot auto-answer a payment dispute, refund, sensitive account change, or negative-sentiment conversation when the corresponding control is enabled.

## Dashboard controls to configure

| Control | Purpose | Recommended starting value |
| --- | --- | --- |
| **AI receptionist** | Master switch for all AI actions | On after knowledge and channels are tested |
| **Auto-answer confidence** | Minimum confidence required for immediate sending | 85% |
| **Suggest confidence** | Minimum confidence for a human-review draft | 60% |
| **Channel switches** | Enables AI separately for WhatsApp, Instagram, web chat, email, and SMS | Start with web chat and email |
| **Payments & charge disputes** | Forces financial conversations to a person | On |
| **Refunds & cancellations** | Requires approval before financial or contractual action | On |
| **Sensitive personal data** | Escalates identity, login, and account changes | On |
| **Negative sentiment** | Brings in a person for frustrated customers | On |
| **Use brand voice** | Applies the approved tone to generated replies | On after voice examples are loaded |
| **Learn from agent edits** | Uses approved teammate corrections as future examples | On after review policy is agreed |
| **Business hours only** | Restricts auto-answering to the configured schedule | Optional |

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Validate with:

```bash
npm run lint
npm run build
npm test
```

## Install on devices

Relay is configured as a Progressive Web App. On a laptop or Android device, use the browser's **Install app** action. On iPhone or iPad, open the site in Safari, choose **Share**, then **Add to Home Screen**. The responsive interface uses a four-pane laptop view, a compact tablet workspace, and a single-pane phone flow with bottom navigation.

A public HTTPS deployment is required for normal PWA installation and external channel webhooks.

## Production setup still required

The application deliberately does not contain credentials. Before handling real customers, configure the following:

1. **Authentication and roles:** protect the inbox, separate administrators from agents, and log policy changes.
2. **Database persistence:** store contacts, conversations, messages, assignments, settings, audit records, and delivery states in a shared database. Browser-local settings in the prototype are not cross-device synchronization.
3. **Channel apps and webhooks:** create approved WhatsApp Business, Instagram Messaging, email, web chat, and SMS integrations; verify webhook signatures; normalize incoming events; and record provider message IDs for idempotency.
4. **AI secret and model:** set `OPENAI_API_KEY`, optionally set `OPENAI_API_BASE`, and set `AI_MODEL=gpt-5-mini` in the Worker environment. The model target should be rechecked against the live catalog before launch.
5. **Knowledge and tools:** connect verified business hours, product catalog, inventory, order status, policies, and CRM data. The AI prompt is intentionally forbidden from inventing these facts.
6. **Human routing:** configure teams, availability, service-level timers, push/email notifications, and fallback ownership.
7. **Safety and compliance:** define retention, deletion, consent, redaction, regional privacy, rate limits, abuse protection, and an audit trail before production use.
8. **Operational monitoring:** add delivery failure alerts, webhook replay handling, AI latency/error metrics, and sampled reply reviews.

## Hosting approaches

| Approach | Tradeoffs | Cost | Setup complexity |
| --- | --- | --- | --- |
| **Hosted responsive PWA with channel webhooks** | Shared cross-device inbox, works when individual devices are offline, supports real-time channel events; requires public hosting, provider apps, authentication, and a database | Cloud and AI usage-based charges | Medium |
| **Laptop-hosted local prototype** | Fastest and lightest for testing the workflow; phone/tablet access only while the laptop and local network are available, and public provider webhooks are not dependable | Usually no additional hosting cost | Low |

## Worker API

`POST /api/ai/reply` accepts a customer message, confidence thresholds, sentiment, topic, and guardrail switches. It returns:

```json
{
  "reply": "Suggested customer reply",
  "confidence": 78,
  "category": "product_question",
  "needsHuman": false,
  "reason": "The question is clear but inventory must be checked.",
  "action": "suggest",
  "guardrail": null,
  "source": "ai"
}
```

The server—not the browser—enforces the final action. If the AI provider is unavailable, the endpoint returns a conservative fallback and never promotes an unsafe request to auto-answer.
