import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const SCHEMA_FILE = path.join(process.cwd(), 'schema.yaml');

/**
 * Get the current configuration from environment variables.
 * All secrets and paths are configured via .env or platform env vars.
 */
export function getConfig() {
  return {
    vaultPath: process.env.VAULT_PATH || path.join(process.cwd(), 'vault'),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    webhookUrl: process.env.WEBHOOK_URL || '',
    cronSecret: process.env.CRON_SECRET || 'preploop-default-secret'
  };
}

/**
 * Load and parse schema.yaml
 */
export function loadResumeSchema() {
  try {
    if (fs.existsSync(SCHEMA_FILE)) {
      const data = fs.readFileSync(SCHEMA_FILE, 'utf8');
      return yaml.load(data);
    }
  } catch (error) {
    console.error('Error reading schema.yaml:', error);
  }
  return null;
}

/**
 * Return the raw YAML content of schema.yaml plus its resolved path.
 * Used to render the read-only Profile viewer in the UI.
 */
export function loadResumeSchemaRaw() {
  try {
    if (fs.existsSync(SCHEMA_FILE)) {
      return {
        path: SCHEMA_FILE,
        content: fs.readFileSync(SCHEMA_FILE, 'utf8')
      };
    }
  } catch (error) {
    console.error('Error reading schema.yaml:', error);
  }
  return { path: SCHEMA_FILE, content: null };
}

/**
 * Helper to ensure the Questions directory exists in the vault
 */
function ensureQuestionsDir(vaultPath) {
  const qDir = path.join(vaultPath, 'PrepLoop', 'Questions');
  if (!fs.existsSync(qDir)) {
    fs.mkdirSync(qDir, { recursive: true });
  }
  return qDir;
}

/**
 * Parse an Obsidian markdown file that contains YAML frontmatter
 */
export function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Standard frontmatter regex: matches --- [yaml content] --- [body]
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return {
      metadata: {},
      body: content,
      answer: '',
      feedback: ''
    };
  }
  
  const yamlContent = match[1];
  const body = match[2];
  
  let metadata = {};
  try {
    metadata = yaml.load(yamlContent) || {};
  } catch (e) {
    console.error('Error parsing frontmatter in:', filePath, e);
  }
  
  // Extract user answer and AI feedback from standard markdown headings
  // We expect:
  // ### User Answer
  // [answer text]
  // ### AI Feedback & Evaluation
  // [feedback text]
  let answer = '';
  let feedback = '';
  
  const answerHeaderIndex = body.indexOf('### User Answer');
  const feedbackHeaderIndex = body.indexOf('### AI Feedback & Evaluation');
  
  if (answerHeaderIndex !== -1) {
    if (feedbackHeaderIndex !== -1 && feedbackHeaderIndex > answerHeaderIndex) {
      answer = body.slice(answerHeaderIndex + '### User Answer'.length, feedbackHeaderIndex).trim();
      feedback = body.slice(feedbackHeaderIndex + '### AI Feedback & Evaluation'.length).trim();
    } else {
      answer = body.slice(answerHeaderIndex + '### User Answer'.length).trim();
    }
  }
  
  // Clean up HTML comment placeholder <!-- WRITE YOUR ANSWER BELOW THIS LINE -->
  answer = answer.replace(/<!-- WRITE YOUR ANSWER BELOW THIS LINE -->\r?\n?/g, '').trim();
  
  return {
    metadata,
    body,
    answer,
    feedback,
    filePath
  };
}

/**
 * Write/Save an Obsidian Markdown file with YAML frontmatter
 */
export function saveMarkdownFile(filePath, metadata, body) {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const yamlString = yaml.dump(metadata, { lineWidth: -1 }).trim();
  const fileContent = `---\n${yamlString}\n---\n${body}`;
  fs.writeFileSync(filePath, fileContent, 'utf8');
}

/**
 * Load all questions from the configured vault directory
 */
export function loadAllQuestions() {
  const config = getConfig();
  const qDir = ensureQuestionsDir(config.vaultPath);
  
  const files = fs.readdirSync(qDir);
  const questions = [];
  
  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(qDir, file);
      try {
        const parsed = parseMarkdownFile(filePath);
        if (parsed.metadata.type === 'interview-question') {
          questions.push({
            id: parsed.metadata.id,
            title: file.replace('.md', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            filename: file,
            ...parsed
          });
        }
      } catch (err) {
        console.error('Error parsing question file:', file, err);
      }
    }
  }
  
  return questions;
}

/**
 * Save user's answer and evaluation back to the question note
 */
export function saveAnswerAndEvaluation(questionId, answerText, evaluationText, srsMetadata = null) {
  const questions = loadAllQuestions();
  const question = questions.find(q => q.id === questionId);
  
  if (!question) {
    throw new Error(`Question with ID ${questionId} not found`);
  }
  
  const updatedMetadata = {
    ...question.metadata,
    ...(srsMetadata || {})
  };
  
  // Build new markdown body
  // We preserve everything in the body before "### User Answer" to avoid losing title/question text
  let preAnswerText = '';
  const answerIndex = question.body.indexOf('### User Answer');
  
  if (answerIndex !== -1) {
    preAnswerText = question.body.slice(0, answerIndex).trim();
  } else {
    preAnswerText = question.body.trim();
  }
  
  const newBody = `\n${preAnswerText}\n\n### User Answer\n<!-- WRITE YOUR ANSWER BELOW THIS LINE -->\n\n${answerText}\n\n### AI Feedback & Evaluation\n\n${evaluationText}\n`;
  
  saveMarkdownFile(question.filePath, updatedMetadata, newBody);
  return {
    ...question,
    metadata: updatedMetadata,
    answer: answerText,
    feedback: evaluationText
  };
}

/**
 * Create a new daily interview question note
 */
export function createNewQuestion(questionData) {
  const config = getConfig();
  const qDir = ensureQuestionsDir(config.vaultPath);
  
  const { title, question, category, subCategories, difficulty, resumeContext, id } = questionData;
  
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
    
  const fileName = `${sanitizedTitle}.md`;
  const filePath = path.join(qDir, fileName);
  
  const metadata = {
    type: 'interview-question',
    id: id || sanitizedTitle,
    category,
    sub_categories: subCategories || [],
    difficulty,
    'sr-due': new Date().toISOString().split('T')[0], // Due today by default
    'sr-interval': 1,
    'sr-factor': 2.5,
    'sr-reps': 0
  };
  
  const body = `\n# ${title}\n\n### Question\n${question || title}\n\n### Resume Context\n${resumeContext}\n\n### User Answer\n<!-- WRITE YOUR ANSWER BELOW THIS LINE -->\n\n\n### AI Feedback & Evaluation\n*(Submit your answer to get instant detailed evaluation)*\n`;
  
  saveMarkdownFile(filePath, metadata, body);
  return {
    id: metadata.id,
    title,
    filename: fileName,
    metadata,
    body,
    answer: '',
    feedback: '',
    filePath
  };
}

/**
 * Helper to ensure the Targets directory exists in the vault
 */
function ensureTargetsDir(vaultPath) {
  const tDir = path.join(vaultPath, 'PrepLoop', 'Targets');
  if (!fs.existsSync(tDir)) {
    fs.mkdirSync(tDir, { recursive: true });
  }
  return tDir;
}

/**
 * Load all target/reference documents from the vault
 */
export function loadAllTargets() {
  const config = getConfig();
  const tDir = ensureTargetsDir(config.vaultPath);
  
  const files = fs.readdirSync(tDir);
  const targets = [];
  
  for (const file of files) {
    if (file.endsWith('.md') || file.endsWith('.txt')) {
      const filePath = path.join(tDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        targets.push({
          filename: file,
          title: file.replace(/\.(md|txt)$/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          content: content,
          filePath
        });
      } catch (err) {
        console.error('Error reading target file:', file, err);
      }
    }
  }
  return targets;
}

/**
 * Save/Create a target document
 */
export function saveTargetFile(filename, content) {
  const config = getConfig();
  const tDir = ensureTargetsDir(config.vaultPath);
  
  // Sanitize filename
  let cleanName = filename
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, '')
    .replace(/\s+/g, '-');
  if (!cleanName.endsWith('.md') && !cleanName.endsWith('.txt')) {
    cleanName += '.md';
  }
  
  const filePath = path.join(tDir, cleanName);
  fs.writeFileSync(filePath, content, 'utf8');
  return {
    filename: cleanName,
    title: cleanName.replace(/\.(md|txt)$/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    content
  };
}

/**
 * Delete a target document
 */
export function deleteTargetFile(filename) {
  const config = getConfig();
  const tDir = ensureTargetsDir(config.vaultPath);
  const filePath = path.join(tDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

