import { NextResponse } from "next/server";
import { getConfig, createNewQuestion } from "../../../lib/fs-store.js";
import { generateDailyQuestions } from "../../../lib/llm.js";

/**
 * Send webhook notification to Discord/Slack.
 * Defined here instead of importing from server actions (which depend on Next.js cache).
 */
async function sendWebhook(questions, webhookUrl) {
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
          color: q.difficulty === "hard" ? 15548997 : q.difficulty === "medium" ? 16753920 : 3066993,
          fields: [
            { name: "Tags", value: (q.subCategories || []).map(t => `#${t}`).join(" ") || "None", inline: true }
          ]
        }))
      };
    } else {
      payload = {
        text: `🎯 *${questions.length} New Daily Prep Cards Generated!*\n\n` + 
          questions.map((q, idx) => {
            return `*${idx + 1}. [${q.category.toUpperCase()}] ${q.title} (${q.difficulty.toUpperCase()})*\n*Rationale:* ${q.resumeContext}\n*Question:* ${q.question}\n*Tags:* ${(q.subCategories || []).map(t => `#${t}`).join(" ") || "None"}\n`;
          }).join("\n---\n\n")
      };
    }
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

export async function GET(request) {
  return handleGenerate(request);
}

export async function POST(request) {
  return handleGenerate(request);
}

async function handleGenerate(request) {
  try {
    const expectedSecret = process.env.CRON_SECRET || "preploop-default-secret";

    // 1. Authenticate secret
    const { searchParams } = new URL(request.url);
    let secret = searchParams.get("secret");

    if (!secret) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        secret = authHeader.substring(7);
      }
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Invalid secret token." },
        { status: 401 }
      );
    }

    // 2. Generate questions
    const newQuestions = await generateDailyQuestions();
    
    if (!Array.isArray(newQuestions)) {
      throw new Error("Invalid output returned by AI generator. Expected an array.");
    }

    // 3. Save questions to vault
    const created = [];
    for (const qData of newQuestions) {
      const q = createNewQuestion({
        title: qData.title,
        question: qData.question,
        category: qData.category,
        subCategories: qData.subCategories,
        difficulty: qData.difficulty,
        resumeContext: qData.resumeContext
      });
      created.push(q.title);
    }

    // 4. Send webhook notification
    let webhookAttempted = false;
    let webhookSuccess = true;
    let webhookError = null;

    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      webhookAttempted = true;
      const delivery = await sendWebhook(newQuestions, webhookUrl);
      webhookSuccess = delivery.success;
      webhookError = delivery.error;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${created.length} new daily questions.`,
      titles: created,
      webhookAttempted,
      webhookSuccess,
      webhookError
    });

  } catch (error) {
    console.error("Cron generation failed:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
