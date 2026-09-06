import { describe, expect, it } from "vitest";
import { applyReceptionPolicy, validateReceptionRequest, type ReceptionDraft, type ReceptionRequest } from "../worker/reception";

const baseRequest: ReceptionRequest = {
	customerName: "Riley Morgan",
	message: "What are your weekend hours?",
	topic: "Business hours",
	sentiment: "neutral",
	autoAnswerAt: 85,
	suggestAt: 60,
	guardrails: {
		blockPayments: true,
		blockRefunds: true,
		blockSensitiveData: true,
		handoffNegative: true,
	},
};

function draft(confidence: number, needsHuman = false): ReceptionDraft {
	return {
		reply: "We are open Saturday from 9 AM to 5 PM.",
		confidence,
		category: "business_hours",
		needsHuman,
		reason: "The request is clear.",
	};
}

describe("AI reception policy", () => {
	it("auto-answers only at or above the configured high-confidence threshold", () => {
		expect(applyReceptionPolicy(baseRequest, draft(91)).action).toBe("auto_reply");
		expect(applyReceptionPolicy(baseRequest, draft(84)).action).toBe("suggest");
	});

	it("suggests a reply in the review band", () => {
		expect(applyReceptionPolicy(baseRequest, draft(72)).action).toBe("suggest");
	});

	it("hands off low-confidence replies", () => {
		expect(applyReceptionPolicy(baseRequest, draft(41)).action).toBe("handoff");
	});

	it("guardrails override a high model confidence", () => {
		const refundRequest = {
			...baseRequest,
			message: "I was charged twice; please refund the duplicate payment.",
			sentiment: "negative" as const,
		};
		const decision = applyReceptionPolicy(refundRequest, draft(96));
		expect(decision.action).toBe("handoff");
		expect(decision.guardrail).not.toBeNull();
	});

	it("respects an explicit model handoff request", () => {
		expect(applyReceptionPolicy(baseRequest, draft(94, true)).action).toBe("handoff");
	});

	it("normalizes malformed threshold inputs", () => {
		const request = validateReceptionRequest({
			customerName: "Riley",
			message: "Hello",
			autoAnswerAt: 120,
			suggestAt: 110,
			guardrails: {},
		});
		expect(request.autoAnswerAt).toBe(98);
		expect(request.suggestAt).toBe(93);
	});
});
