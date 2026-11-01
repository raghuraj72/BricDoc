"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          Contact BricDoc Support
        </h1>
        <p className="text-xs text-slate-500">
          Have questions or need enterprise deployment guidance? Send us a message.
        </p>
      </div>

      {submitted ? (
        <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-3xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
            Message Received
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-sm mx-auto">
            Thank you, {name}. Our team will review your inquiry and follow up at {email} within 24 hours.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-soft-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Message
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help your team?"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-brand-600 hover:bg-brand-700 shadow-sm flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Message</span>
          </button>
        </form>
      )}
    </div>
  );
}
