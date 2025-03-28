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
```

---

## Some Story suggestions

### Rescuing the Princess
```I'd like to play a story where I must rescue the princess from a castle.

The narrator should track karma across at least two axes: Virtue (kindness, mercy, heroism) and Vice (violence, selfishness, manipulation).

Actions I take should increase or decrease these karma values.

I want multiple solutions to the main goal, like:
- Sneaking in and freeing her without violence (requires high Virtue)
- Convincing the guards to let her go (requires high Charisma and medium Virtue)
- Storming the castle and taking her by force (requires high Vice)

At every major decision point:
- The narrator should calculate my current karma levels.
- If I try something that requires more karma than I have, I want the narrator to:
  - Deny the action.
  - Explain the karma required vs what I currently have.
  - Suggest alternative actions that would raise the needed karma.

Only one path to rescue the princess should be possible based on how I play. Lock out incompatible paths as I progress. Let me know how karma changes based on my choices.
```

### Cyber Attack Training Simular
```I'd like to play a story where I'm a mid-level IT technician working at SentinelCore, a small but ambitious MSP based out of Chicago.

It's 8:12 AM on a rainy Thursday when your phone buzzes with a flood of client alerts.
At first, it seems like the usual noise: a failed backup here, a locked-out user there. But a creeping sense of dread builds as more and more systems begin to go dark.

You’re under attack.
One of your clients — a law firm with poor security hygiene — has been hit by ransomware, and the infection is spreading through your remote management tools like wildfire.
Servers are being encrypted. Critical client data is at risk. Your team is scattered, leadership is panicking, and the phone lines are lighting up.

You must:
- Assess the scope of the incident.
- Contain the breach, deciding what to shut down, isolate, or let burn.
- Communicate with your panicked clients and teammates while keeping cool under pressure.
- Decide whether to report to authorities, insurers, or quietly attempt recovery.
- Balance priorities: client relationships, legal liability, data integrity, and your own career.

You’ll face:
  - Ethical dilemmas (do you admit fault? do you spin the truth?).
  - Technical tradeoffs (do you nuke a system to stop the spread or try to salvage it?).
  - Social stressors (teammates who are in over their heads, clients who want blood, bosses who vanish).
  - Psychological fatigue and personal growth — or breakdown.

The story evolves based on your responses:

Do you become the unsung hero, rising above the chaos?
Or the quiet fall guy, scapegoated for systemic failures?
Maybe even a gray-hat operator, bending rules to save the day at a moral cost?

Your decisions shape your character’s reputation, trustworthiness, and future.
Every conversation, action, or hesitation feeds into invisible karma meters like:

🧠 Logic vs. 🧯 Panic
🛡️ Duty vs. 💸 Self-preservation
🧍 Isolation vs. 🤝 Collaboration
🧭 Integrity vs. 🎭 Spin

This isn't just incident response — it's your professional crucible.
```
