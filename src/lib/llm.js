import { GoogleGenAI } from '@google/genai';
import {
  loadResumeSchema,
  loadAllTargets,
  getTarget,
  getRecentQuestionTitles,
  getQuestionTitlesForTarget,
  getQuestionTitlesForTopic,
} from './cloud-store.js';
import yaml from 'js-yaml';

// ─── Client Init ────────────────────────────────────────────────────────────

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is not configured. Set the GEMINI_API_KEY environment variable.');
  }
  return new GoogleGenAI({ apiKey });
}

// ─── Resume Context Helpers ─────────────────────────────────────────────────

/**
 * Parse the raw YAML string stored in Firestore into a structured resume object.
 */
export function parseResumeYaml(rawYaml) {
  if (!rawYaml) return null;
  try {
    return yaml.load(rawYaml);
  } catch (e) {
    console.error('Error parsing resume YAML:', e);
    return null;
  }
}

/**
 * Build a clean, token-efficient resume context string from parsed schema.
 */
export function buildResumeContext(schema) {
  if (!schema) return 'No resume schema found.';

  const skillsList = [];
  if (schema.skills) {
    for (const [key, val] of Object.entries(schema.skills)) {
      skillsList.push(`${val.canonical || key} (${val.proficiency || 'proficient'})`);
    }
  }

  const experienceList = [];
  if (schema.experience) {
    for (const job of schema.experience) {
      const facts = (job.facts || []).map(f => {
        return `- [${f.id}] ${f.action}\n  Outcomes: ${(f.outcomes || []).map(o => o.text).join(', ')}\n  Tech: ${(f.tech || []).join(', ')}`;
      }).join('\n');

      experienceList.push(`
Company: ${job.company}
Role: ${job.role_title}
Dates: ${job.dates}
Facts:
${facts}
      `);
    }
  }

  const educationList = [];
  if (schema.education) {
    for (const edu of schema.education) {
      educationList.push(`${edu.degree} in ${edu.field} at ${edu.institution} (Focus: ${(edu.focus || []).join(', ')})`);
    }
  }

  return `
CANDIDATE: ${schema.meta?.candidate || 'Candidate'}
EDUCATION:
${educationList.map(e => `- ${e}`).join('\n')}

TECHNICAL SKILLS:
${skillsList.map(s => `- ${s}`).join('\n')}

PROFESSIONAL EXPERIENCE:
${experienceList.join('\n')}
  `.trim();
}

/**
 * Extract all individual facts from the resume schema, each with its parent job context.
 */
export function extractFacts(schema) {
  if (!schema?.experience) return [];

  const facts = [];
  for (const job of schema.experience) {
    for (const fact of (job.facts || [])) {
      facts.push({
        factId: fact.id,
        action: fact.action,
        outcomes: (fact.outcomes || []).map(o => o.text),
        tech: fact.tech || [],
        themes: fact.themes || [],
        company: job.company,
        role: job.role_title,
        dates: job.dates,
        baseThemes: job.base_themes || [],
      });
    }
  }
  return facts;
}

/**
 * Group skills into clusters for question generation.
 */
export function extractSkillClusters(schema) {
  if (!schema?.skills) return [];

  const categoryMap = {};
  for (const [key, val] of Object.entries(schema.skills)) {
    const categories = val.categories || ['general'];
    const primary = categories[0];
    if (!categoryMap[primary]) {
      categoryMap[primary] = [];
    }
    categoryMap[primary].push({
      key,
      canonical: val.canonical || key,
      proficiency: val.proficiency || 'familiar',
      categories,
    });
  }

  return Object.entries(categoryMap).map(([category, skills]) => ({
    category,
    skills,
  }));
}

// ─── Resume Ingestion — Chunked Generation ──────────────────────────────────

/**
 * Generate questions for a single resume fact.
 * Returns 4-5 questions anchored to this specific fact.
 */
export async function generateQuestionsForFact(fact, fullResumeContext) {
  const ai = getGeminiClient();

  const prompt = `
You are a senior interviewer creating interview questions anchored to ONE specific achievement from a candidate's resume.

CANDIDATE CONTEXT (for background, but focus on the TARGET FACT below):
${fullResumeContext}

TARGET FACT to generate questions about:
Company: ${fact.company} (${fact.role})
Achievement: ${fact.action}
Outcomes: ${fact.outcomes.join('; ')}
Technologies: ${fact.tech.join(', ')}
Themes: ${fact.themes.join(', ')}

Generate exactly 4 to 5 interview questions about THIS fact. Requirements:
- Include at least one from each: system-design or conceptual-engineering, and behavioral
- At least one "easy" warm-up, at least one "hard" deep-dive
- Ask about trade-offs, failure modes, alternatives considered, scaling limits, design decisions
- For behavioral: challenge stated outcomes — how measured, who pushed back, what failed
- DO NOT ask for code or pseudocode

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text anchored to this fact",
  "category": "system-design" | "conceptual-engineering" | "behavioral",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences naming the specific fact and why this question matters"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  return safeParseJsonArray(response.text);
}

/**
 * Generate conceptual questions for a skill cluster.
 * Returns 2-3 questions about the skills in this cluster.
 */
export async function generateQuestionsForSkillCluster(cluster, fullResumeContext) {
  const ai = getGeminiClient();

  const skillNames = cluster.skills.map(s => s.canonical).join(', ');

  const prompt = `
You are a senior interviewer creating conceptual engineering questions about a SKILL CLUSTER from a candidate's stack.

CANDIDATE CONTEXT:
${fullResumeContext}

SKILL CLUSTER: ${cluster.category}
Skills in cluster: ${skillNames}

Generate exactly 3 conceptual or system-design questions that test deep understanding of these technologies.
- Focus on trade-offs between tools in this cluster, when to use what, architectural implications
- At least one should be "easy" (explain a core concept), one "medium" or "hard" (design decision or trade-off)
- Anchor to the candidate's real usage where possible

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text",
  "category": "conceptual-engineering" | "system-design",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences connecting to candidate's experience with these skills"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  return safeParseJsonArray(response.text);
}

/**
 * Generate cross-cutting behavioral questions across all experience.
 */
export async function generateBehavioralQuestions(fullResumeContext) {
  const ai = getGeminiClient();

  const prompt = `
You are a senior interviewer creating behavioral interview questions that cut across a candidate's FULL career history.

CANDIDATE CONTEXT:
${fullResumeContext}

Generate exactly 20 behavioral interview questions. Requirements:
- Cover themes: leadership, conflict resolution, failure/recovery, prioritization, mentoring, cross-team collaboration, technical debt decisions, stakeholder management, time pressure
- EACH question must reference a SPECIFIC company, role, or project from the candidate's experience — no generic "tell me about a time" without context
- Mix difficulties: 5 easy, 10 medium, 5 hard
- Challenge stated outcomes: ask how things were measured, what alternatives were rejected, what went wrong first
- Spread across different companies/roles — don't cluster on one employer

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text tied to specific experience",
  "category": "behavioral",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences naming the specific role/project referenced"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  return safeParseJsonArray(response.text);
}

/**
 * Generate system design combination questions that combine multiple facts/skills.
 */
export async function generateSystemDesignQuestions(fullResumeContext) {
  const ai = getGeminiClient();

  const prompt = `
You are a senior interviewer creating system design questions that combine MULTIPLE aspects of a candidate's experience.

CANDIDATE CONTEXT:
${fullResumeContext}

Generate exactly 15 system design questions. Requirements:
- Each question should combine knowledge from at least 2 different projects or skill areas
- Ask about designing systems at scale, making architectural decisions, handling failure modes
- Include data modeling, API design, caching, consistency, observability themes
- Mix difficulties: 3 easy, 7 medium, 5 hard
- Don't ask for code — ask for architecture, component design, trade-offs

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text combining multiple experience areas",
  "category": "system-design",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences naming the specific facts/projects combined"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  return safeParseJsonArray(response.text);
}

/**
 * Run the full resume ingestion pipeline.
 * Generates ~150 questions across all facts, skill clusters, behavioral, and system design.
 * Returns all generated questions (not yet saved — caller handles saving).
 *
 * @param {string} rawYaml - The raw schema.yaml content
 * @param {function} onProgress - Optional callback: (step, total, message) => void
 * @returns {Array} Array of question objects ready for batch creation
 */
export async function runResumeIngestion(rawYaml, onProgress = null) {
  const schema = parseResumeYaml(rawYaml);
  if (!schema) throw new Error('Failed to parse resume schema.');

  const resumeContext = buildResumeContext(schema);
  const facts = extractFacts(schema);
  const skillClusters = extractSkillClusters(schema);

  const allQuestions = [];
  const totalSteps = facts.length + skillClusters.length + 2; // +2 for behavioral and system design
  let currentStep = 0;

  // 1. Generate questions per fact (parallel in batches of 5)
  for (let i = 0; i < facts.length; i += 5) {
    const batch = facts.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(fact => generateQuestionsForFact(fact, resumeContext).catch(err => {
        console.error(`Error generating for fact ${fact.factId}:`, err);
        return [];
      }))
    );
    for (const questions of results) {
      allQuestions.push(...questions.map(q => ({ ...q, source: 'resume-ingestion' })));
    }
    currentStep += batch.length;
    if (onProgress) onProgress(currentStep, totalSteps, `Generated questions for ${currentStep}/${facts.length} experience facts...`);
  }

  // 2. Generate questions per skill cluster (parallel in batches of 5)
  for (let i = 0; i < skillClusters.length; i += 5) {
    const batch = skillClusters.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(cluster => generateQuestionsForSkillCluster(cluster, resumeContext).catch(err => {
        console.error(`Error generating for cluster ${cluster.category}:`, err);
        return [];
      }))
    );
    for (const questions of results) {
      allQuestions.push(...questions.map(q => ({ ...q, source: 'resume-ingestion' })));
    }
    currentStep += batch.length;
    if (onProgress) onProgress(currentStep, totalSteps, `Generated questions for ${currentStep - facts.length}/${skillClusters.length} skill clusters...`);
  }

  // 3. Generate cross-cutting behavioral questions
  try {
    const behavioral = await generateBehavioralQuestions(resumeContext);
    allQuestions.push(...behavioral.map(q => ({ ...q, source: 'resume-ingestion' })));
  } catch (err) {
    console.error('Error generating behavioral questions:', err);
  }
  currentStep++;
  if (onProgress) onProgress(currentStep, totalSteps, 'Generated behavioral questions...');

  // 4. Generate system design combination questions
  try {
    const sysDesign = await generateSystemDesignQuestions(resumeContext);
    allQuestions.push(...sysDesign.map(q => ({ ...q, source: 'resume-ingestion' })));
  } catch (err) {
    console.error('Error generating system design questions:', err);
  }
  currentStep++;
  if (onProgress) onProgress(currentStep, totalSteps, 'Generated system design questions. Complete!');

  return allQuestions;
}

// ─── Target Ingestion ───────────────────────────────────────────────────────

/**
 * Generate interview questions for a target role, cross-referenced with resume.
 */
export async function generateTargetQuestions(target, rawYaml, existingTitles = []) {
  const ai = getGeminiClient();
  const schema = parseResumeYaml(rawYaml);
  const resumeContext = schema ? buildResumeContext(schema) : 'No resume available.';

  const dedupBlock = existingTitles.length > 0
    ? `\nDO NOT generate questions similar to these existing ones:\n${existingTitles.map(t => `- "${t}"`).join('\n')}\n`
    : '';

  const prompt = `
You are a senior interviewer preparing targeted interview questions for a specific company and role.

CANDIDATE CONTEXT:
${resumeContext}

TARGET ROLE:
Company: ${target.company || target.title}
Role: ${target.role || ''}
Job Description / Details:
${target.content}

${dedupBlock}

Generate 25 to 35 interview questions that a candidate would realistically face for this specific role at this company. Requirements:
- Use your knowledge of ${target.company}'s interview process, engineering culture, and technical stack
- Mix categories: ~10 system-design, ~15 conceptual-engineering, ~10 behavioral
- Mix difficulties: ~8 easy, ~15 medium, ~12 hard
- Anchor questions to the intersection of the candidate's experience and the target role
- For technical questions: focus on the tech stack mentioned in the JD
- For behavioral: align with the company's known cultural values and leadership principles
- Ask about trade-offs, design decisions, failure modes, scaling — NOT pseudocode

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text",
  "category": "system-design" | "conceptual-engineering" | "behavioral",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences on how this connects to the candidate's experience and the target role"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  const questions = safeParseJsonArray(response.text);
  return questions.map(q => ({
    ...q,
    source: 'target-ingestion',
    sourceTargetId: target.id || null,
  }));
}

// ─── Topic-Based Generation ─────────────────────────────────────────────────

/**
 * Generate questions for a user-specified topic with optional context sources.
 */
export async function generateTopicQuestions(topic, contextSources = {}, rawYaml = null) {
  const ai = getGeminiClient();

  let contextBlock = '';

  // Add resume context if requested
  if (contextSources.useResume && rawYaml) {
    const schema = parseResumeYaml(rawYaml);
    const resumeContext = schema ? buildResumeContext(schema) : '';
    if (resumeContext) {
      contextBlock += `\nCANDIDATE RESUME CONTEXT:\n${resumeContext}\n`;
    }
  }

  // Add target context if requested
  if (contextSources.targetContent) {
    contextBlock += `\nTARGET ROLE CONTEXT:\nCompany: ${contextSources.targetCompany || 'Unknown'}\nRole: ${contextSources.targetRole || ''}\nDetails:\n${contextSources.targetContent}\n`;
  }

  // Dedup block
  const existingTitles = await getQuestionTitlesForTopic(topic);
  const dedupBlock = existingTitles.length > 0
    ? `\nDO NOT generate questions similar to these existing ones on this topic:\n${existingTitles.map(t => `- "${t}"`).join('\n')}\n`
    : '';

  const prompt = `
You are a senior interviewer creating a deep-dive question set on a specific technical topic.

TOPIC: ${topic}
${contextBlock}
${dedupBlock}

Generate exactly 8 interview questions focused on "${topic}". Requirements:
- Deep technical coverage of ${topic}: fundamentals, trade-offs, design patterns, failure modes, real-world applications
- Mix categories: at least 2 system-design, at least 3 conceptual-engineering, at least 1 behavioral
- Mix difficulties: 2 easy, 3 medium, 3 hard
- If candidate context is provided, anchor questions to their real experience where natural
- Ask about trade-offs, edge cases, alternatives, scaling limits — NOT pseudocode

Return ONLY a JSON array. Each object:
{
  "title": "short specific title (≤ 12 words)",
  "question": "full question text",
  "category": "system-design" | "conceptual-engineering" | "behavioral",
  "subCategories": ["tag1", "tag2"],
  "difficulty": "easy" | "medium" | "hard",
  "resumeContext": "1-2 sentences explaining why this question matters for the topic"
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  const questions = safeParseJsonArray(response.text);
  return questions.map(q => ({
    ...q,
    source: 'topic-generated',
    sourceTopic: topic.toLowerCase(),
  }));
}

// ─── Answer Evaluation ──────────────────────────────────────────────────────

/**
 * Grade and evaluate the candidate's long-form answer.
 * Unchanged from original — this works well as-is.
 */
export async function evaluateAnswer(questionTitle, questionText, resumeContext, userAnswer) {
  const ai = getGeminiClient();

  const prompt = `
You are a senior interviewer evaluating a candidate's long-form answer. Grade rigorously but fairly, calibrated to the apparent difficulty of the question — not every question deserves FAANG-tier expectations.

### QUESTION
Title: ${questionTitle}
Question: ${questionText}
Resume context that motivated this question: ${resumeContext}

### CANDIDATE'S ANSWER
${userAnswer ? userAnswer : '(No answer was submitted.)'}

### YOUR EVALUATION
Return clean Markdown with these sections in order. If no answer was submitted, give 0/100, skip sections 2 and 3, still provide section 4, and set the SM-2 rating to 0.

1. **Score**: An overall score in the form "XX/100" and a one-sentence verdict.
2. **Strengths**: Concrete things the candidate did well — specific claims they defended, trade-offs they raised, structure they used. Cite their wording where it helps.
3. **Gaps & Missed Trade-offs**: Specific omissions — edge cases, scaling limits, security, data consistency, alternatives, failure modes. Avoid generic advice; tie each gap to this question.
4. **Ideal Answer Outline**: Bullet rubric of what a strong answer covers for THIS specific question. Tailored, not boilerplate.
5. **SM-2 Rating Recommendation**: Recommend a score from 0 to 5 for spaced repetition:
   - **5** — Thorough, well-structured, key trade-offs covered.
   - **4** — Strong; minor architectural or edge-case omissions.
   - **3** — Hits the basics but misses critical trade-offs or scaling considerations.
   - **2** — Mostly off but shows correct basic intuition on the technology.
   - **1** — Mostly wrong; remembered some details.
   - **0** — No answer or completely wrong.

At the very end of your response, output ONLY this JSON block (do not include any other \`json\` code block anywhere else in your response):
\`\`\`json
{
  "recommended_rating": 4,
  "justification": "One sentence explaining the rating."
}
\`\`\`
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const fullText = response.text;

  // Extract the JSON block at the bottom
  const jsonRegex = /```json\r?\n([\s\S]*?)\r?\n```/g;
  let recommendedRating = 3;
  let match;

  while ((match = jsonRegex.exec(fullText)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (typeof data.recommended_rating === 'number') {
        recommendedRating = data.recommended_rating;
      }
    } catch (e) {
      // Ignore, keep searching or fallback
    }
  }

  const cleanMarkdown = fullText.replace(/```json\r?\n[\s\S]*?\r?\n```/g, '').trim();

  return {
    evaluationMarkdown: cleanMarkdown,
    recommendedRating,
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Try to repair a truncated JSON string by closing unclosed brackets and quotes.
 * Extremely robust for partial LLM responses.
 */
function repairTruncatedJson(str) {
  if (!str) return '';

  let insideString = false;
  let isEscaped = false;
  const stack = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      insideString = !insideString;
      continue;
    }

    if (!insideString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  let repaired = str;

  // 1. Close unclosed string
  if (insideString) {
    repaired += '"';
  }

  // 2. Remove trailing comma or partial field if needed
  repaired = repaired.trim();
  if (repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1).trim();
  }

  // 3. Close open brackets/objects
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') {
      repaired += '}';
    } else if (open === '[') {
      repaired += ']';
    }
  }

  return repaired;
}

/**
 * Safely parse a JSON array from LLM response text.
 * Handles cases where the LLM wraps the JSON in markdown code blocks and repairs truncated JSON.
 */
function safeParseJsonArray(text) {
  if (!text) return [];

  // Try direct parse
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // Try extracting from markdown code block first
    const codeBlockMatch = text.match(/```(?:json)?\r?\n([\s\S]*?)\r?\n```/);
    let targetText = codeBlockMatch ? codeBlockMatch[1] : text;

    try {
      const parsed = JSON.parse(targetText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e2) {
      // Attempt repair on truncated JSON
      try {
        console.warn('Attempting JSON repair on truncated LLM response...');
        const repaired = repairTruncatedJson(targetText);
        const parsed = JSON.parse(repaired);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e3) {
        console.error('Failed to parse and repair LLM JSON response:', e3);
        console.error('Original truncated text:', text.slice(0, 300));
      }
    }
    return [];
  }
}
