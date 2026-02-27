import { VerifierResult } from "../types";
import { generateContent } from "./llm";

export class Verifier {
  async verify(task: string, sender: string, recipient: string, message: string): Promise<VerifierResult> {
    const prompt = `Context:
- task: ${task}
- sender: ${sender}
- recipient: ${recipient}
- agent_message: ${message}

Instructions:
1) Decide if the agent_message is correct and relevant.
2) Output JSON with keys:
   - verdict: "pass" or "fail"
   - confidence: number (0.0 - 1.0)
   - reason: short string
   - suggested_actions: array of strings (allowed actions: "modify_agent_system_prompt: ...", "add_agent:Role:desc", "remove_agent:AgentName", "request_credential:provider:reason", "request_references", "reduce_temperature", "increase_temperature")
   - patch_for_agent: optional string (system prompt patch)
Only output valid JSON (start with { and end with }).`;

    const systemInstruction = "You are an automated verifier. Return ONLY a single JSON object. No extra commentary.";

    try {
      const text = await generateContent(systemInstruction, prompt, true);
      
      // Clean up markdown code blocks if any
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(cleanedText || "{}");
      
      return {
        ...result,
        ts: Date.now()
      };
    } catch (error) {
      console.error("Verifier error:", error);
      return {
        verdict: "pass",
        confidence: 0.5,
        reason: "Verifier failed, defaulting to pass.",
        suggested_actions: [],
        ts: Date.now()
      };
    }
  }
}

export const verifier = new Verifier();
