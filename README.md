# PrepLoop

PrepLoop is a spaced-repetition engineering interview preparation platform. It ingests your resume schema, target job descriptions, and topics to generate highly detailed, personalized conceptual, behavioral, and system design questions. It uses the SuperMemo-2 (SM-2) spaced repetition algorithm to schedule reviews and evaluate responses using Gemini AI models.

---

## Getting Started

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the required credentials:
```bash
cp .env.example .env
```

Ensure the following variables are configured:
* `GEMINI_API_KEY`: Your Google AI Gemini API Key.
* `CRON_SECRET`: Secret token used to secure the Vercel Cron endpoint.
* **Discord Integration**:
  * `DISCORD_WEBHOOK_URL`: Your channel's incoming Discord Webhook URL.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your PrepLoop interactive dashboard.

---

## 📅 Daily Spaced-Repetition Cron

PrepLoop uses a Vercel Cron configuration (`vercel.json`) to call `/api/cron` daily. 

### Core Features of the Spaced-Repetition Queue:
1. **Dynamic Capping (2 New / 4 Reviews)**:
   * Keeps your dashboard capped at **exactly 6 active due questions** max to prevent cognitive fatigue.
   * Caps review backlog displays at **4 reviews**.
   * Guarantees at least **2 new questions** are introduced daily so you continually make progress through your 200+ question bank.
2. **Backpressure Engine**:
   * The daily cron will check if you still have unanswered new questions on your board. If you have **2 or more unanswered new questions**, it will activate **0 new questions** today, preventing backlog accumulation when you take study breaks.

---

## Discord Notification Setup

Whenever the daily cron runs, it can notify you on Discord via incoming webhooks with high-fidelity status updates.

### 1. Get a Discord Webhook URL
1. Open Discord, navigate to the text channel where you want notifications.
2. Open channel **Settings (cog icon)** -> **Integrations** -> **Webhooks** -> **Create Webhook**.
3. Customize the bot name/avatar and click **Copy Webhook URL**.

### 2. Add it to your Config
Add it to your local `.env` and your Vercel deployment variables:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-channel-id/your-webhook-token
```

### 3. Embed Alert Types Sent by the Cron:
* **Daily Batch Activated (Purple Embed)**: Sent when new study cards are successfully assigned to your board. It lists the question titles and IDs along with a direct link to your dashboard.
* **Daily Limit Capped (Blue Embed)**: Sent if you still have 2 unanswered new questions, noting that new cards were paused today to let you focus.
* **Ingestion Bank Depleted (Orange Embed)**: Sent when there are no new unassigned questions left in your bank, prompting you to ingest more schemas or roles.
