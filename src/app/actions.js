"use server";

import { revalidatePath } from "next/cache";
import {
  getConfig,
  loadAllQuestions,
  createNewQuestion,
  saveAnswerAndEvaluation,
  loadAllTargets,
  saveTargetFile,
  deleteTargetFile,
  loadResumeSchemaRaw
} from "../lib/fs-store.js";
import { generateDailyQuestions, evaluateAnswer } from "../lib/llm.js";
import { calculateSM2 } from "../lib/srs.js";

/**
 * Helper to safely extract the question text from the note body
 */
function extractQuestionText(question) {
  const body = question.body || "";
  const qIndex = body.indexOf("### Question");
  const contextIndex = body.indexOf("### Resume Context");

  if (qIndex !== -1 && contextIndex !== -1 && contextIndex > qIndex) {
    return body.slice(qIndex + "### Question".length, contextIndex).trim();
  }
  return question.title || "";
}

/**
 * Fetch current system status (read-only).
 * Never leaks actual secret values to the client — only reports whether they are configured.
 */
export async function getConfigAction() {
  try {
    const config = getConfig();
    
    return {
      success: true,
      vaultPath: config.vaultPath || "",
      hasApiKey: !!config.geminiApiKey,
      hasWebhook: !!config.webhookUrl,
      hasCronSecret: config.cronSecret !== "preploop-default-secret" && !!config.cronSecret,
    };
  } catch (error) {
    console.error("Error in getConfigAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch and categorize all active questions.
 * Returns questions categorized by status and due date.
 */
export async function loadQuestionsAction() {
  try {
    const questions = loadAllQuestions();
    const todayStr = new Date().toISOString().split("T")[0];

    const mapped = questions.map(q => {
      const isDue = !q.metadata["sr-due"] || q.metadata["sr-due"] <= todayStr;
      const hasAnswer = !!q.answer && q.answer.trim().length > 0;
      const questionText = extractQuestionText(q);

      return {
        id: q.id,
        title: q.title,
        filename: q.filename,
        category: q.metadata.category || "conceptual-engineering",
        subCategories: q.metadata.sub_categories || [],
        difficulty: q.metadata.difficulty || "medium",
        srDue: q.metadata["sr-due"] || todayStr,
        srInterval: q.metadata["sr-interval"] || 1,
        srFactor: q.metadata["sr-factor"] || 2.5,
        srReps: q.metadata["sr-reps"] || 0,
        questionText,
        resumeContext: q.body.indexOf("### Resume Context") !== -1 
          ? q.body.slice(
              q.body.indexOf("### Resume Context") + "### Resume Context".length, 
              q.body.indexOf("### User Answer") !== -1 ? q.body.indexOf("### User Answer") : q.body.length
            ).trim()
          : "",
        answer: q.answer || "",
        feedback: q.feedback || "",
        isDue,
        hasAnswer
      };
    });

    return {
      success: true,
      questions: mapped
    };
  } catch (error) {
    console.error("Error in loadQuestionsAction:", error);
    return { success: false, error: error.message, questions: [] };
  }
}

/**
 * Generate a new customized deck of questions and write them to the local vault.
 */
export async function generateDailyQuestionsAction() {
  try {
    const newQuestions = await generateDailyQuestions();
    
    if (!Array.isArray(newQuestions)) {
      throw new Error("Invalid output returned by AI generator. Expected an array.");
    }

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

    // Trigger webhook notification if configured
    let webhookSuccess = true;
    let webhookError = null;
    const config = getConfig();
    if (config.webhookUrl) {
      const delivery = await sendWebhookNotification(newQuestions);
      webhookSuccess = delivery.success;
      webhookError = delivery.error;
    }

    revalidatePath("/");
    return { 
      success: true, 
      count: created.length, 
      titles: created,
      webhookAttempted: !!config.webhookUrl,
      webhookSuccess,
      webhookError
    };
  } catch (error) {
    console.error("Error in generateDailyQuestionsAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit a long-form answer for evaluation.
 * Evaluates answer with Gemini and schedules the next review date via SM-2.
 */
export async function submitAnswerAction(questionId, answerText, userRatingOverride = null) {
  try {
    const questions = loadAllQuestions();
    const q = questions.find(item => item.id === questionId);

    if (!q) {
      throw new Error("Question not found.");
    }

    const questionText = extractQuestionText(q);
    const resumeContext = q.body.indexOf("### Resume Context") !== -1 
      ? q.body.slice(
          q.body.indexOf("### Resume Context") + "### Resume Context".length, 
          q.body.indexOf("### User Answer") !== -1 ? q.body.indexOf("### User Answer") : q.body.length
        ).trim()
      : "";

    // Step 1: Grade answer via LLM
    const { evaluationMarkdown, recommendedRating } = await evaluateAnswer(
      q.title,
      questionText,
      resumeContext,
      answerText
    );

    // Step 2: Determine rating to apply (use user-selected override or AI recommendation)
    const activeRating = userRatingOverride !== null ? userRatingOverride : recommendedRating;

    // Step 3: Run SM-2 spacing calculations
    const currentInterval = q.metadata["sr-interval"] || 0;
    const currentRepetitions = q.metadata["sr-reps"] || 0;
    const currentEaseFactor = q.metadata["sr-factor"] || 2.5;

    const srs = calculateSM2(activeRating, currentInterval, currentRepetitions, currentEaseFactor);

    // Step 4: Save evaluation and updated metrics back to Markdown note
    const srsMetadata = {
      "sr-due": srs.nextReviewDate,
      "sr-interval": srs.interval,
      "sr-factor": srs.easeFactor,
      "sr-reps": srs.repetitions
    };

    saveAnswerAndEvaluation(questionId, answerText, evaluationMarkdown, srsMetadata);

    revalidatePath("/");
    return {
      success: true,
      evaluationMarkdown,
      recommendedRating,
      appliedRating: activeRating,
      srs
    };
  } catch (error) {
    console.error("Error in submitAnswerAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Permit the user to override/update the SM-2 scheduling score manually.
 */
export async function saveCustomRatingAction(questionId, rating) {
  try {
    const questions = loadAllQuestions();
    const q = questions.find(item => item.id === questionId);

    if (!q) {
      throw new Error("Question not found.");
    }

    // Run SM-2 with the manual rating
    // Note: We use the existing stats BEFORE this update to run a clean calculation
    const currentInterval = q.metadata["sr-interval"] || 0;
    
    // Since reps was already incremented if they just answered it, let's look at repetitions:
    // If we are overriding, we calculate from the *previous* state. But to keep it simple and robust,
    // we recalculate using the current factors in frontmatter, but reset reps appropriately based on rating.
    const currentRepetitions = q.metadata["sr-reps"] || 0;
    const currentEaseFactor = q.metadata["sr-factor"] || 2.5;

    // We calculate a clean SM2 update.
    // If rating is >= 3, they get mapped to next interval. If < 3, it resets repetitions.
    // To avoid double-incrementing reps, let's treat it as adjusting the *current* state.
    // We adjust by passing reps - 1 if reps > 0 (assuming they just answered it) or just using current reps.
    const adjustedReps = Math.max(0, currentRepetitions - 1);
    const srs = calculateSM2(rating, currentInterval, adjustedReps, currentEaseFactor);

    const srsMetadata = {
      "sr-due": srs.nextReviewDate,
      "sr-interval": srs.interval,
      "sr-factor": srs.easeFactor,
      "sr-reps": srs.repetitions
    };

    // Save back to file (keep answer and feedback unchanged, only update metadata frontmatter)
    saveAnswerAndEvaluation(questionId, q.answer || "", q.feedback || "", srsMetadata);

    revalidatePath("/");
    return {
      success: true,
      srs
    };
  } catch (error) {
    console.error("Error in saveCustomRatingAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load the raw schema.yaml content for the read-only Profile viewer.
 */
export async function loadResumeSchemaAction() {
  try {
    const { path, content } = loadResumeSchemaRaw();
    return { success: true, path, content };
  } catch (error) {
    console.error("Error loading resume schema:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load all active target role documents
 */
export async function loadTargetsAction() {
  try {
    const targets = loadAllTargets();
    return { success: true, targets };
  } catch (error) {
    console.error("Error loading targets:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save/create a target document
 */
export async function saveTargetAction(filename, content) {
  try {
    const target = saveTargetFile(filename, content);
    revalidatePath("/");
    return { success: true, target };
  } catch (error) {
    console.error("Error saving target:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a target document
 */
export async function deleteTargetAction(filename) {
  try {
    deleteTargetFile(filename);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting target:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send daily questions to Discord or Slack webhook if configured
 */
export async function sendWebhookNotification(questions) {
  try {
    const config = getConfig();
    const webhookUrl = config.webhookUrl;
    
    if (!webhookUrl) {
      return { success: true, message: "No webhook configured." };
    }
    
    // Format the payload based on Discord or Slack
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
    console.error("Webhook delivery failed:", error);
    return { success: false, error: error.message };
  }
}
