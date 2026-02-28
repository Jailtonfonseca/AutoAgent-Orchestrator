import { GoogleGenAI } from "@google/genai";

export type Provider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek' | 'groq';

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
  
  if (provider === 'openai' || provider === 'openrouter' || provider === 'deepseek' || provider === 'groq') {
    let baseUrl = "https://api.openai.com/v1/chat/completions";
    let defaultModel = "gpt-4o";
    
    if (provider === 'openrouter') {
      baseUrl = "https://openrouter.ai/api/v1/chat/completions";
      defaultModel = "openai/gpt-4o";
    } else if (provider === 'deepseek') {
      baseUrl = "https://api.deepseek.com/v1/chat/completions";
      defaultModel = "deepseek-chat";
    } else if (provider === 'groq') {
      baseUrl = "https://api.groq.com/openai/v1/chat/completions";
      defaultModel = "llama3-8b-8192";
    }
      
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(provider === 'openrouter' ? { "HTTP-Referer": process.env.APP_URL || "http://localhost:3000", "X-Title": "AutoAgent" } : {})
      },
      body: JSON.stringify({
        model: model || defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: jsonMode && (provider === 'openai' || provider === 'groq') ? { type: "json_object" } : undefined
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
