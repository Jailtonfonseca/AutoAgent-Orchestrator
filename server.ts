import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { TaskRunner } from "./src/backend/runner";
import { credentialStore } from "./src/backend/credentials";
import { getLLMConfig, setLLMConfig } from "./src/backend/llm";
import { getTasks, getMessages, saveTask } from "./src/backend/db";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const runners = new Map<string, TaskRunner>();
  const taskConfigs = new Map<string, any>();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/config/llm", (req, res) => {
    const config = getLLMConfig();
    if (config) {
      res.json({ configured: true, provider: config.provider, model: config.model });
    } else {
      res.json({ configured: false });
    }
  });

  app.post("/api/config/llm", (req, res) => {
    const { provider, apiKey, model } = req.body;
    setLLMConfig({ provider, apiKey, model });
    res.json({ status: "ok" });
  });

  app.post("/api/start-task", (req, res) => {
    const { task, model, max_agents, auto_apply, user_id, language } = req.body;
    const taskId = uuidv4();
    taskConfigs.set(taskId, { task, model, max_agents, auto_apply, user_id, language, task_id: taskId });
    saveTask(taskId, task, model, language || "English");
    res.json({ task_id: taskId, ws: `/ws/${taskId}` });
  });

  app.get("/api/history", (req, res) => {
    res.json(getTasks());
  });

  app.get("/api/history/:task_id", (req, res) => {
    res.json(getMessages(req.params.task_id));
  });

  app.post("/api/credentials", (req, res) => {
    const { user_id, provider, value } = req.body;
    credentialStore.set(user_id, provider, value);
    res.json({ status: "ok" });
  });

  app.delete("/api/credentials/:user_id/:provider", (req, res) => {
    credentialStore.delete(req.params.user_id, req.params.provider);
    res.json({ status: "ok" });
  });

  app.get("/api/credentials/:user_id", (req, res) => {
    const providers = credentialStore.listProviders(req.params.user_id);
    res.json(providers.map(p => ({ provider: p, status: "active" })));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Setup
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const taskId = url.pathname.split("/").pop();

    if (taskId && taskId !== "ws") {
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.cmd === "stop") {
            runners.get(taskId)?.stop();
          } else if (msg.cmd === "user_input") {
            runners.get(taskId)?.handleUserInput(msg.text);
          }
        } catch (e) {
          console.error("WS Message error:", e);
        }
      });

      // Start the runner
      const config = taskConfigs.get(taskId) || {
        task: "Research the latest trends in AI agents and write a summary.",
        model: "gemini-3-flash-preview",
        max_agents: 3,
        auto_apply: true,
        user_id: "demo-user",
        language: "English"
      };

      const runner = new TaskRunner(ws, config);
      runners.set(taskId, runner);
      runner.run().finally(() => {
        runners.delete(taskId);
        taskConfigs.delete(taskId);
      });
    }
  });
}

startServer();
