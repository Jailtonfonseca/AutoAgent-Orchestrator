import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { 
  TaskConfig, 
  MessageKind, 
  WSMessage, 
  AgentMessage, 
  VerifierResult, 
  CredentialRequest, 
  ActionResult 
} from "../types";
import { verifier } from "./verifier";
import { credentialStore } from "./credentials";
import { generateContent } from "./llm";

export class TaskRunner {
  private ws: WebSocket;
  private config: TaskConfig;
  private agents: any[] = [];
  private isRunning: boolean = true;

  constructor(ws: WebSocket, config: TaskConfig) {
    this.ws = ws;
    this.config = config;
  }

  private pushEvent(kind: MessageKind, payload: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const msg: WSMessage = { kind, payload };
      this.ws.send(JSON.stringify(msg));
    }
  }

  async run() {
    this.pushEvent(MessageKind.INFO, { msg: "Initializing agents...", ts: Date.now() });
    
    // Simulate AgentBuilder
    this.agents = [
      { name: "Researcher", role: "Gather information" },
      { name: "Writer", role: "Synthesize findings" }
    ];

    try {
      let currentTurn = 0;
      const maxTurns = 5;
      let lastMessage = this.config.task;

      while (this.isRunning && currentTurn < maxTurns) {
        const agent = this.agents[currentTurn % this.agents.length];
        const recipient = this.agents[(currentTurn + 1) % this.agents.length].name;
        
        this.pushEvent(MessageKind.INFO, { msg: `${agent.name} is thinking...`, ts: Date.now() });

        // Simulate agent generation
        const systemPrompt = `You are ${agent.name}, a ${agent.role}. Task: ${this.config.task}. Continue the work. If you need a specific API key (like GitHub, Slack, etc.), explicitly state: "I need a [provider] credential for [reason]".`;
        const prompt = `Previous context: ${lastMessage}`;
        
        const content = await generateContent(systemPrompt, prompt, false);

        const msg: AgentMessage = {
          sender: agent.name,
          recipient,
          content,
          ts: Date.now()
        };
        this.pushEvent(MessageKind.AGENT_MESSAGE, msg);

        // Verify
        const verification = await verifier.verify(this.config.task, agent.name, recipient, content);
        this.pushEvent(MessageKind.VERIFIER_RESULT, verification);

        // Handle actions
        await this.applyActions(verification);

        lastMessage = content;
        currentTurn++;
        
        if (content.toLowerCase().includes("task complete") || content.toLowerCase().includes("finished")) {
          break;
        }
      }

      this.pushEvent(MessageKind.FINISHED, { msg: "Task execution completed.", ts: Date.now() });
    } catch (error: any) {
      this.pushEvent(MessageKind.ERROR, { msg: error.message, ts: Date.now() });
    }
  }

  private async applyActions(verification: VerifierResult) {
    for (const action of verification.suggested_actions) {
      if (action.startsWith("request_credential:")) {
        const parts = action.split(":");
        const provider = parts[1];
        const reason = parts.slice(2).join(":");
        await this.handleCredentialRequest(provider, reason);
      } else if (this.config.auto_apply) {
        if (action.startsWith("add_agent:")) {
          const parts = action.split(":");
          const role = parts[1];
          const desc = parts.slice(2).join(":");
          this.agents.push({ name: role, role: desc });
          this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Agent added: ${role}`, ts: Date.now() });
        } else if (action.startsWith("remove_agent:")) {
          const name = action.split(":")[1];
          this.agents = this.agents.filter(a => a.name !== name);
          this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Agent removed: ${name}`, ts: Date.now() });
        } else if (action.startsWith("modify_agent_system_prompt:")) {
          const patch = action.split(":").slice(1).join(":");
          this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `System prompt patched: ${patch}`, ts: Date.now() });
        } else {
          this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Automatically applied: ${action}`, ts: Date.now() });
        }
      } else {
        this.pushEvent(MessageKind.INFO, { 
          msg: `Suggested action (requires manual approval): ${action}`, 
          ts: Date.now() 
        });
      }
    }
  }

  private async handleCredentialRequest(provider: string, reason: string) {
    const requestId = uuidv4();
    const request: CredentialRequest = {
      provider,
      description: reason,
      request_id: requestId,
      user_id: this.config.user_id,
      sensitivity: "high",
      ts: Date.now()
    };

    this.pushEvent(MessageKind.CREDENTIAL_REQUEST, request);
    this.pushEvent(MessageKind.INFO, { msg: `Paused: Waiting for ${provider} credential...`, ts: Date.now() });

    const value = await credentialStore.waitFor(this.config.user_id, provider);
    
    if (value) {
      this.pushEvent(MessageKind.ACTION_RESULT, { 
        action: "credential_provided", 
        detail: `${provider} credential received. Resuming...`, 
        ts: Date.now() 
      });
    } else {
      throw new Error(`Timeout waiting for ${provider} credential.`);
    }
  }

  stop() {
    this.isRunning = false;
  }
}
