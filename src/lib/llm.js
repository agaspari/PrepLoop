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
 * Helper to call Gemini and parse JSON response
 */
async function callGeminiJson(systemPrompt, prompt) {
  const ai = getGeminiClient();
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
 * Generate N questions focused strictly on general resume profile.
 */
async function generateResumeOnlyQuestions(resumeText, count) {
  if (count <= 0) return [];
  
  const systemPrompt = `
You are a senior software engineering interviewer preparing a set of short daily interview questions for a candidate. Focus strictly on their resume experiences, past projects, and core technical skills.

# Output schema
Return ONLY a JSON array of exactly ${count} question objects. Each object must have these fields:
- "title": short, specific question title (≤ 12 words). Avoid generic titles.
- "question": the full question text. Anchor it to a specific fact, project, technology, or claim from the candidate's profile.
  * For "conceptual-engineering" questions (especially Easy/Medium): Focus on direct technical fundamentals, low-level mechanics, data structures, or runtime behavior of their technologies (e.g. JVM memory, Go channels, Java HashMap collision resolution, cache-locality, DB indexes). Structure these questions progressively using 1-2 concise bulleted follow-ups (e.g. "What is [X]?\n- How does it handle [Y]?\n- Which approach is better for [Z] and why?"). Keep them direct, concise, and realistic.
  * For "system-design" / "behavioral": Ask for architectural trade-offs, scaling limits, data consistency, or defense of choices as usual. Do not ask for code.
- "category": one of "system-design", "conceptual-engineering", "behavioral".
- "subCategories": 2–5 lowercase tags for the topics involved (e.g. ["postgres", "indexing", "scaling"]).
- "difficulty": one of "easy", "medium", "hard".
- "resumeContext": 1–2 sentences naming the specific resume fact, project, or skill that motivated this question.

# Difficulty distribution constraints
- If generating 1 question: Make it "easy" or "medium".
- If generating 2 questions: Make one "easy" warm-up focused on low-level mechanics, and one "medium" probing trade-offs or internals.
- If generating 3 or more questions: Include at least one "easy" warm-up, at least one "medium" question, and the remainder "hard".
NEVER return a deck where every question is "hard".

# Variety rules
- Spread across categories: include at least two of {system-design, conceptual-engineering, behavioral} if generating multiple questions.
- Spread across the resume: do not center two questions on the same project, company, or fact. Rotate through the candidate's experience.

# Quality bar
- Every question must be anchored to something concrete in the profile (a project, a named technology, an outcome, a degree focus). Vague prompts like "tell me about a time you led a team" are not acceptable.
- For system-design questions: ask about decisions, trade-offs, scaling limits, data consistency, security, failure modes. Do not ask the candidate to write code.
- For conceptual-engineering questions: focus on the inner workings, algorithmic trade-offs, data structures, or performance implications (like cache efficiency or memory locality) of languages and tools in their stack. Make them direct, concise, and progressive with bulleted follow-up queries.
- For behavioral questions: challenge a stated outcome. Ask how it was measured, what was rejected, who pushed back, what failed first.

# Constraints
- Do NOT reference target roles or any specific job descriptions. Focus purely on general resume facts and tech stack.

# Candidate profile
${resumeText}
  `.trim();

  const prompt = `Generate exactly ${count} distinct interview questions. Return JSON only.`;
  return await callGeminiJson(systemPrompt, prompt);
}

/**
 * Generate N questions tailored strictly to a specific target role.
 */
async function generateTargetAlignedQuestions(resumeText, target, count) {
  if (count <= 0 || !target) return [];
  
  const systemPrompt = `
You are a senior software engineering interviewer preparing tailored interview questions for a candidate. Focus strictly on the intersection of the candidate's resume and the specific target role described below.

# Target Role to Align With
Title: ${target.title}
Role Description:
${target.content}

# Output schema
Return ONLY a JSON array of exactly ${count} question objects. Each object must have these fields:
- "title": short, specific question title (≤ 12 words). Avoid generic titles.
- "question": the full question text. Anchor it to a specific project, claim, or technology from their profile, but frame the scenario or architectural trade-offs around the requirements of the target role above. Do not ask for code.
- "category": one of "system-design", "conceptual-engineering", "behavioral".
- "subCategories": 2–5 lowercase tags for the topics involved (e.g. ["postgres", "indexing", "scaling"]).
- "difficulty": one of "easy", "medium", "hard".
- "resumeContext": 1–2 sentences. Must start with the prefix "Tailored for ${target.title}: " followed by the specific resume fact and why it aligns with the target role.

# Constraints
- Every question must be directly related to the target role.
- Focus on the intersection: find facts in the candidate's profile that are relevant to the target role requirements and design a targeted scenario.

# Candidate profile
${resumeText}
  `.trim();

  const prompt = `Generate exactly ${count} target-aligned interview questions. Return JSON only.`;
  return await callGeminiJson(systemPrompt, prompt);
}

/**
 * Generate 3-5 daily interview questions tailored to the candidate's skills and goals.
 */
export async function generateDailyQuestions() {
  const resumeText = getCleanResumeContext();
  const allTargets = loadAllTargets();
  
  let questionsList = [];
  
  if (allTargets.length === 0) {
    // Generate 3–4 general resume-only questions
    questionsList = await generateResumeOnlyQuestions(resumeText, 3);
  } else {
    // Determine the mix programmatically: 2 resume-only, 1 target-aligned
    const resumeCount = 2;
    const targetCount = 1;
    
    // Pick 1 random target role from the list
    const randomTargetIndex = Math.floor(Math.random() * allTargets.length);
    const selectedTarget = allTargets[randomTargetIndex];
    
    // Generate questions using both helpers
    const resumeQuestions = await generateResumeOnlyQuestions(resumeText, resumeCount);
    const targetQuestions = await generateTargetAlignedQuestions(resumeText, selectedTarget, targetCount);
    
    questionsList = [...resumeQuestions, ...targetQuestions];
  }
  
  // Shuffle list so target-aligned and general questions are mixed
  return questionsList.sort(() => Math.random() - 0.5);
}

/**
 * Grade and evaluate the candidate's long-form answer.
 */
export async function evaluateAnswer(questionTitle, questionText, resumeContext, userAnswer) {
  const ai = getGeminiClient();
  
  const prompt = `
You are a senior interviewer evaluating a candidate's answer. Grade rigorously but fairly, calibrated to the apparent difficulty and type of the question — not every question deserves FAANG-tier expectations.

### EVALUATION CALIBRATION FOR CONCISENESS
If the question is a direct technical conceptual question focusing on low-level mechanics or data structures (e.g. Java HashMap internals, Go channels, DB index structures), **DO NOT** penalize the candidate for omitting out-of-scope architectural concepts (such as security, multi-region scaling, load balancing, or network configurations) unless the question explicitly asked for them.
Instead:
- Reward answers that are highly precise, direct, and concise (high signal-to-noise ratio).
- Focus feedback on the specific technical details asked in the prompt.
- Calibrate the score based on their depth of understanding of the direct question.

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
3. **Gaps & Missed Trade-offs**: Specific omissions or incorrect assumptions. Focus on low-level details (e.g., memory locality, cache misses, complexity, edge-cases) for conceptual engineering questions, and system/behavioral omissions for design/behavioral questions. Avoid generic advice; tie each gap directly to this question.
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
