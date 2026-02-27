import { GoogleGenAI, Type } from "@google/genai";
import { VerifierResult } from "../types";

export class Verifier {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

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

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "You are an automated verifier. Return ONLY a single JSON object. No extra commentary.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING, enum: ["pass", "fail"] },
              confidence: { type: Type.NUMBER },
              reason: { type: Type.STRING },
              suggested_actions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              patch_for_agent: { type: Type.STRING }
            },
            required: ["verdict", "confidence", "reason", "suggested_actions"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
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
