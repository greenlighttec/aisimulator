# aisimulator (🎮 AI-Powered Visual Novel Engine)
A narrative-driven visual novel framework powered by OpenAI's Assistants API, styled after the immersive pacing and storytelling of Ren'Py — but built for the web using Next.js and Flask.

This requires 2 containers to run, one Flask OpenAI Proxy and the other Next.JS front end.

## 🚀 What it will eventually do

- ✅ AI generates dynamic branching scenes, character dialogue, and backgrounds.
- ✅ Fully streamed responses — no waiting for entire paragraphs to finish.
- ✅ Branch-based storytelling with visual backgrounds and stylized character dialogue.
- ✅ Supports custom player input or selectable choices (Ren'Py-style menus).
- ✅ Personalities and narrative context persist using OpenAI Assistants + Threads.

## OpenAI Only Supported
This app does not support Azure OpenAI at this point

You will need the environment variable `OPENAI_API_KEY` set so it connects to OpenAI

## Backend API Container
You'll need to specify the `NEXT_PUBLIC_API_URL` envirnoment variable so that the Next.JS frontend knows where to direct API calls to

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (TypeScript + TailwindCSS)
- **Backend:** Flask + OpenAI Python SDK
- **Image Generation:** DALL·E 3 (via OpenAI API)
- **Containerized:** Docker (multi-container setup via EasyPanel)

---

## 🧩 How It Works

1. Player enters name + story prompt.
2. Flask backend sets up an OpenAI Assistant with persistent thread context.
3. AI generates JSON-formatted "scene blocks" (narration, dialogue, choices, etc).
4. React frontend parses blocks, displays immersive visual novel flow.
5. User clicks to advance scenes or enters choices to branch story.
6. All character dialogue, decisions, and personality traits evolve over time.

---

## 📋 To Do / Roadmap

- [ ] Scene preloading + buffer for instant transitions.
- [ ] Typewriter reveal and sentence-level pacing.
- [ ] Backlog (scrollable log of past scenes).
- [ ] Character portrait generation with emotion/mood states.
- [ ] Save/load support via Assistant snapshot or thread IDs.

---

## ⚙️ Running Locally

Each service is containerized separately:

```bash
# Frontend (Next.js)
cd frontend
docker build -t visualnovel-frontend .
docker run -p 3000:3000 visualnovel-frontend

# Backend (Flask)
cd backend
docker build -t visualnovel-backend .
docker run -p 5000:5000 -e OPENAI_API_KEY=sk-... visualnovel-backend
