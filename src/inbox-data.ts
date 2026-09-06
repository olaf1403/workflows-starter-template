export type Channel = "whatsapp" | "instagram" | "web" | "email" | "sms";
export type ConversationStatus = "ai" | "human" | "waiting" | "resolved";
export type ConfidenceBand = "high" | "medium" | "low";

export interface Message {
	id: string;
	sender: "customer" | "ai" | "agent";
	body: string;
	time: string;
}

export interface Conversation {
	id: string;
	name: string;
	initials: string;
	channel: Channel;
	preview: string;
	time: string;
	unread: number;
	status: ConversationStatus;
	confidence: number;
	topic: string;
	email?: string;
	phone?: string;
	location: string;
	customerSince: string;
	orders: number;
	sentiment: "positive" | "neutral" | "negative";
	messages: Message[];
	suggestedReply?: string;
}

export interface ReceptionSettings {
	enabled: boolean;
	autoAnswerAt: number;
	suggestAt: number;
	businessHoursOnly: boolean;
	learnFromEdits: boolean;
	brandVoice: boolean;
	blockPayments: boolean;
	blockRefunds: boolean;
	blockSensitiveData: boolean;
	handoffNegative: boolean;
	channels: Record<Channel, boolean>;
}

export const channelLabels: Record<Channel, string> = {
	whatsapp: "WhatsApp",
	instagram: "Instagram",
	web: "Web chat",
	email: "Email",
	sms: "SMS",
};

export const initialSettings: ReceptionSettings = {
	enabled: true,
	autoAnswerAt: 85,
	suggestAt: 60,
	businessHoursOnly: false,
	learnFromEdits: true,
	brandVoice: true,
	blockPayments: true,
	blockRefunds: true,
	blockSensitiveData: true,
	handoffNegative: true,
	channels: {
		whatsapp: true,
		instagram: true,
		web: true,
		email: true,
		sms: false,
	},
};

export const initialConversations: Conversation[] = [
	{
		id: "conv-riley",
		name: "Riley Morgan",
		initials: "RM",
		channel: "whatsapp",
		preview: "Perfect, thanks for checking!",
		time: "2m",
		unread: 1,
		status: "ai",
		confidence: 94,
		topic: "Order status",
		phone: "+1 415 555 0138",
		location: "San Francisco, CA",
		customerSince: "Mar 2024",
		orders: 4,
		sentiment: "positive",
		messages: [
			{
				id: "r1",
				sender: "customer",
				body: "Hey! Can you tell me if my order #4821 has shipped yet?",
				time: "10:42 AM",
			},
			{
				id: "r2",
				sender: "ai",
				body: "Hi Riley! Yes — order #4821 shipped this morning and is expected on Tuesday. I can also send the tracking link if you'd like.",
				time: "10:42 AM",
			},
			{
				id: "r3",
				sender: "customer",
				body: "Perfect, thanks for checking!",
				time: "10:44 AM",
			},
		],
	},
	{
		id: "conv-jordan",
		name: "Jordan Lee",
		initials: "JL",
		channel: "instagram",
		preview: "Do you have the jacket in olive?",
		time: "6m",
		unread: 2,
		status: "waiting",
		confidence: 78,
		topic: "Product question",
		location: "Austin, TX",
		customerSince: "New lead",
		orders: 0,
		sentiment: "neutral",
		messages: [
			{
				id: "j1",
				sender: "customer",
				body: "I love the new field jacket. Do you have it in olive, size medium?",
				time: "10:38 AM",
			},
		],
		suggestedReply: "Hi Jordan! The olive field jacket is available in medium. Would you like me to share a direct product link?",
	},
	{
		id: "conv-samira",
		name: "Samira Khan",
		initials: "SK",
		channel: "email",
		preview: "I need to change my delivery address",
		time: "12m",
		unread: 1,
		status: "human",
		confidence: 42,
		topic: "Address change",
		email: "samira.k@example.com",
		location: "London, UK",
		customerSince: "Nov 2023",
		orders: 7,
		sentiment: "neutral",
		messages: [
			{
				id: "s1",
				sender: "customer",
				body: "I just placed an order but need to change the delivery address. Can you update it before it ships?",
				time: "10:32 AM",
			},
		],
		suggestedReply: "I can help verify the order, but an agent needs to securely confirm the address change before dispatch.",
	},
	{
		id: "conv-noah",
		name: "Noah Wilson",
		initials: "NW",
		channel: "web",
		preview: "What are your weekend hours?",
		time: "18m",
		unread: 0,
		status: "ai",
		confidence: 97,
		topic: "Business hours",
		location: "Toronto, CA",
		customerSince: "New lead",
		orders: 0,
		sentiment: "neutral",
		messages: [
			{
				id: "n1",
				sender: "customer",
				body: "What are your weekend support hours?",
				time: "10:26 AM",
			},
			{
				id: "n2",
				sender: "ai",
				body: "We're here Saturday from 9 AM–5 PM and Sunday from 10 AM–4 PM (ET).",
				time: "10:26 AM",
			},
		],
	},
	{
		id: "conv-ava",
		name: "Ava Chen",
		initials: "AC",
		channel: "sms",
		preview: "Can I get a refund for the duplicate?",
		time: "31m",
		unread: 1,
		status: "human",
		confidence: 88,
		topic: "Refund request",
		phone: "+1 604 555 0171",
		location: "Vancouver, CA",
		customerSince: "Jan 2025",
		orders: 2,
		sentiment: "negative",
		messages: [
			{
				id: "a1",
				sender: "customer",
				body: "I was charged twice. Can I get a refund for the duplicate?",
				time: "10:13 AM",
			},
		],
		suggestedReply: "I'm sorry about the duplicate charge. I'm bringing in a billing specialist who can review and resolve it securely.",
	},
	{
		id: "conv-luca",
		name: "Luca Bennett",
		initials: "LB",
		channel: "whatsapp",
		preview: "The size guide answered it, thank you",
		time: "1h",
		unread: 0,
		status: "resolved",
		confidence: 92,
		topic: "Sizing",
		phone: "+44 7700 900812",
		location: "Manchester, UK",
		customerSince: "Jun 2024",
		orders: 3,
		sentiment: "positive",
		messages: [
			{
				id: "l1",
				sender: "customer",
				body: "How does your relaxed fit compare with standard sizing?",
				time: "9:41 AM",
			},
			{
				id: "l2",
				sender: "ai",
				body: "The relaxed fit has about 2 inches more room through the chest. Your usual size should give an intentionally loose fit.",
				time: "9:41 AM",
			},
		],
	},
];

export function confidenceBand(confidence: number): ConfidenceBand {
	if (confidence >= 85) return "high";
	if (confidence >= 60) return "medium";
	return "low";
}
