import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { TaskRunner } from "./src/backend/runner";
import { credentialStore } from "./src/backend/credentials";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const runners = new Map<string, TaskRunner>();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/start-task", (req, res) => {
    const { task, model, max_agents, auto_apply, user_id } = req.body;
    const taskId = uuidv4();
    res.json({ task_id: taskId, ws: `/ws/${taskId}` });
  });

  app.post("/api/credentials", (req, res) => {
    const { user_id, provider, value } = req.body;
    credentialStore.set(user_id, provider, value);
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
          }
        } catch (e) {
          console.error("WS Message error:", e);
        }
      });

      // Start the runner
      // In a real app, we'd get the config from a DB using taskId
      // For this demo, we'll assume the client sends config or we mock it
      // Let's wait for a 'start' command or just mock it for now
      // Actually, the /start-task should probably pass the config
      // We'll use a simple mock config for the demo
      const mockConfig = {
        task: "Research the latest trends in AI agents and write a summary.",
        model: "gemini-3-flash-preview",
        max_agents: 3,
        auto_apply: true,
        user_id: "demo-user"
      };

      const runner = new TaskRunner(ws, mockConfig);
      runners.set(taskId, runner);
      runner.run().finally(() => runners.delete(taskId));
    }
  });
}

startServer();
