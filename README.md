# AutoAgent Orchestrator

## Overview
This application implements a multi-agent orchestration system inspired by AutoGen. It features:
- **Dynamic Credential Management**: Agents can request API keys at runtime. The system pauses and prompts the user via the UI.
- **LLM Verification**: Every agent message is verified by a separate LLM "Verifier" to ensure quality and safety.
- **Real-time Audit Trail**: Full visibility into agent interactions and verifier decisions via WebSockets.

## Architecture
- **Backend**: Express.js with WebSocket support.
- **Frontend**: React 18 with Tailwind CSS and Framer Motion.
- **Agent Logic**: Orchestrated using Gemini API.
- **Credential Store**: Encrypted storage using AES-256-GCM.

## Setup
1. Ensure `GEMINI_API_KEY` is set in your environment.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the development server.

## Security
- Credentials are encrypted at rest.
- Sensitive values are never sent over WebSockets or logged.
- JWT-based authentication (simulated for demo).
