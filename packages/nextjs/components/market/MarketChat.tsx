"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount } from "wagmi";

interface MarketChatProps {
  marketId: bigint;
  userHasBet: boolean;
  isSettled: boolean;
}

interface ChatMessage {
  id: string;
  anonId: string;
  text: string;
  timestamp: number;
  color: string;
}

const ANON_COLORS = [
  "#4ade80", "#f87171", "#facc15", "#a78bfa",
  "#38bdf8", "#fb923c", "#f472b6", "#34d399",
  "#e879f9", "#fbbf24", "#60a5fa", "#c084fc",
];

function getAnonId(address: string, marketId: string): string {
  // Simple hash to generate consistent anonymous ID per market
  let hash = 0;
  const str = address.toLowerCase() + marketId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 9999;
  return `Anon-${num.toString().padStart(4, "0")}`;
}

function getAnonColor(anonId: string): string {
  let hash = 0;
  for (let i = 0; i < anonId.length; i++) {
    hash = ((hash << 5) - hash + anonId.charCodeAt(i)) | 0;
  }
  return ANON_COLORS[Math.abs(hash) % ANON_COLORS.length];
}

function getChatKey(marketId: string): string {
  return `umbra-chat-${marketId}`;
}

function loadMessages(marketId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getChatKey(marketId));
    if (!raw) return [];
    const msgs = JSON.parse(raw) as ChatMessage[];
    // Only keep messages from last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return msgs.filter(m => m.timestamp > cutoff);
  } catch {
    return [];
  }
}

function saveMessages(marketId: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getChatKey(marketId), JSON.stringify(messages));
  } catch {}
}

function clearChat(marketId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getChatKey(marketId));
  } catch {}
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const MarketChat = ({ marketId, userHasBet, isSettled }: MarketChatProps) => {
  const { address } = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const mid = marketId.toString();
  const myAnonId = address ? getAnonId(address, mid) : "";
  const myColor = getAnonColor(myAnonId);

  // Load and poll for messages
  const refresh = useCallback(() => {
    if (isSettled) {
      clearChat(mid);
      setMessages([]);
      return;
    }
    setMessages(loadMessages(mid));
  }, [mid, isSettled]);

  useEffect(() => {
    refresh();
    // Poll every 2 seconds for new messages (simulates real-time for local storage)
    pollRef.current = setInterval(refresh, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refresh]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clear chat when market settles
  useEffect(() => {
    if (isSettled) {
      clearChat(mid);
      setMessages([]);
    }
  }, [isSettled, mid]);

  const sendMessage = () => {
    if (!input.trim() || !address || !userHasBet) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      anonId: myAnonId,
      text: input.trim(),
      timestamp: Date.now(),
      color: myColor,
    };

    const updated = [...loadMessages(mid), msg];
    saveMessages(mid, updated);
    setMessages(updated);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Collapsed state — just show toggle button
  if (!isOpen) {
    return (
      <div className="card" style={{ padding: "12px 16px", marginBottom: 12, cursor: "pointer" }} onClick={() => setIsOpen(true)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
              Encrypted Chat
            </span>
            {messages.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "var(--bg)",
                background: "var(--text-2)", borderRadius: 100,
                padding: "1px 6px", minWidth: 18, textAlign: "center",
              }}>
                {messages.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!userHasBet && (
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>Bet to unlock</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="card" style={{ marginBottom: 12, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Encrypted Chat</span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>· ephemeral · anonymous</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </div>

      {/* Gated content */}
      {!userHasBet ? (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" style={{ margin: "0 auto 10px", display: "block" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 4 }}>Chat is locked</p>
          <p style={{ fontSize: 11, color: "var(--text-3)" }}>Place a bet to join the conversation</p>
        </div>
      ) : isSettled ? (
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>Market settled — chat has been wiped</p>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>All messages are ephemeral by design</p>
        </div>
      ) : (
        <>
          {/* Your identity */}
          <div style={{
            padding: "6px 16px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: myColor }} />
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>You are</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: myColor, fontFamily: "'JetBrains Mono'" }}>{myAnonId}</span>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              height: 240,
              overflowY: "auto",
              padding: "12px 16px",
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>No messages yet</p>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Say something — no one knows who you are</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.anonId === myAnonId;
                return (
                  <div key={msg.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: msg.color }} />
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isMe ? msg.color : "var(--text-2)",
                        fontFamily: "'JetBrains Mono'",
                      }}>
                        {msg.anonId}{isMe ? " (you)" : ""}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 13, color: "var(--text)",
                      paddingLeft: 11, lineHeight: 1.4,
                      wordBreak: "break-word",
                      fontFamily: "var(--font-chat), cursive",
                    }}>
                      {msg.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border)",
            display: "flex", gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 280))}
              onKeyDown={handleKeyDown}
              placeholder="Type anonymously..."
              style={{
                flex: 1, padding: "8px 12px",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text)",
                fontSize: 13, outline: "none",
                fontFamily: "var(--font-chat), cursive",
              }}
              maxLength={280}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                padding: "8px 14px", background: input.trim() ? "var(--text)" : "var(--surface-2)",
                color: input.trim() ? "var(--bg)" : "var(--text-3)",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: input.trim() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              Send
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            padding: "6px 16px 8px",
            display: "flex", alignItems: "center", gap: 4,
            borderTop: "1px solid var(--border)",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>
              Messages are ephemeral and will be wiped when this market settles
            </span>
          </div>
        </>
      )}
    </div>
  );
};