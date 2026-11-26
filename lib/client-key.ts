"use client";

import { useSyncExternalStore } from "react";

const SESSION_KEY_STORAGE = "unibrief_session_groq_key";
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): string {
  try {
    return window.sessionStorage.getItem(SESSION_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

export function getClientGroqKey(): string {
  if (typeof window === "undefined") return "";
  return getSnapshot().trim();
}

export function setClientGroqKey(value: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = value.trim();
    if (clean) {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE, clean);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE);
    }
    listeners.forEach((fn) => fn());
  } catch {
    // Ignore storage errors
  }
}

export function useClientGroqKey(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
