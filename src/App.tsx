import { useEffect, useMemo, useState } from "react";
import {
	Archive,
	ArrowLeft,
	Bell,
	Bot,
	Check,
	CheckCircle2,
	ChevronDown,
	CircleHelp,
	Clock3,
	Globe2,
	Inbox,
	Info,
	Instagram,
	Mail,
	Menu,
	MessageCircle,
	MoreHorizontal,
	Pause,
	Paperclip,
	PanelRight,
	Play,
	Search,
	Send,
	Settings,
	ShieldCheck,
	Smartphone,
	Sparkles,
	Tag,
	UserRound,
	WandSparkles,
	X,
	Zap,
	type LucideIcon,
} from "lucide-react";
import {
	channelLabels,
	confidenceBand,
	initialConversations,
	initialSettings,
	type Channel,
	type Conversation,
	type ReceptionSettings,
} from "./inbox-data";

type View = "inbox" | "assigned" | "resolved" | "controls";
type MobilePanel = "list" | "conversation" | "details" | "controls";
type InboxFilter = "all" | "unread" | "human" | "ai";

const channelIcons: Record<Channel, LucideIcon> = {
	whatsapp: MessageCircle,
	instagram: Instagram,
	web: Globe2,
	email: Mail,
	sms: Smartphone,
};

const channelColors: Record<Channel, string> = {
	whatsapp: "channel-whatsapp",
	instagram: "channel-instagram",
	web: "channel-web",
	email: "channel-email",
	sms: "channel-sms",
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className={`toggle ${checked ? "is-on" : ""}`}
			onClick={onChange}
		>
			<span />
		</button>
	);
}

function ChannelBadge({ channel, size = "normal" }: { channel: Channel; size?: "small" | "normal" }) {
	const Icon = channelIcons[channel];
	return (
		<span className={`channel-badge ${channelColors[channel]} ${size === "small" ? "is-small" : ""}`} title={channelLabels[channel]}>
			<Icon size={size === "small" ? 11 : 14} strokeWidth={2.25} />
		</span>
	);
}

function ConfidencePill({ score }: { score: number }) {
	const band = confidenceBand(score);
	return (
		<span className={`confidence-pill confidence-${band}`}>
			<span className="confidence-dot" />
			{score}%
		</span>
	);
}

function App() {
	const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
	const [activeId, setActiveId] = useState(initialConversations[0].id);
	const [view, setView] = useState<View>("inbox");
	const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
	const [filter, setFilter] = useState<InboxFilter>("all");
	const [query, setQuery] = useState("");
	const [draft, setDraft] = useState("");
	const [settings, setSettings] = useState<ReceptionSettings>(() => {
		try {
			const saved = localStorage.getItem("relay-reception-settings");
			return saved ? (JSON.parse(saved) as ReceptionSettings) : initialSettings;
		} catch {
			return initialSettings;
		}
	});
	const [aiRunning, setAiRunning] = useState(false);
	const [toast, setToast] = useState<string | null>(null);

	useEffect(() => {
		localStorage.setItem("relay-reception-settings", JSON.stringify(settings));
	}, [settings]);

	useEffect(() => {
		if (!toast) return;
		const timeout = window.setTimeout(() => setToast(null), 2600);
		return () => window.clearTimeout(timeout);
	}, [toast]);

	const active = conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
	const filteredConversations = useMemo(() => {
		const lowered = query.trim().toLowerCase();
		return conversations.filter((conversation) => {
			const matchesSearch = !lowered || `${conversation.name} ${conversation.preview} ${conversation.topic}`.toLowerCase().includes(lowered);
			const matchesView =
				view === "resolved"
					? conversation.status === "resolved"
					: view === "assigned"
						? conversation.status === "human"
						: conversation.status !== "resolved";
			const matchesFilter =
				filter === "all" ||
				(filter === "unread" && conversation.unread > 0) ||
				(filter === "human" && conversation.status === "human") ||
				(filter === "ai" && conversation.status === "ai");
			return matchesSearch && matchesView && matchesFilter;
		});
	}, [conversations, filter, query, view]);

	const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);
	const humanTotal = conversations.filter((conversation) => conversation.status === "human").length;

	function updateSettings(patch: Partial<ReceptionSettings>) {
		setSettings((current) => ({ ...current, ...patch }));
	}

	function toggleAutorun() {
		const nextEnabled = !settings.enabled;
		updateSettings({ enabled: nextEnabled });
		setToast(nextEnabled ? "Auto-run started" : "Auto-run paused");
	}

	function selectConversation(id: string) {
		setActiveId(id);
		setMobilePanel("conversation");
		setConversations((current) => current.map((conversation) => (conversation.id === id ? { ...conversation, unread: 0 } : conversation)));
	}

	function handleSend() {
		const body = draft.trim();
		if (!body) return;
		setConversations((current) =>
			current.map((conversation) =>
				conversation.id === active.id
					? {
							...conversation,
							preview: body,
							status: "human",
							messages: [
								...conversation.messages,
								{ id: `agent-${Date.now()}`, sender: "agent", body, time: "Now" },
							],
						}
					: conversation,
			),
		);
		setDraft("");
		setToast("Reply sent");
	}

	function takeOver() {
		setConversations((current) => current.map((conversation) => (conversation.id === active.id ? { ...conversation, status: "human" } : conversation)));
		setToast("Conversation assigned to you");
	}

	function resolveConversation() {
		setConversations((current) => current.map((conversation) => (conversation.id === active.id ? { ...conversation, status: "resolved" } : conversation)));
		setToast("Conversation resolved");
	}

	async function runAiReception() {
		const latestCustomerMessage = [...active.messages].reverse().find((message) => message.sender === "customer");
		if (!latestCustomerMessage) return;
		setAiRunning(true);
		try {
			const response = await fetch("/api/ai/reply", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					customerName: active.name,
					message: latestCustomerMessage.body,
					topic: active.topic,
					sentiment: active.sentiment,
					autoAnswerAt: settings.autoAnswerAt,
					suggestAt: settings.suggestAt,
					guardrails: {
						blockPayments: settings.blockPayments,
						blockRefunds: settings.blockRefunds,
						blockSensitiveData: settings.blockSensitiveData,
						handoffNegative: settings.handoffNegative,
					},
				}),
			});
			if (!response.ok) throw new Error("Reception request failed");
			const result = (await response.json()) as { reply: string; confidence: number; action: "auto_reply" | "suggest" | "handoff" };
			setConversations((current) =>
				current.map((conversation) => {
					if (conversation.id !== active.id) return conversation;
					if (result.action === "auto_reply" && settings.enabled) {
						return {
							...conversation,
							confidence: result.confidence,
							status: "ai",
							preview: result.reply,
							messages: [
								...conversation.messages,
								{ id: `ai-${Date.now()}`, sender: "ai", body: result.reply, time: "Now" },
							],
						};
					}
					return {
						...conversation,
						confidence: result.confidence,
						status: result.action === "handoff" ? "human" : "waiting",
						suggestedReply: result.reply,
					};
				}),
			);
			if (result.action !== "auto_reply") setDraft(result.reply);
			setToast(result.action === "auto_reply" ? "AI replied automatically" : result.action === "suggest" ? "AI suggestion ready" : "Escalated for human review");
		} catch {
			setDraft(active.suggestedReply ?? "Thanks for reaching out. I’m checking this with the team and will get back to you shortly.");
			setToast("Fallback suggestion loaded");
		} finally {
			setAiRunning(false);
		}
	}

	function changeView(nextView: View) {
		setView(nextView);
		if (nextView === "controls") setMobilePanel("controls");
		else setMobilePanel("list");
	}

	return (
		<div className="app-shell">
			<aside className="nav-rail" aria-label="Primary navigation">
				<div className="brand-mark" aria-label="Relay inbox">
					<span className="brand-bolt"><Zap size={17} fill="currentColor" /></span>
				</div>
				<nav className="nav-stack">
					<NavButton icon={Inbox} label="Inbox" active={view === "inbox"} badge={unreadTotal} onClick={() => changeView("inbox")} />
					<NavButton icon={UserRound} label="Assigned" active={view === "assigned"} badge={humanTotal} onClick={() => changeView("assigned")} />
					<NavButton icon={CheckCircle2} label="Resolved" active={view === "resolved"} onClick={() => changeView("resolved")} />
				</nav>
				<nav className="nav-stack nav-bottom">
					<NavButton icon={Settings} label="AI controls" active={view === "controls"} onClick={() => changeView("controls")} />
					<button className="avatar-button" type="button" aria-label="Account menu">OD</button>
				</nav>
			</aside>

			<section className={`conversation-list ${mobilePanel !== "list" ? "mobile-hidden" : ""}`}>
				<header className="list-header">
					<div className="eyebrow-row">
						<div>
							<span className="eyebrow">Workspace</span>
							<h1>Inbox</h1>
						</div>
						<div className="header-actions">
							<button
								type="button"
								className={`autorun-button ${settings.enabled ? "is-running" : ""}`}
								onClick={toggleAutorun}
								aria-pressed={settings.enabled}
								aria-label={settings.enabled ? "Pause Auto-run" : "Start Auto-run"}
							>
								<span className="autorun-icon">{settings.enabled ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</span>
								<span><strong>Auto-run</strong><small>{settings.enabled ? "Running" : "Paused"}</small></span>
							</button>
							<button className="icon-button" type="button" aria-label="Notifications"><Bell size={18} /></button>
						</div>
					</div>
					<div className="search-box">
						<Search size={16} />
						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
						{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
					</div>
					<div className="filter-row" role="group" aria-label="Inbox filters">
						{(["all", "unread", "human", "ai"] as InboxFilter[]).map((item) => (
							<button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
								{item === "all" ? "Open" : item === "ai" ? "AI handled" : item === "human" ? "Needs you" : "Unread"}
							</button>
						))}
					</div>
				</header>

				<div className="conversation-scroll">
					<div className="list-summary">
						<span>{filteredConversations.length} conversations</span>
						<button type="button">Newest <ChevronDown size={13} /></button>
					</div>
					{filteredConversations.map((conversation) => (
						<button
							type="button"
							key={conversation.id}
							className={`conversation-row ${active.id === conversation.id ? "is-active" : ""}`}
							onClick={() => selectConversation(conversation.id)}
						>
							<div className={`customer-avatar avatar-${conversation.initials.charCodeAt(0) % 4}`}>
								{conversation.initials}
								<ChannelBadge channel={conversation.channel} size="small" />
							</div>
							<div className="conversation-copy">
								<div className="conversation-title">
									<strong>{conversation.name}</strong>
									<span>{conversation.time}</span>
								</div>
								<p>{conversation.preview}</p>
								<div className="conversation-meta">
									<ConfidencePill score={conversation.confidence} />
									<span className={`status-label status-${conversation.status}`}>
										{conversation.status === "ai" ? "AI handled" : conversation.status === "human" ? "Needs you" : conversation.status === "resolved" ? "Resolved" : "Suggestion"}
									</span>
									{conversation.unread > 0 && <span className="unread-badge">{conversation.unread}</span>}
								</div>
							</div>
						</button>
					))}
					{filteredConversations.length === 0 && (
						<div className="empty-state"><Inbox size={26} /><strong>No conversations here</strong><span>Try another filter or search.</span></div>
					)}
				</div>
			</section>

			{view !== "controls" && (
				<main className={`thread-panel ${mobilePanel !== "conversation" ? "mobile-hidden" : ""}`}>
					<header className="thread-header">
						<button className="icon-button mobile-only" type="button" onClick={() => setMobilePanel("list")} aria-label="Back to inbox"><ArrowLeft size={19} /></button>
						<div className={`customer-avatar avatar-${active.initials.charCodeAt(0) % 4}`}>{active.initials}<ChannelBadge channel={active.channel} size="small" /></div>
						<div className="thread-title">
							<strong>{active.name}</strong>
							<span><span className="online-dot" /> {channelLabels[active.channel]} · Active now</span>
						</div>
						<div className="thread-actions">
							<button className="action-button secondary" type="button" onClick={takeOver}><UserRound size={15} /> Take over</button>
							<button className="action-button" type="button" onClick={resolveConversation}><Check size={15} /> Resolve</button>
							<button className="icon-button tablet-info" type="button" onClick={() => setMobilePanel("details")} aria-label="Customer details"><PanelRight size={18} /></button>
							<button className="icon-button" type="button" aria-label="More actions"><MoreHorizontal size={19} /></button>
						</div>
					</header>

					<div className="ai-status-strip">
						<div className="ai-orb"><Sparkles size={15} /></div>
						<div><strong>AI reception is {settings.enabled ? "active" : "paused"}</strong><span>Confidence for this conversation</span></div>
						<ConfidencePill score={active.confidence} />
						<span className="route-copy">
							{active.confidence >= settings.autoAnswerAt && active.status !== "human" ? "Auto-answer allowed" : active.confidence >= settings.suggestAt ? "Human review suggested" : "Human handoff required"}
						</span>
					</div>

					<div className="messages-scroll">
						<div className="date-divider"><span>Today</span></div>
						{active.messages.map((message) => (
							<div key={message.id} className={`message-line message-${message.sender}`}>
								{message.sender === "customer" && <div className={`mini-avatar avatar-${active.initials.charCodeAt(0) % 4}`}>{active.initials}</div>}
								{message.sender === "ai" && <div className="mini-avatar ai-avatar"><Bot size={15} /></div>}
								<div className="message-wrap">
									<div className="message-author">
										<strong>{message.sender === "customer" ? active.name : message.sender === "ai" ? "Relay AI" : "You"}</strong>
										{message.sender === "ai" && <span><Sparkles size={10} /> AI response</span>}
									</div>
									<div className="message-bubble"><p>{message.body}</p></div>
									<time>{message.time}{message.sender !== "customer" && " · Delivered"}</time>
								</div>
							</div>
						))}
						{active.suggestedReply && active.status !== "ai" && (
							<div className="suggestion-card">
								<div className="suggestion-title"><span><WandSparkles size={14} /> AI suggested reply</span><ConfidencePill score={active.confidence} /></div>
								<p>{active.suggestedReply}</p>
								<div><button type="button" onClick={() => setDraft(active.suggestedReply ?? "")}>Use reply</button><button type="button" onClick={runAiReception}>Regenerate</button></div>
							</div>
						)}
					</div>

					<footer className="composer-area">
						<div className="composer-tabs"><button className="active" type="button">Reply</button><button type="button">Internal note</button><span><ChannelBadge channel={active.channel} size="small" /> via {channelLabels[active.channel]}</span></div>
						<div className="composer">
							<textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Reply to ${active.name}…`} aria-label={`Reply to ${active.name}`} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleSend(); }} />
							<div className="composer-tools">
								<div><button type="button" aria-label="Attach file"><Paperclip size={17} /></button><button type="button" aria-label="Insert saved reply"><Zap size={17} /></button></div>
								<div className="composer-send">
									<button type="button" className="ai-draft-button" onClick={runAiReception} disabled={aiRunning}><Sparkles size={15} /> {aiRunning ? "Thinking…" : "Run AI"}</button>
									<button type="button" className="send-button" onClick={handleSend} disabled={!draft.trim()}><Send size={15} /> Send</button>
								</div>
							</div>
						</div>
						<span className="keyboard-hint">Press ⌘ Enter to send</span>
					</footer>
				</main>
			)}

			{view === "controls" && (
				<main className={`controls-main ${mobilePanel !== "controls" ? "mobile-hidden" : ""}`}>
					<div className="controls-hero">
						<button className="icon-button mobile-only" type="button" onClick={() => { setView("inbox"); setMobilePanel("list"); }} aria-label="Back to inbox"><ArrowLeft size={19} /></button>
						<div className="hero-icon"><Bot size={24} /></div>
						<div><span className="eyebrow">Automation</span><h2>AI reception controls</h2><p>Choose exactly when Relay answers, suggests, or hands a conversation to your team.</p></div>
					</div>
					<ControlCenter settings={settings} updateSettings={updateSettings} full />
				</main>
			)}

			{view !== "controls" && (
				<aside className={`detail-panel ${mobilePanel !== "details" ? "mobile-hidden" : ""}`}>
					<div className="detail-mobile-header"><button className="icon-button" type="button" onClick={() => setMobilePanel("conversation")}><ArrowLeft size={18} /></button><strong>Customer details</strong></div>
					<section className="customer-card">
						<div className={`customer-avatar large avatar-${active.initials.charCodeAt(0) % 4}`}>{active.initials}<span className="presence-dot" /></div>
						<h2>{active.name}</h2>
						<span className="customer-handle">{active.email ?? active.phone ?? `@${active.name.toLowerCase().replace(" ", "")}`}</span>
						<div className="customer-actions"><button type="button"><Mail size={16} /></button><button type="button"><Tag size={16} /></button><button type="button"><MoreHorizontal size={16} /></button></div>
					</section>
					<section className="detail-section">
						<h3>Conversation</h3>
						<DetailRow icon={Inbox} label="Topic" value={active.topic} />
						<DetailRow icon={Bot} label="AI confidence" value={`${active.confidence}% · ${confidenceBand(active.confidence)}`} />
						<DetailRow icon={Clock3} label="First response" value="Under 1 min" />
						<DetailRow icon={Globe2} label="Language" value="English" />
					</section>
					<section className="detail-section">
						<h3>Customer</h3>
						<DetailRow icon={Globe2} label="Location" value={active.location} />
						<DetailRow icon={Archive} label="Customer since" value={active.customerSince} />
						<DetailRow icon={CheckCircle2} label="Previous orders" value={String(active.orders)} />
					</section>
					<div className="detail-ai-card">
						<div><span className="ai-orb"><Sparkles size={14} /></span><strong>AI summary</strong></div>
						<p>{active.name} contacted the team about {active.topic.toLowerCase()}. Sentiment is {active.sentiment}; current route is {active.status === "human" ? "human review" : active.status === "ai" ? "AI handling" : "reply suggestion"}.</p>
					</div>
				</aside>
			)}

			{toast && <div className="toast-message"><CheckCircle2 size={17} /> {toast}</div>}
		</div>
	);
}

function NavButton({ icon: Icon, label, active, badge, onClick }: { icon: LucideIcon; label: string; active: boolean; badge?: number; onClick: () => void }) {
	return (
		<button type="button" className={`nav-button ${active ? "is-active" : ""}`} onClick={onClick} aria-label={label} title={label}>
			<span><Icon size={20} />{badge ? <b>{badge}</b> : null}</span>
			<small>{label}</small>
		</button>
	);
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
	return <div className="detail-row"><Icon size={15} /><span>{label}</span><strong>{value}</strong></div>;
}

function ControlCenter({ settings, updateSettings, full = false }: { settings: ReceptionSettings; updateSettings: (patch: Partial<ReceptionSettings>) => void; full?: boolean }) {
	const enabledChannels = Object.values(settings.channels).filter(Boolean).length;
	return (
		<div className={`control-grid ${full ? "is-full" : ""}`}>
			<section className="control-card reception-master">
				<div className="control-heading">
					<span className="control-icon purple"><Sparkles size={17} /></span>
					<div><h3>AI receptionist</h3><p>Master control for automated handling</p></div>
					<Toggle checked={settings.enabled} onChange={() => updateSettings({ enabled: !settings.enabled })} label="Enable AI receptionist" />
				</div>
				<div className={`system-status ${settings.enabled ? "online" : "offline"}`}><span /><strong>{settings.enabled ? "Online" : "Paused"}</strong><small>{settings.enabled ? `Listening on ${enabledChannels} channels` : "No automatic actions will run"}</small></div>
			</section>

			<section className="control-card thresholds-card">
				<div className="card-title"><span className="control-icon green"><ShieldCheck size={17} /></span><div><h3>Confidence routing</h3><p>Rules are enforced after every AI response</p></div></div>
				<div className="threshold-control">
					<div><label htmlFor="auto-threshold">Auto-answer</label><strong>{settings.autoAnswerAt}%+</strong></div>
					<input id="auto-threshold" type="range" min="65" max="98" value={settings.autoAnswerAt} onChange={(event) => updateSettings({ autoAnswerAt: Number(event.target.value) })} />
					<p><span className="dot dot-green" /> Send instantly when confidence is high.</p>
				</div>
				<div className="threshold-control">
					<div><label htmlFor="suggest-threshold">Suggest a reply</label><strong>{settings.suggestAt}–{settings.autoAnswerAt - 1}%</strong></div>
					<input id="suggest-threshold" type="range" min="35" max={settings.autoAnswerAt - 5} value={Math.min(settings.suggestAt, settings.autoAnswerAt - 5)} onChange={(event) => updateSettings({ suggestAt: Number(event.target.value) })} />
					<p><span className="dot dot-amber" /> Draft for a teammate to review.</p>
				</div>
				<div className="handoff-rule"><span className="dot dot-red" /><div><strong>Human handoff</strong><small>Below {settings.suggestAt}% or whenever a guardrail applies</small></div></div>
			</section>

			<section className="control-card">
				<div className="card-title"><span className="control-icon blue"><MessageCircle size={17} /></span><div><h3>Connected channels</h3><p>Choose where AI reception is active</p></div></div>
				<div className="channel-controls">
					{(Object.keys(settings.channels) as Channel[]).map((channel) => (
						<div className="toggle-row" key={channel}><ChannelBadge channel={channel} /><div><strong>{channelLabels[channel]}</strong><small>{channel === "sms" ? "Ready to connect" : "Connected"}</small></div><Toggle checked={settings.channels[channel]} onChange={() => updateSettings({ channels: { ...settings.channels, [channel]: !settings.channels[channel] } })} label={`Enable ${channelLabels[channel]}`} /></div>
					))}
				</div>
			</section>

			<section className="control-card">
				<div className="card-title"><span className="control-icon amber"><CircleHelp size={17} /></span><div><h3>Human guardrails</h3><p>Always keep sensitive requests with people</p></div></div>
				<div className="guardrail-list">
					<SettingsRow title="Payments & charge disputes" description="Never authorize or change payments" checked={settings.blockPayments} onChange={() => updateSettings({ blockPayments: !settings.blockPayments })} />
					<SettingsRow title="Refunds & cancellations" description="Require agent approval before action" checked={settings.blockRefunds} onChange={() => updateSettings({ blockRefunds: !settings.blockRefunds })} />
					<SettingsRow title="Sensitive personal data" description="Escalate account and identity changes" checked={settings.blockSensitiveData} onChange={() => updateSettings({ blockSensitiveData: !settings.blockSensitiveData })} />
					<SettingsRow title="Negative sentiment" description="Bring in a person when frustration is detected" checked={settings.handoffNegative} onChange={() => updateSettings({ handoffNegative: !settings.handoffNegative })} />
				</div>
			</section>

			<section className="control-card">
				<div className="card-title"><span className="control-icon pink"><WandSparkles size={17} /></span><div><h3>Behavior</h3><p>Shape how the receptionist works</p></div></div>
				<div className="guardrail-list">
					<SettingsRow title="Use brand voice" description="Friendly, concise, and action-oriented" checked={settings.brandVoice} onChange={() => updateSettings({ brandVoice: !settings.brandVoice })} />
					<SettingsRow title="Learn from agent edits" description="Use approved replies to improve suggestions" checked={settings.learnFromEdits} onChange={() => updateSettings({ learnFromEdits: !settings.learnFromEdits })} />
					<SettingsRow title="Business hours only" description="Pause auto-answering outside your schedule" checked={settings.businessHoursOnly} onChange={() => updateSettings({ businessHoursOnly: !settings.businessHoursOnly })} />
				</div>
			</section>

			<section className="control-card deployment-card">
				<div className="card-title"><span className="control-icon slate"><Smartphone size={17} /></span><div><h3>Runs everywhere</h3><p>Install the dashboard on any primary device</p></div></div>
				<div className="device-row"><span><Menu size={15} /> Laptop</span><span><Smartphone size={15} /> Android & iOS</span><span><PanelRight size={15} /> Tablet</span></div>
				<p className="deployment-note"><Info size={14} /> Install from the browser for a full-screen app experience. Controls sync once a production database is connected.</p>
			</section>
		</div>
	);
}

function SettingsRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) {
	return <div className="toggle-row"><div><strong>{title}</strong><small>{description}</small></div><Toggle checked={checked} onChange={onChange} label={title} /></div>;
}

export default App;
