import type { ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";

const CHAT_LOCAL_KEY = "sas_chat_bot_history";
const MAX_MESSAGES = 50;

export function getLocalChatMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CHAT_LOCAL_KEY,
    JSON.stringify(messages.slice(-MAX_MESSAGES))
  );
}

export function appendLocalChatMessage(
  role: ChatMessage["role"],
  content: string
): ChatMessage {
  const msg: ChatMessage = {
    id: generateId(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
  const existing = getLocalChatMessages();
  saveLocalChatMessages([...existing, msg]);
  return msg;
}

export function clearLocalChatMessages(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAT_LOCAL_KEY);
}
