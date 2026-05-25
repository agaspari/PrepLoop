#!/usr/bin/env node

/**
 * PrepLoop Offline Daily Question Generator (ESM)
 * Triggered via local crontab (e.g. node scripts/generate-daily.mjs)
 * Designed to be fully self-contained without Next.js dependencies.
 */

import { generateDailyQuestions } from "../src/lib/llm.js";
import { createNewQuestion, getConfig } from "../src/lib/fs-store.js";

async function sendWebhookNotificationLocal(questions, webhookUrl) {
  try {
    const isDiscord = webhookUrl.includes("discord.com");
    let payload = {};
    
    if (isDiscord) {
      payload = {
        username: "PrepLoop Coach",
        content: `🎯 **${questions.length} New Daily Prep Cards Generated!**`,
        embeds: questions.map((q) => ({
          title: `📝 [${q.category.toUpperCase()}] ${q.title} (${q.difficulty.toUpperCase()})`,
          description: `**Resume Context Rationale:**\n${q.resumeContext}\n\n**Question:**\n${q.question}`,
          color: q.difficulty === "hard" ? 15548997 : q.difficulty === "medium" ? 16753920 : 3066993, // Red, Orange, Green
          fields: [
            { name: "Tags", value: (q.subCategories || []).map(t => `#${t}`).join(" ") || "None", inline: true }
          ]
        }))
      };
    } else {
      // Default / Slack format
      payload = {
        text: `🎯 *${questions.length} New Daily Prep Cards Generated!*\n\n` + 
          questions.map((q, idx) => {
            return `*${idx + 1}. [${q.category.toUpperCase()}] ${q.title} (${q.difficulty.toUpperCase()})*\n*Rationale:* ${q.resumeContext}\n*Question:* ${q.question}\n*Tags:* ${(q.subCategories || []).map(t => `#${t}`).join(" ") || "None"}\n`;
          }).join("\n---\n\n")
      };
    }
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function run() {
  console.log("=== PrepLoop Daily Cron Generator ===");
  console.log("Loading configuration from environment...");
  const config = getConfig();

  if (!config.geminiApiKey) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    process.exitCode = 1;
    return;
  }

  console.log(`Vault Path: ${config.vaultPath}`);
  console.log("Contacting Gemini for customized prep cards...");

  try {
    const questions = await generateDailyQuestions();
    
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid output or no questions returned by generator.");
    }

    console.log(`Successfully generated ${questions.length} questions! Writing to Obsidian vault...`);

    const titles = [];
    for (const qData of questions) {
      const q = createNewQuestion({
        title: qData.title,
        question: qData.question,
        category: qData.category,
        subCategories: qData.subCategories,
        difficulty: qData.difficulty,
        resumeContext: qData.resumeContext
      });
      console.log(` - Created card: ${q.title} (${q.metadata.difficulty})`);
      titles.push(q.title);
    }

    if (config.webhookUrl) {
      console.log(`Sending notification to configured Webhook...`);
      const webhookRes = await sendWebhookNotificationLocal(questions, config.webhookUrl);
      if (webhookRes.success) {
        console.log("Notification sent successfully!");
      } else {
        console.warn(`Warning: Webhook failed: ${webhookRes.error}`);
      }
    }

    console.log("=====================================");
    console.log("Daily Prep generation complete! Good luck studying today! 🎯");
    process.exitCode = 0;

  } catch (error) {
    console.error("Generation failed:", error);
    process.exitCode = 1;
  }
}

run();
