import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import util from "util";
import { search } from "duck-duck-scrape";
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
import { saveTask, saveMessage } from "./db";

const execAsync = util.promisify(exec);

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
      saveMessage(this.config.task_id || "unknown", kind, payload, Date.now());
    }
  }

  public handleUserInput(text: string) {
    this.pushEvent(MessageKind.USER_MESSAGE, { text, ts: Date.now() });
    this.lastMessage = `User interruption/instruction: ${text}\n\nPrevious context: ${this.lastMessage}`;
    this.conversationHistory.push(`User: ${text}`);
  }

  private lastMessage: string = "";
  private conversationHistory: string[] = [];

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
      this.lastMessage = this.config.task;
      this.conversationHistory = [`User Task: ${this.config.task}`];

      while (this.isRunning && currentTurn < maxTurns) {
        const agent = this.agents[currentTurn % this.agents.length];
        const recipient = this.agents[(currentTurn + 1) % this.agents.length].name;
        
        this.pushEvent(MessageKind.INFO, { 
          msg: isPt ? `${agent.name} está pensando...` : `${agent.name} is thinking...`, 
          ts: Date.now() 
        });

        // Simulate agent generation
        const systemPrompt = `You are ${agent.name}, a ${agent.role}. Task: ${this.config.task}. Continue the work. If you need a specific API key (like GitHub, Slack, etc.), explicitly state: "I need a [provider] credential for [reason]. Instructions to get it: [instructions]".\n\nIMPORTANT: You must write all your responses and thoughts in ${this.config.language || 'English'}. If you need to execute code or search the web, state it clearly so the verifier can trigger the action.`;
        const prompt = `Previous context: ${this.lastMessage}`;
        
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

        this.lastMessage = content;
        this.conversationHistory.push(`${agent.name}: ${content}`);
        currentTurn++;
        
        if (content.toLowerCase().includes("task complete") || content.toLowerCase().includes("finished") || content.toLowerCase().includes("tarefa concluída")) {
          break;
        }
      }

      this.pushEvent(MessageKind.INFO, { 
        msg: isPt ? "Execução da tarefa concluída. Gerando resposta final completa..." : "Task execution completed. Generating final complete response...", 
        ts: Date.now() 
      });

      // Generate Final Output
      const finalPrompt = `Based on the following conversation, generate a complete, finished, and final response to the user's original task.
Write all text in ${this.config.language || 'English'}.
Format the output appropriately (Markdown, HTML, or plain text) based on what the user requested. If no specific format was requested, use well-structured Markdown.
Return ONLY the final content.

Conversation History:
${this.conversationHistory.join("\n\n")}
`;

      const finalSystemPrompt = "You are the final synthesizer agent. Return ONLY the final output content. Do not include meta-commentary.";
      
      try {
        const finalResponse = await generateContent(finalSystemPrompt, finalPrompt, false);

        this.pushEvent(MessageKind.FINAL_OUTPUT, {
          content: finalResponse,
          format: "markdown",
          ts: Date.now()
        });
        
        this.pushEvent(MessageKind.INFO, { 
          msg: isPt ? "Resposta final gerada com sucesso!" : "Final response generated successfully!", 
          ts: Date.now() 
        });
      } catch (e: any) {
        this.pushEvent(MessageKind.ERROR, { msg: `Failed to generate final output: ${e.message}`, ts: Date.now() });
      }

    } catch (error: any) {
      this.pushEvent(MessageKind.ERROR, { msg: error.message, ts: Date.now() });
    }
  }

  private async applyActions(verification: VerifierResult) {
    for (const action of verification.suggested_actions) {
      if (action.startsWith("request_credential:")) {
        const contentStr = action.substring("request_credential:".length);
        const firstColon = contentStr.indexOf(":");
        let provider = contentStr;
        let reason = "Required for task execution";
        let instructions = "";
        
        if (firstColon !== -1) {
          provider = contentStr.substring(0, firstColon);
          const rest = contentStr.substring(firstColon + 1);
          const pipeIndex = rest.indexOf("|");
          if (pipeIndex !== -1) {
            reason = rest.substring(0, pipeIndex);
            instructions = rest.substring(pipeIndex + 1);
          } else {
            reason = rest;
          }
        }
        await this.handleCredentialRequest(provider, reason, instructions);
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
        } else if (action.startsWith("execute_code:")) {
          const parts = action.split(":");
          const lang = parts[1];
          const base64Code = parts.slice(2).join(":");
          try {
            const code = Buffer.from(base64Code, 'base64').toString('utf-8');
            this.pushEvent(MessageKind.INFO, { msg: `Executing ${lang} code...`, ts: Date.now() });
            
            let output = "";
            if (lang.toLowerCase() === 'python' || lang.toLowerCase() === 'py') {
              const { stdout, stderr } = await execAsync(`python3 -c "${code.replace(/"/g, '\\"')}"`);
              output = stdout || stderr;
            } else if (lang.toLowerCase() === 'javascript' || lang.toLowerCase() === 'js' || lang.toLowerCase() === 'node') {
              const { stdout, stderr } = await execAsync(`node -e "${code.replace(/"/g, '\\"')}"`);
              output = stdout || stderr;
            } else {
              output = `Unsupported language: ${lang}`;
            }
            
            this.lastMessage = `Code Execution Result:\n${output}\n\nPrevious context: ${this.lastMessage}`;
            this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Code executed. Output: ${output.substring(0, 100)}...`, ts: Date.now() });
          } catch (e: any) {
            this.lastMessage = `Code Execution Failed:\n${e.message}\n\nPrevious context: ${this.lastMessage}`;
            this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Code execution failed: ${e.message}`, ts: Date.now() });
          }
        } else if (action.startsWith("search_web:")) {
          const query = action.split(":").slice(1).join(":");
          this.pushEvent(MessageKind.INFO, { msg: `Searching web for: ${query}...`, ts: Date.now() });
          try {
            const searchResults = await search(query);
            const topResults = searchResults.results.slice(0, 3).map(r => `${r.title}\n${r.url}\n${r.description}`).join("\n\n");
            this.lastMessage = `Web Search Results for "${query}":\n${topResults}\n\nPrevious context: ${this.lastMessage}`;
            this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Web search completed. Found ${searchResults.results.length} results.`, ts: Date.now() });
          } catch (e: any) {
            this.lastMessage = `Web Search Failed:\n${e.message}\n\nPrevious context: ${this.lastMessage}`;
            this.pushEvent(MessageKind.ACTION_RESULT, { action, detail: `Web search failed: ${e.message}`, ts: Date.now() });
          }
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

  private async handleCredentialRequest(provider: string, reason: string, instructions?: string) {
    const requestId = uuidv4();
    const request: CredentialRequest = {
      provider,
      description: reason,
      instructions,
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
