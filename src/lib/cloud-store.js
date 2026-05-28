import { db } from './firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Collection References ──────────────────────────────────────────────────

const questionsCol = () => db.collection('questions');
const targetsCol = () => db.collection('targets');
const resumeDoc = () => db.collection('resumeSchema').doc('current');
const statsDoc = () => db.collection('metadata').doc('stats');

// ─── Questions ──────────────────────────────────────────────────────────────

/**
 * Load all questions from Firestore.
 */
export async function loadAllQuestions() {
  const snapshot = await questionsCol().orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Load questions due for review today or earlier.
 */
export async function loadDueQuestions() {
  const today = new Date().toISOString().split('T')[0];
  const snapshot = await questionsCol()
    .where('sr.due', '<=', today)
    .orderBy('sr.due', 'asc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a single question by ID.
 */
export async function getQuestion(questionId) {
  const doc = await questionsCol().doc(questionId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Create a single question in Firestore.
 */
export async function createQuestion(data) {
  const id = data.id || generateQuestionId(data.title);
  const now = new Date().toISOString();

  const questionDoc = {
    title: data.title,
    question: data.question || data.title,
    category: data.category || 'conceptual-engineering',
    subCategories: data.subCategories || [],
    difficulty: data.difficulty || 'medium',
    resumeContext: data.resumeContext || '',
    answer: '',
    feedback: '',
    source: data.source || 'custom',
    sourceTargetId: data.sourceTargetId || null,
    sourceTopic: data.sourceTopic || null,
    assigned: true, // Custom questions are active immediately
    sr: {
      due: now.split('T')[0],
      interval: 1,
      factor: 2.5,
      reps: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  await questionsCol().doc(id).set(questionDoc);

  // Update stats
  await updateStatsOnCreate(questionDoc.source);

  return { id, ...questionDoc };
}

/**
 * Batch-create multiple questions (used during ingestion).
 * Firestore batch writes are limited to 500 operations per batch.
 */
export async function createQuestionsBatch(questionsArray) {
  const created = [];
  const now = new Date().toISOString();

  // Process in chunks of 450 to stay safely under the 500 limit
  for (let i = 0; i < questionsArray.length; i += 450) {
    const chunk = questionsArray.slice(i, i + 450);
    const batch = db.batch();

    for (const data of chunk) {
      const id = data.id || generateQuestionId(data.title);
      const source = data.source || 'resume-ingestion';

      // Custom and topic-generated are active immediately, resume/target are cold (assigned = false)
      const isActive = source === 'custom' || source === 'topic-generated';

      const questionDoc = {
        title: data.title,
        question: data.question || data.title,
        category: data.category || 'conceptual-engineering',
        subCategories: data.subCategories || [],
        difficulty: data.difficulty || 'medium',
        resumeContext: data.resumeContext || '',
        answer: '',
        feedback: '',
        source,
        sourceTargetId: data.sourceTargetId || null,
        sourceTopic: data.sourceTopic || null,
        assigned: isActive,
        sr: {
          due: isActive ? now.split('T')[0] : null,
          interval: 1,
          factor: 2.5,
          reps: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      batch.set(questionsCol().doc(id), questionDoc);
      created.push({ id, ...questionDoc });
    }

    await batch.commit();
  }

  // Update stats in bulk
  const sourceCounts = {};
  for (const q of created) {
    sourceCounts[q.source] = (sourceCounts[q.source] || 0) + 1;
  }
  await updateStatsOnBatchCreate(sourceCounts, created.length);

  return created;
}

/**
 * Save a user's answer and AI evaluation back to the question.
 */
export async function saveAnswerAndEvaluation(questionId, answerText, evaluationText, srsData = null) {
  const rating = srsData && srsData.rating !== undefined ? srsData.rating : null;
  const timestamp = new Date().toISOString();

  const attempt = {
    answer: answerText,
    feedback: evaluationText,
    rating,
    timestamp,
  };

  const updateData = {
    answer: answerText,
    feedback: evaluationText,
    updatedAt: timestamp,
    attempts: FieldValue.arrayUnion(attempt),
  };

  if (srsData) {
    const reps = srsData.reps !== undefined 
      ? srsData.reps 
      : (srsData.repetitions !== undefined ? srsData.repetitions : srsData['sr-reps']);

    updateData.sr = {
      due: srsData.due || srsData.nextReviewDate || srsData['sr-due'],
      interval: srsData.interval || srsData['sr-interval'] || 1,
      factor: srsData.factor || srsData.easeFactor || srsData['sr-factor'] || 2.5,
      reps: reps !== undefined ? reps : 0,
    };
  }

  await questionsCol().doc(questionId).update(updateData);

  const doc = await questionsCol().doc(questionId).get();
  return { id: doc.id, ...doc.data() };
}

/**
 * Update only the SRS metadata for a question (manual rating override).
 */
export async function updateQuestionSRS(questionId, srsData) {
  await questionsCol().doc(questionId).update({
    sr: {
      due: srsData.nextReviewDate,
      interval: srsData.interval,
      factor: srsData.easeFactor,
      reps: srsData.repetitions,
    },
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a single question.
 */
export async function deleteQuestion(questionId) {
  const doc = await questionsCol().doc(questionId).get();
  if (doc.exists) {
    const source = doc.data().source || 'unknown';
    await questionsCol().doc(questionId).delete();
    await updateStatsOnDelete(source);
    return true;
  }
  return false;
}

/**
 * Get the most recent N question titles (for dedup prompt injection).
 */
export async function getRecentQuestionTitles(limit = 30) {
  const snapshot = await questionsCol()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .select('title')
    .get();
  return snapshot.docs.map(doc => doc.data().title);
}

/**
 * Get all question titles for a specific source/target (for dedup).
 */
export async function getQuestionTitlesForTarget(targetId) {
  const snapshot = await questionsCol()
    .where('sourceTargetId', '==', targetId)
    .select('title')
    .get();
  return snapshot.docs.map(doc => doc.data().title);
}

/**
 * Get all question titles for a specific topic (for dedup).
 */
export async function getQuestionTitlesForTopic(topic) {
  const snapshot = await questionsCol()
    .where('sourceTopic', '==', topic.toLowerCase())
    .select('title')
    .get();
  return snapshot.docs.map(doc => doc.data().title);
}

/**
 * Get question count grouped by source.
 */
export async function getQuestionCountsBySource() {
  const snapshot = await questionsCol().select('source').get();
  const counts = {};
  snapshot.docs.forEach(doc => {
    const source = doc.data().source || 'unknown';
    counts[source] = (counts[source] || 0) + 1;
  });
  return counts;
}

// ─── Targets ────────────────────────────────────────────────────────────────

/**
 * Load all target role documents.
 */
export async function loadAllTargets() {
  const snapshot = await targetsCol().orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Save/create a target document. Returns the saved target with its ID.
 */
export async function saveTarget(data) {
  const now = new Date().toISOString();
  const id = data.id || generateTargetId(data.company, data.role);

  const targetDoc = {
    title: data.title || `${data.company} — ${data.role}`,
    company: data.company || '',
    role: data.role || '',
    content: data.content || '',
    questionCount: data.questionCount || 0,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  await targetsCol().doc(id).set(targetDoc, { merge: true });
  return { id, ...targetDoc };
}

/**
 * Update the question count for a target.
 */
export async function updateTargetQuestionCount(targetId, count) {
  await targetsCol().doc(targetId).update({
    questionCount: count,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a target document and optionally its associated questions.
 */
export async function deleteTarget(targetId, deleteAssociatedQuestions = false) {
  if (deleteAssociatedQuestions) {
    const snapshot = await questionsCol()
      .where('sourceTargetId', '==', targetId)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  await targetsCol().doc(targetId).delete();
  return true;
}

/**
 * Get a single target by ID.
 */
export async function getTarget(targetId) {
  const doc = await targetsCol().doc(targetId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// ─── Resume Schema ──────────────────────────────────────────────────────────

/**
 * Load the resume schema from Firestore.
 */
export async function loadResumeSchema() {
  const doc = await resumeDoc().get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Save the resume schema to Firestore.
 */
export async function saveResumeSchema(rawYaml) {
  await resumeDoc().set({
    rawYaml,
    updatedAt: new Date().toISOString(),
    generationStatus: 'pending',
  }, { merge: true });
}

/**
 * Get the current schema generation status.
 */
export async function getGenerationStatus() {
  const doc = await resumeDoc().get();
  if (!doc.exists) return 'none';
  return doc.data().generationStatus || 'none';
}

/**
 * Set the schema generation status.
 */
export async function setGenerationStatus(status) {
  await resumeDoc().update({
    generationStatus: status,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Metadata / Stats ───────────────────────────────────────────────────────

/**
 * Get aggregate stats.
 */
export async function getStats() {
  const doc = await statsDoc().get();
  if (!doc.exists) {
    return {
      totalQuestions: 0,
      questionsBySource: {},
      generatedTopics: [],
    };
  }
  return doc.data();
}

/**
 * Update stats after creating a single question.
 */
async function updateStatsOnCreate(source) {
  await statsDoc().set({
    totalQuestions: FieldValue.increment(1),
    [`questionsBySource.${source}`]: FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Update stats after batch-creating questions.
 */
async function updateStatsOnBatchCreate(sourceCounts, total) {
  const updates = {
    totalQuestions: FieldValue.increment(total),
    updatedAt: new Date().toISOString(),
  };
  for (const [source, count] of Object.entries(sourceCounts)) {
    updates[`questionsBySource.${source}`] = FieldValue.increment(count);
  }
  await statsDoc().set(updates, { merge: true });
}

/**
 * Update stats after deleting a question.
 */
async function updateStatsOnDelete(source) {
  await statsDoc().set({
    totalQuestions: FieldValue.increment(-1),
    [`questionsBySource.${source}`]: FieldValue.increment(-1),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Add a topic to the list of generated topics.
 */
export async function addGeneratedTopic(topic) {
  await statsDoc().set({
    generatedTopics: FieldValue.arrayUnion(topic.toLowerCase()),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe document ID from a question title.
 */
function generateQuestionId(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

/**
 * Generate a document ID for a target.
 */
function generateTargetId(company, role) {
  const base = `${company}-${role}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

/**
 * Activate up to N unassigned/cold questions for review, setting assigned = true and sr.due = today.
 */
export async function activateDailyQuestions(count = 5) {
  const snapshot = await questionsCol()
    .where('assigned', '==', false)
    .limit(count)
    .get();

  if (snapshot.empty) return [];

  const batch = db.batch();
  const today = new Date().toISOString().split('T')[0];
  const activated = [];

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      assigned: true,
      'sr.due': today,
      updatedAt: new Date().toISOString(),
    });
    activated.push({ id: doc.id, title: doc.data().title });
  });

  await batch.commit();
  return activated;
}
