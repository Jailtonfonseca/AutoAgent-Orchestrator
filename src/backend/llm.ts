import { GoogleGenAI } from "@google/genai";

export type Provider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface LLMConfig {
  provider: Provider;
  apiKey: string;
  model: string;
}

let currentConfig: LLMConfig | null = null;

export function setLLMConfig(config: LLMConfig) {
  currentConfig = config;
}

export function getLLMConfig(): LLMConfig | null {
  return currentConfig;
}

export async function generateContent(systemPrompt: string, prompt: string, jsonMode: boolean = false): Promise<string> {
  if (!currentConfig) throw new Error("LLM not configured");

  const { provider, apiKey, model } = currentConfig;

  if (provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: jsonMode ? "application/json" : "text/plain",
      }
    });
    return response.text || "";
  } 
  
  if (provider === 'openai' || provider === 'openrouter') {
    const baseUrl = provider === 'openrouter' 
      ? "https://openrouter.ai/api/v1/chat/completions" 
      : "https://api.openai.com/v1/chat/completions";
      
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(provider === 'openrouter' ? { "HTTP-Referer": process.env.APP_URL || "http://localhost:3000", "X-Title": "AutoAgent" } : {})
      },
      body: JSON.stringify({
        model: model || (provider === 'openai' ? "gpt-4o" : "openai/gpt-4o"),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: jsonMode && provider === 'openai' ? { type: "json_object" } : undefined
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API Error: ${err}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === 'anthropic') {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: prompt + (jsonMode ? "\n\nRespond ONLY with valid JSON." : "") }
        ]
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API Error: ${err}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
