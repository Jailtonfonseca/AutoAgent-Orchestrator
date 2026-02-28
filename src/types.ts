import { Type } from "@google/genai";

export enum MessageKind {
  AGENT_MESSAGE = "agent_message",
  VERIFIER_RESULT = "verifier_result",
  CREDENTIAL_REQUEST = "credential_request",
  ACTION_RESULT = "action_result",
  INFO = "info",
  ERROR = "error",
  FINISHED = "finished",
  INFOGRAPHIC_READY = "infographic_ready",
}

export interface AgentMessage {
  sender: string;
  recipient: string;
  content: string;
  ts: number;
}

export interface VerifierResult {
  verdict: "pass" | "fail";
  confidence: number;
  reason: string;
  suggested_actions: string[];
  patch_for_agent?: string;
  ts: number;
}

export interface CredentialRequest {
  provider: string;
  description: string;
  scope?: string;
  request_id: string;
  user_id: string;
  sensitivity: "high" | "medium" | "low";
  ts: number;
}

export interface ActionResult {
  action: string;
  detail: string;
  ts: number;
}

export interface InfographicPayload {
  html: string;
  ts: number;
}

export interface WSMessage {
  kind: MessageKind;
  payload: any;
}

export interface TaskConfig {
  task: string;
  model: string;
  max_agents: number;
  auto_apply: boolean;
  user_id: string;
  language?: string;
}
