import fs from 'fs';
import path from 'path';

// 1. Load env vars synchronously first
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

async function run() {
  // 2. Dynamically import firebase after env vars are loaded!
  console.log("Loading Firebase Admin and establishing connection...");
  const { db } = await import('../src/lib/firebase-admin.js');

  console.log("Fetching all documents from 'questions' collection...");
  const questionsSnapshot = await db.collection('questions').get();
  
  if (questionsSnapshot.empty) {
    console.log("✨ No questions found in the database. Nothing to delete!");
    return;
  }

  const totalQuestions = questionsSnapshot.size;
  console.log(`⚠️ Found ${totalQuestions} questions. Beginning deletion...`);

  // Use a batch delete or concurrent deletes. Since Firestore allows batches up to 500 operations,
  // we can use batches to make it extremely efficient and atomic!
  const chunks = [];
  const docs = questionsSnapshot.docs;
  for (let i = 0; i < docs.length; i += 400) {
    chunks.push(docs.slice(i, i + 400));
  }

  let deletedCount = 0;
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`🧹 Deleted ${deletedCount}/${totalQuestions} questions...`);
  }

  // Also reset targets' questionCount counters to 0, since they had target questions
  console.log("Resetting targets question counters...");
  const targetsSnapshot = await db.collection('targets').get();
  if (!targetsSnapshot.empty) {
    const batch = db.batch();
    targetsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { questionCount: 0 });
    });
    await batch.commit();
    console.log(`🔄 Reset counters for ${targetsSnapshot.size} target roles.`);
  }

  // Also reset stats metadata if exists
  console.log("Resetting statistics metadata...");
  const statsDocRef = db.collection('metadata').doc('stats');
  await statsDocRef.set({
    totalQuestions: 0,
    questionsBySource: {
      "resume-ingestion": 0,
      "target-ingestion": 0,
      "topic-generated": 0,
      "custom": 0
    }
  }, { merge: true });

  console.log("\n========================================================");
  console.log("🎉 SUCCESS: Questions database has been fully cleared!");
  console.log("========================================================\n");
  console.log("You can now safely re-upload your resume schema or targets in the UI to trigger a fresh import with your upgraded Systems & Internals prompt engine!");
}

run().catch(console.error);
