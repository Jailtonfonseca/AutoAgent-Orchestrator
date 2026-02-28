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
    const isPt = this.config.language === 'Portuguese';
    this.pushEvent(MessageKind.INFO, { 
      msg: isPt ? "Analisando o problema e recrutando a equipe ideal..." : "Analyzing task and recruiting the ideal team...", 
      ts: Date.now() 
    });
    
    try {
      // Simulate AgentBuilder
      const builderPrompt = `Analyze the following task and determine the ideal team of AI agents needed to solve it.
Task: ${this.config.task}

Return ONLY a JSON array of objects. Each object must have a "name" (string, no spaces, e.g., "MarketingExpert") and a "role" (string, detailed description of their responsibilities).
Maximum number of agents: ${this.config.max_agents || 3}.`;

      const builderSystemPrompt = "You are an expert AI team builder. Return ONLY valid JSON.";
      
      const builderResponse = await generateContent(builderSystemPrompt, builderPrompt, true);
      const cleanedResponse = builderResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      this.agents = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(this.agents) || this.agents.length === 0) {
        // Fallback if parsing fails or returns empty
        this.agents = [
          { name: "Analyst", role: "Analyze the core requirements" },
          { name: "Executor", role: "Execute the plan" }
        ];
      }

      const agentNames = this.agents.map(a => a.name).join(", ");
      this.pushEvent(MessageKind.INFO, { 
        msg: isPt ? `Equipe contratada autonomamente: [${agentNames}]` : `Autonomously recruited team: [${agentNames}]`, 
        ts: Date.now() 
      });
      this.pushEvent(MessageKind.INFO, { 
        msg: isPt ? "--- Iniciando a Reunião de Trabalho ---" : "--- Starting Work Session ---", 
        ts: Date.now() 
      });

      let currentTurn = 0;
      const maxTurns = 15; // Increased to match the requested max_round=15
      let lastMessage = this.config.task;
      const conversationHistory: string[] = [`User Task: ${this.config.task}`];

      while (this.isRunning && currentTurn < maxTurns) {
        const agent = this.agents[currentTurn % this.agents.length];
        const recipient = this.agents[(currentTurn + 1) % this.agents.length].name;
        
        this.pushEvent(MessageKind.INFO, { 
          msg: isPt ? `${agent.name} está pensando...` : `${agent.name} is thinking...`, 
          ts: Date.now() 
        });

        // Simulate agent generation
        const systemPrompt = `You are ${agent.name}, a ${agent.role}. Task: ${this.config.task}. Continue the work. If you need a specific API key (like GitHub, Slack, etc.), explicitly state: "I need a [provider] credential for [reason]".\n\nIMPORTANT: You must write all your responses and thoughts in ${this.config.language || 'English'}.`;
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
        const verification = await verifier.verify(this.config.task, agent.name, recipient, content, this.config.language);
        this.pushEvent(MessageKind.VERIFIER_RESULT, verification);

        // Handle actions
        await this.applyActions(verification);

        lastMessage = content;
        conversationHistory.push(`${agent.name}: ${content}`);
        currentTurn++;
        
        if (content.toLowerCase().includes("task complete") || content.toLowerCase().includes("finished") || content.toLowerCase().includes("tarefa concluída")) {
          break;
        }
      }

      this.pushEvent(MessageKind.INFO, { 
        msg: isPt ? "Execução da tarefa concluída. Gerando infográfico final..." : "Task execution completed. Generating final infographic...", 
        ts: Date.now() 
      });

      // Generate Infographic
      const infographicPrompt = `Based on the following conversation, generate a complete, visually appealing HTML infographic summarizing the final plan, target audience, channels, costs, and any other key data points.
Write all text in ${this.config.language || 'English'}.
Use modern CSS (you must use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>).
Make it look professional, modern, and ready to print or save as PDF. Use icons (e.g., FontAwesome CDN or SVG), cards, and clear typography.
The output must be a single, valid HTML file containing the visual summary.
Return ONLY the HTML code, starting with <!DOCTYPE html>.

Conversation History:
${conversationHistory.join("\n\n")}
`;

      const infographicSystemPrompt = "You are an expert designer and data analyst. Return ONLY valid HTML code. Do not include markdown formatting like ```html.";
      
      try {
        const htmlResponse = await generateContent(infographicSystemPrompt, infographicPrompt, false);
        const cleanedHtml = htmlResponse.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        this.pushEvent(MessageKind.INFOGRAPHIC_READY, {
          html: cleanedHtml,
          ts: Date.now()
        });
        
        this.pushEvent(MessageKind.INFO, { 
          msg: isPt ? "Infográfico gerado com sucesso!" : "Infographic generated successfully!", 
          ts: Date.now() 
        });
      } catch (e: any) {
        this.pushEvent(MessageKind.ERROR, { msg: `Failed to generate infographic: ${e.message}`, ts: Date.now() });
      }

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
