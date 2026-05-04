"use client";

import { useEffect } from "react";

interface SuccessModalProps {
  title: string;
  message: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export const SuccessModal = ({ title, message, onClose, autoCloseMs = 3000 }: SuccessModalProps) => {
  useEffect(() => {
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [onClose, autoCloseMs]);

  return (
    <div className="success-overlay" onClick={onClose}>
      <div className="success-modal" onClick={e => e.stopPropagation()}>
        {/* Animated checkmark */}
        <div style={{ marginBottom: 20 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: "0 auto" }}>
            <circle cx="28" cy="28" r="26" stroke="var(--border)" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="26" stroke="var(--green)" strokeWidth="1.5"
              strokeDasharray="163" strokeDashoffset="0"
              style={{ animation: "checkDraw 0.6s ease-out" }}
            />
            <path d="M18 28l7 7 13-13" stroke="var(--green)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="30" strokeDashoffset="0"
              style={{ animation: "checkDraw 0.4s ease-out 0.3s both" }}
            />
          </svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 20 }}>{message}</p>
        <button onClick={onClose} className="btn btn-white" style={{ padding: "10px 32px" }}>
          Done
        </button>
      </div>
    </div>
  );
};