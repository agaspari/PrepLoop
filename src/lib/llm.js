import { GoogleGenAI } from '@google/genai';
import { getConfig, loadResumeSchema, loadAllTargets } from './fs-store.js';

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const config = getConfig();
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Gemini API Key is not configured. Please go to Settings to add your API key.');
  }
  
  return new GoogleGenAI({ apiKey });
}

/**
 * Clean up YAML schema to avoid sending overly verbose metadata to the LLM.
 * This retains all relevant experience facts, skills, and education details
 * but strips out internal parser hints to save tokens.
 */
function getCleanResumeContext() {
  const schema = loadResumeSchema();
  if (!schema) return 'No resume schema found.';
  
  // Format clean string representation of skills
  const skillsList = [];
  if (schema.skills) {
    for (const [key, val] of Object.entries(schema.skills)) {
      skillsList.push(`${val.canonical || key} (Proficiency: ${val.proficiency || 'proficient'})`);
    }
  }
  
  // Format clean experience facts
  const experienceList = [];
  if (schema.experience) {
    for (const job of schema.experience) {
      const facts = (job.facts || []).map(f => {
        return `- [Fact ID: ${f.id}] ${f.action}\n  Outcomes: ${(f.outcomes || []).map(o => o.text).join(', ')}\n  Tech Stack: ${(f.tech || []).join(', ')}`;
      }).join('\n');
      
      experienceList.push(`
Company: ${job.company}
Role: ${job.role_title}
Dates: ${job.dates}
Key Achievements / Facts:
${facts}
      `);
    }
  }

  // Format clean education details
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
  `;
}

/**
 * Clean up all target role and job description documents to reference.
 */
function getCleanTargetsContext() {
  const targets = loadAllTargets();
  if (targets.length === 0) return '';
  
  return targets.map((t, idx) => `
TARGET ROLE #${idx + 1}: ${t.title}
Filename: ${t.filename}
---
${t.content}
  `).join('\n\n');
}

/**
 * Generate 3-5 daily interview questions tailored to the candidate's skills and goals.
 */
export async function generateDailyQuestions() {
  const resumeText = getCleanResumeContext();
  const targetsText = getCleanTargetsContext();
  const ai = getGeminiClient();
  
  const systemPrompt = `
You are a panel of senior interviewers preparing a short daily prep deck for a software engineering candidate. Use the candidate's resume and target roles below to generate questions that are concrete, varied, and calibrated.

# Output schema
Return ONLY a JSON array of 3 to 5 question objects. Each object must have these fields:
- "title": short, specific question title (≤ 12 words). Avoid generic titles.
- "question": the full question text. Anchor it to a specific fact, project, technology, or claim from the candidate's profile. Ask for trade-offs, design decisions, failure modes, or defense of real choices — not pseudocode.
- "category": one of "system-design", "conceptual-engineering", "behavioral".
- "subCategories": 2–5 lowercase tags for the topics involved (e.g. ["postgres", "indexing", "scaling"]).
- "difficulty": one of "easy", "medium", "hard".
- "resumeContext": 1–3 sentences naming the specific resume fact, project, or skill that motivated this question.

# Difficulty distribution (strict)
The deck must contain a mix of difficulties:
- At least one "easy" warm-up that asks the candidate to clearly explain a fundamental concept tied to their stack.
- At least one "medium" question probing trade-offs or alternatives on a real project.
- The remainder may be "hard" — deeper architecture, design under constraints, or rigorous behavioral defenses.
NEVER return a deck where every question is "hard". A deck that is all-hard will be rejected.

# Variety rules
- Spread across categories: include at least two of {system-design, conceptual-engineering, behavioral} unless the target roles clearly demand otherwise.
- Spread across the resume: do not center two questions on the same project, company, or fact. Rotate through the candidate's experience.
- When target roles are provided, prefer facts that intersect with those roles.

# Quality bar
- Every question must be anchored to something concrete in the profile (a project, a named technology, an outcome, a degree focus). Vague prompts like "tell me about a time you led a team" are not acceptable unless tied to a specific role or claim.
- For system-design / conceptual questions: ask about decisions, trade-offs, scaling limits, data consistency, security, failure modes. Do not ask the candidate to write code.
- For behavioral questions: challenge a stated outcome. Ask how it was measured, what was rejected, who pushed back, what failed first.

${targetsText ? `# Target roles
Align scenarios, scale, and technologies with these target roles when relevant:
${targetsText}
` : ''}

# Candidate profile
${resumeText}
  `.trim();

  const prompt = "Generate today's prep deck (3–5 questions). Apply the difficulty distribution and variety rules strictly. Return JSON only.";

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: systemPrompt + '\n\n' + prompt,
    config: {
      responseMimeType: 'application/json'
    }
  });

  const rawJson = response.text;
  try {
    return JSON.parse(rawJson);
  } catch (error) {
    console.error('Failed to parse generated questions JSON. Raw response:', rawJson);
    throw new Error('LLM did not return valid JSON. Please try again.');
  }
}

/**
 * Grade and evaluate the candidate's long-form answer.
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
    contents: prompt
  });
  const fullText = response.text;
  
  // Extract the JSON block at the bottom
  const jsonRegex = /```json\r?\n([\s\S]*?)\r?\n```/g;
  let recommendedRating = 3; // Default
  let match;
  
  // Find the last JSON block in the text
  while ((match = jsonRegex.exec(fullText)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (typeof data.recommended_rating === 'number') {
        recommendedRating = data.recommended_rating;
      }
    } catch (e) {
      // Ignore parse error, keep searching or fallback to default
    }
  }

  // Clean up the JSON block from the user-facing markdown feedback if desired,
  // or leave it as it is a nice structured ending. We'll strip it for clean note reading
  const cleanMarkdown = fullText.replace(/```json\r?\n[\s\S]*?\r?\n```/g, '').trim();

  return {
    evaluationMarkdown: cleanMarkdown,
    recommendedRating
  };
}
