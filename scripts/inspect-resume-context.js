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
  // 2. Dynamically import llm and firebase after env vars are loaded!
  console.log("Loading modules and initializing database connections...");
  const { db } = await import('../src/lib/firebase-admin.js');
  const { parseResumeYaml, buildResumeContext } = await import('../src/lib/llm.js');

  console.log("Connecting to Firestore to load current resume schema...");
  
  const resumeDoc = db.collection('resumeSchema').doc('current');
  const doc = await resumeDoc.get();
  
  if (!doc.exists) {
    console.error("❌ No active resume schema found in Firestore! Please upload one via the UI first.");
    return;
  }
  
  const data = doc.data();
  const rawYaml = data.rawYaml || "";
  
  if (!rawYaml) {
    console.error("❌ Stored resume document exists but 'rawYaml' field is empty.");
    return;
  }
  
  console.log("Parsing YAML document...");
  const parsedSchema = parseResumeYaml(rawYaml);
  
  console.log("Building LLM Optimized Context...");
  const optimizedContext = buildResumeContext(parsedSchema);
  
  const rawChars = rawYaml.length;
  const optimizedChars = optimizedContext.length;
  const savingsPct = ((rawChars - optimizedChars) / rawChars * 100).toFixed(1);
  
  console.log("\n========================================================");
  console.log("📊 RESUME CONTEXT OPTIMIZATION METRICS");
  console.log("========================================================");
  console.log(`Original Raw YAML Size:      ${rawChars} characters (${(rawChars/1024).toFixed(2)} KB)`);
  console.log(`Optimized Context Size:      ${optimizedChars} characters (${(optimizedChars/1024).toFixed(2)} KB)`);
  console.log(`Raw-to-Prompt Token Savings:  ${savingsPct}% reduction! ⚡`);
  console.log("========================================================\n");
  
  console.log("========================================================");
  console.log("✏️ OUTPUT SENT TO GEMINI API AS RESUME CONTEXT:");
  console.log("========================================================");
  console.log(optimizedContext);
  console.log("========================================================\n");
}

run().catch(console.error);
