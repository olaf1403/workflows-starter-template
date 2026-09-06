export type ReceptionAction = "auto_reply" | "suggest" | "handoff";

export interface ReceptionRequest {
	customerName: string;
	message: string;
	topic?: string;
	sentiment?: "positive" | "neutral" | "negative";
	autoAnswerAt: number;
	suggestAt: number;
	guardrails: {
		blockPayments: boolean;
		blockRefunds: boolean;
		blockSensitiveData: boolean;
		handoffNegative: boolean;
	};
}

export interface ReceptionDraft {
	reply: string;
	confidence: number;
	category: string;
	needsHuman: boolean;
	reason: string;
}

export interface ReceptionDecision extends ReceptionDraft {
	action: ReceptionAction;
	guardrail: string | null;
	source: "ai" | "policy-fallback";
}

export interface AiEnvironment {
	OPENAI_API_KEY?: string;
	OPENAI_API_BASE?: string;
	AI_MODEL?: string;
}

const paymentPattern = /\b(charge|charged|payment|card|billing|invoice|transaction|duplicate)\b/i;
const refundPattern = /\b(refund|cancel|cancellation|return money|money back|reverse)\b/i;
const sensitivePattern = /\b(address|password|passcode|login|identity|social security|ssn|bank account|email change|phone number change)\b/i;

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function validateReceptionRequest(input: unknown): ReceptionRequest {
	if (!input || typeof input !== "object") throw new Error("Request body is required");
	const body = input as Partial<ReceptionRequest>;
	if (typeof body.message !== "string" || body.message.trim().length === 0) throw new Error("Message is required");
	if (body.message.length > 4000) throw new Error("Message is too long");
	const autoAnswerAt = clamp(Number(body.autoAnswerAt) || 85, 65, 98);
	const suggestAt = clamp(Number(body.suggestAt) || 60, 35, autoAnswerAt - 5);
	return {
		customerName: typeof body.customerName === "string" ? body.customerName.slice(0, 100) : "there",
		message: body.message.trim(),
		topic: typeof body.topic === "string" ? body.topic.slice(0, 100) : undefined,
		sentiment: body.sentiment === "positive" || body.sentiment === "negative" ? body.sentiment : "neutral",
		autoAnswerAt,
		suggestAt,
		guardrails: {
			blockPayments: body.guardrails?.blockPayments !== false,
			blockRefunds: body.guardrails?.blockRefunds !== false,
			blockSensitiveData: body.guardrails?.blockSensitiveData !== false,
			handoffNegative: body.guardrails?.handoffNegative !== false,
		},
	};
}

export function applyReceptionPolicy(request: ReceptionRequest, draft: ReceptionDraft, source: ReceptionDecision["source"] = "ai"): ReceptionDecision {
	const confidence = clamp(draft.confidence, 0, 100);
	let guardrail: string | null = null;
	if (request.guardrails.blockRefunds && refundPattern.test(request.message)) guardrail = "refund_or_cancellation";
	if (!guardrail && request.guardrails.blockPayments && paymentPattern.test(request.message)) guardrail = "payment_or_charge";
	if (!guardrail && request.guardrails.blockSensitiveData && sensitivePattern.test(request.message)) guardrail = "sensitive_account_change";
	if (!guardrail && request.guardrails.handoffNegative && request.sentiment === "negative") guardrail = "negative_sentiment";

	const mustHandoff = Boolean(guardrail) || draft.needsHuman || confidence < request.suggestAt;
	const action: ReceptionAction = mustHandoff ? "handoff" : confidence >= request.autoAnswerAt ? "auto_reply" : "suggest";
	return { ...draft, confidence, action, guardrail, source };
}

function fallbackDraft(request: ReceptionRequest): ReceptionDraft {
	const text = request.message.toLowerCase();
	if (/\b(hours|open|opening|weekend|location)\b/.test(text)) {
		return {
			reply: `Hi ${request.customerName.split(" ")[0]}! I can help with that. I’m checking the latest business information now so I don’t give you an outdated answer.`,
			confidence: 82,
			category: "business_information",
			needsHuman: false,
			reason: "Common informational request, but live business data should be verified.",
		};
	}
	if (/\b(size|sizing|colour|color|stock|available|product)\b/.test(text)) {
		return {
			reply: `Hi ${request.customerName.split(" ")[0]}! I can help with that product question. I’m checking the current catalog and availability before I confirm.`,
			confidence: 74,
			category: "product_question",
			needsHuman: false,
			reason: "Product intent is clear, but inventory facts require a connected catalog.",
		};
	}
	return {
		reply: `Thanks for reaching out, ${request.customerName.split(" ")[0]}. I’m bringing in a teammate who can review this and help you safely.`,
		confidence: 48,
		category: request.topic?.toLowerCase().replaceAll(" ", "_") || "general_support",
		needsHuman: true,
		reason: "The request needs more business context or a connected system of record.",
	};
}

async function requestAiDraft(request: ReceptionRequest, env: AiEnvironment): Promise<ReceptionDraft | null> {
	if (!env.OPENAI_API_KEY) return null;
	const endpoint = `${(env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.OPENAI_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: env.AI_MODEL || "gpt-5-mini",
			messages: [
				{
					role: "system",
					content: "You are a concise customer-service receptionist. Never invent order, inventory, policy, account, or business facts. If verified data is unavailable, say you will check or bring in a teammate. Confidence is the likelihood the reply is safe and useful without additional business data, not writing quality. Mark needsHuman for financial actions, refunds, cancellations, account changes, legal threats, safety issues, or when a system lookup is required to give the promised answer.",
				},
				{
					role: "user",
					content: JSON.stringify({ customerName: request.customerName, message: request.message, topic: request.topic, sentiment: request.sentiment }),
				},
			],
			response_format: {
				type: "json_schema",
				json_schema: {
					name: "reception_decision",
					strict: true,
					schema: {
						type: "object",
						properties: {
							reply: { type: "string" },
							confidence: { type: "integer", minimum: 0, maximum: 100 },
							category: { type: "string" },
							needsHuman: { type: "boolean" },
							reason: { type: "string" },
						},
						required: ["reply", "confidence", "category", "needsHuman", "reason"],
						additionalProperties: false,
					},
				},
			},
			max_completion_tokens: 700,
		}),
		signal: AbortSignal.timeout(12000),
	});
	if (!response.ok) return null;
	const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
	const content = payload.choices?.[0]?.message?.content;
	if (!content) return null;
	const parsed = JSON.parse(content) as ReceptionDraft;
	if (typeof parsed.reply !== "string" || typeof parsed.confidence !== "number") return null;
	return parsed;
}

export async function createReceptionDecision(input: unknown, env: AiEnvironment): Promise<ReceptionDecision> {
	const request = validateReceptionRequest(input);
	try {
		const aiDraft = await requestAiDraft(request, env);
		if (aiDraft) return applyReceptionPolicy(request, aiDraft, "ai");
	} catch (error) {
		console.warn("[reception] AI draft unavailable; applying safe fallback", error instanceof Error ? error.message : "unknown error");
	}
	return applyReceptionPolicy(request, fallbackDraft(request), "policy-fallback");
}
