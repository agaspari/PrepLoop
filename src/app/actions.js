"use server";

import { cookies } from "next/headers";
import { adminAuth } from "../lib/firebase-admin.js";
import {
  loadAllQuestions,
  getQuestion,
  createQuestion,
  createQuestionsBatch,
  saveAnswerAndEvaluation,
  updateQuestionSRS,
  deleteQuestion,
  loadAllTargets,
  getTarget,
  saveTarget,
  deleteTarget,
  updateTargetQuestionCount,
  loadResumeSchema,
  saveResumeSchema,
  setGenerationStatus,
  getGenerationStatus,
  getStats,
  getRecentQuestionTitles,
  getQuestionTitlesForTarget,
  addGeneratedTopic,
  activateDailyQuestions,
} from "../lib/cloud-store.js";
import {
  runResumeIngestion,
  generateTargetQuestions,
  generateTopicQuestions,
  evaluateAnswer,
} from "../lib/llm.js";
import { calculateSM2 } from "../lib/srs.js";

// ─── Auth Verification ──────────────────────────────────────────────────────

/**
 * Verify the Firebase ID token from the session cookie.
 * Returns the decoded user or null.
 */
async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("firebaseToken")?.value;
    if (!sessionCookie) return null;
    const decoded = await adminAuth.verifyIdToken(sessionCookie);
    return decoded;
  } catch (error) {
    console.error("Auth verification failed:", error.message);
    return null;
  }
}

/**
 * Set the session cookie after Firebase Auth sign-in.
 */
export async function setSessionAction(idToken) {
  try {
    // Verify the token is valid
    await adminAuth.verifyIdToken(idToken);
    const cookieStore = await cookies();
    cookieStore.set("firebaseToken", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return { success: true };
  } catch (error) {
    console.error("Error setting session:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSessionAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("firebaseToken");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if the current session is authenticated.
 */
export async function checkAuthAction() {
  const user = await verifyAuth();
  return {
    authenticated: !!user,
    user: user ? { uid: user.uid, email: user.email, name: user.name } : null,
  };
}

// ─── Config / Status ────────────────────────────────────────────────────────

/**
 * Get system status — API key presence, stats, etc.
 */
export async function getConfigAction() {
  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    const stats = await getStats();
    const genStatus = await getGenerationStatus();

    return {
      success: true,
      hasApiKey,
      totalQuestions: stats.totalQuestions || 0,
      questionsBySource: stats.questionsBySource || {},
      generationStatus: genStatus,
    };
  } catch (error) {
    console.error("Error in getConfigAction:", error);
    return { success: false, error: error.message };
  }
}

// ─── Questions ──────────────────────────────────────────────────────────────

/**
 * Load all questions with computed status fields.
 */
export async function loadQuestionsAction() {
  try {
    const questions = await loadAllQuestions();
    const todayStr = new Date().toISOString().split("T")[0];

    const mapped = questions.map(q => {
      const sr = q.sr || {};
      const isDue = q.assigned === true && (!sr.due || sr.due <= todayStr);
      const hasAnswer = !!q.answer && q.answer.trim().length > 0;

      return {
        id: q.id,
        title: q.title,
        category: q.category || "conceptual-engineering",
        subCategories: q.subCategories || [],
        difficulty: q.difficulty || "medium",
        questionText: q.question || q.title,
        resumeContext: q.resumeContext || "",
        answer: q.answer || "",
        feedback: q.feedback || "",
        source: q.source || "custom",
        sourceTargetId: q.sourceTargetId || null,
        sourceTopic: q.sourceTopic || null,
        srDue: sr.due || todayStr,
        srInterval: sr.interval || 1,
        srFactor: sr.factor || 2.5,
        srReps: sr.reps || 0,
        assigned: q.assigned === true,
        isDue,
        hasAnswer,
        createdAt: q.createdAt,
      };
    });

    return { success: true, questions: mapped };
  } catch (error) {
    console.error("Error in loadQuestionsAction:", error);
    return { success: false, error: error.message, questions: [] };
  }
}

/**
 * Submit a long-form answer for evaluation.
 */
export async function submitAnswerAction(questionId, answerText, userRatingOverride = null) {
  try {
    const q = await getQuestion(questionId);
    if (!q) throw new Error("Question not found.");

    const sr = q.sr || {};

    // Grade via LLM
    const { evaluationMarkdown, recommendedRating } = await evaluateAnswer(
      q.title,
      q.question || q.title,
      q.resumeContext || "",
      answerText
    );

    // Determine rating
    const activeRating = userRatingOverride !== null ? userRatingOverride : recommendedRating;

    // Run SM-2
    const srs = calculateSM2(activeRating, sr.interval || 0, sr.reps || 0, sr.factor || 2.5);

    // Save to Firestore
    await saveAnswerAndEvaluation(questionId, answerText, evaluationMarkdown, {
      due: srs.nextReviewDate,
      interval: srs.interval,
      factor: srs.easeFactor,
      reps: srs.repetitions,
    });

    return {
      success: true,
      evaluationMarkdown,
      recommendedRating,
      appliedRating: activeRating,
      srs,
    };
  } catch (error) {
    console.error("Error in submitAnswerAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Override the SM-2 rating manually.
 */
export async function saveCustomRatingAction(questionId, rating) {
  try {
    const q = await getQuestion(questionId);
    if (!q) throw new Error("Question not found.");

    const sr = q.sr || {};
    const adjustedReps = Math.max(0, (sr.reps || 0) - 1);
    const srs = calculateSM2(rating, sr.interval || 0, adjustedReps, sr.factor || 2.5);

    await updateQuestionSRS(questionId, srs);

    return { success: true, srs };
  } catch (error) {
    console.error("Error in saveCustomRatingAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a custom question (manually authored by user).
 */
export async function createCustomQuestionAction(data) {
  try {
    const question = await createQuestion({
      title: data.title,
      question: data.question || data.title,
      category: data.category || "conceptual-engineering",
      subCategories: data.subCategories || [],
      difficulty: data.difficulty || "medium",
      resumeContext: data.resumeContext || "",
      source: "custom",
    });

    return { success: true, question };
  } catch (error) {
    console.error("Error creating custom question:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a question by ID.
 */
export async function deleteQuestionAction(questionId) {
  try {
    await deleteQuestion(questionId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting question:", error);
    return { success: false, error: error.message };
  }
}

// ─── Resume Schema Ingestion ────────────────────────────────────────────────

/**
 * Upload and ingest a resume schema — saves to Firestore and generates ~150 questions.
 * This is the heavy ingestion pipeline.
 */
export async function ingestResumeSchemaAction(yamlContent) {
  try {
    // Save schema to Firestore
    await saveResumeSchema(yamlContent);
    await setGenerationStatus("generating");

    // Run the full ingestion pipeline
    const questions = await runResumeIngestion(yamlContent);

    if (questions.length === 0) {
      await setGenerationStatus("complete");
      return { success: true, count: 0, message: "No questions generated. Check your schema format." };
    }

    // Batch save to Firestore
    const created = await createQuestionsBatch(questions);

    await setGenerationStatus("complete");

    return {
      success: true,
      count: created.length,
      message: `Successfully generated ${created.length} interview questions from your resume.`,
    };
  } catch (error) {
    console.error("Error in ingestResumeSchemaAction:", error);
    await setGenerationStatus("error").catch(() => {});
    return { success: false, error: error.message };
  }
}

/**
 * Load the resume schema from Firestore.
 */
export async function loadResumeSchemaAction() {
  try {
    const schema = await loadResumeSchema();
    return {
      success: true,
      content: schema?.rawYaml || null,
      generationStatus: schema?.generationStatus || "none",
    };
  } catch (error) {
    console.error("Error loading resume schema:", error);
    return { success: false, error: error.message };
  }
}

// ─── Target Ingestion ───────────────────────────────────────────────────────

/**
 * Load all targets.
 */
export async function loadTargetsAction() {
  try {
    const targets = await loadAllTargets();
    return { success: true, targets };
  } catch (error) {
    console.error("Error loading targets:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save a target and auto-generate company-specific questions.
 */
export async function saveTargetAction(targetData) {
  try {
    // Save the target
    const target = await saveTarget({
      company: targetData.company || "",
      role: targetData.role || "",
      title: targetData.title || `${targetData.company} — ${targetData.role}`,
      content: targetData.content || "",
    });

    // Get resume schema for cross-referencing
    const schema = await loadResumeSchema();
    const rawYaml = schema?.rawYaml || null;

    // Get existing question titles for dedup
    const existingTitles = await getQuestionTitlesForTarget(target.id);

    // Generate company-specific questions
    const questions = await generateTargetQuestions(target, rawYaml, existingTitles);

    let createdCount = 0;
    if (questions.length > 0) {
      // Add target ID to each question
      const questionsWithTarget = questions.map(q => ({
        ...q,
        sourceTargetId: target.id,
      }));

      const created = await createQuestionsBatch(questionsWithTarget);
      createdCount = created.length;

      // Update target question count
      await updateTargetQuestionCount(target.id, existingTitles.length + createdCount);
    }

    return {
      success: true,
      target,
      questionsGenerated: createdCount,
      message: `Target saved. Generated ${createdCount} interview questions for ${targetData.company}.`,
    };
  } catch (error) {
    console.error("Error in saveTargetAction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Refresh questions for an existing target (generate more with dedup).
 */
export async function refreshTargetQuestionsAction(targetId) {
  try {
    const target = await getTarget(targetId);
    if (!target) throw new Error("Target not found.");

    const schema = await loadResumeSchema();
    const rawYaml = schema?.rawYaml || null;
    const existingTitles = await getQuestionTitlesForTarget(targetId);

    const questions = await generateTargetQuestions(target, rawYaml, existingTitles);

    let createdCount = 0;
    if (questions.length > 0) {
      const questionsWithTarget = questions.map(q => ({
        ...q,
        sourceTargetId: targetId,
      }));

      const created = await createQuestionsBatch(questionsWithTarget);
      createdCount = created.length;

      await updateTargetQuestionCount(targetId, existingTitles.length + createdCount);
    }

    return {
      success: true,
      questionsGenerated: createdCount,
      message: `Generated ${createdCount} new questions for ${target.company || target.title}.`,
    };
  } catch (error) {
    console.error("Error refreshing target questions:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a target and optionally its questions.
 */
export async function deleteTargetAction(targetId, deleteQuestions = false) {
  try {
    await deleteTarget(targetId, deleteQuestions);
    return { success: true };
  } catch (error) {
    console.error("Error deleting target:", error);
    return { success: false, error: error.message };
  }
}

// ─── Topic-Based Generation ─────────────────────────────────────────────────

/**
 * Generate questions for a user-specified topic.
 * Returns preview (not saved yet) — user picks which to save.
 */
export async function generateTopicQuestionsAction(topic, contextSources = {}) {
  try {
    const schema = await loadResumeSchema();
    const rawYaml = schema?.rawYaml || null;

    // Build context sources for the LLM
    const llmContext = {
      useResume: contextSources.useResume || false,
    };

    // If a target is selected, load its content
    if (contextSources.targetId) {
      const target = await getTarget(contextSources.targetId);
      if (target) {
        llmContext.targetContent = target.content;
        llmContext.targetCompany = target.company;
        llmContext.targetRole = target.role;
      }
    }

    const questions = await generateTopicQuestions(topic, llmContext, rawYaml);

    return {
      success: true,
      questions: questions.map((q, idx) => ({
        ...q,
        previewId: `preview-${idx}-${Date.now()}`,
      })),
    };
  } catch (error) {
    console.error("Error generating topic questions:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save selected topic-generated questions from the preview.
 */
export async function saveTopicQuestionsAction(questions, topic) {
  try {
    const questionsToSave = questions.map(q => ({
      ...q,
      source: "topic-generated",
      sourceTopic: topic.toLowerCase(),
    }));

    const created = await createQuestionsBatch(questionsToSave);

    // Track this topic
    await addGeneratedTopic(topic);

    return {
      success: true,
      count: created.length,
      message: `Saved ${created.length} questions about "${topic}".`,
    };
  } catch (error) {
    console.error("Error saving topic questions:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Server action to activate N daily questions.
 */
export async function activateDailyQuestionsAction(count = 5) {
  try {
    const activated = await activateDailyQuestions(count);
    return {
      success: true,
      count: activated.length,
      activated,
    };
  } catch (error) {
    console.error("Error in activateDailyQuestionsAction:", error);
    return { success: false, error: error.message };
  }
}
