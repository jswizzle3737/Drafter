import type { DraftIntent, PageContext } from './types.js';

export type DetectedPageKind =
  | 'job'
  | 'email'
  | 'article'
  | 'work_tool'
  | 'webpage';

export interface DraftSuggestion {
  id: string;
  label: string;
  description: string;
  intent: DraftIntent;
  instruction: string;
  voiceHint: string;
}

export interface PageAnalysis {
  pageKind: DetectedPageKind;
  pageBadge: string;
  summaryLine: string;
  suggestions: DraftSuggestion[];
}

function cleanTitle(context: PageContext): string {
  const raw = (context.subject || context.title || context.hostname || 'this page').trim();
  return raw.replace(/\s+/g, ' ').slice(0, 90);
}

export function analyzePageForDraftSuggestions(
  context: PageContext
): PageAnalysis {
  const title = cleanTitle(context);
  const urlLower = (context.url || '').toLowerCase();
  const hostLower = (context.hostname || '').toLowerCase();
  const textLower = `${context.title} ${context.subject} ${context.threadText}`.toLowerCase();

  const hasContent = Boolean(
    context.subject.trim() ||
      context.title.trim() ||
      context.threadText.trim() ||
      context.url.trim()
  );

  if (!hasContent) {
    return {
      pageKind: 'webpage',
      pageBadge: 'No Page Captured',
      summaryLine:
        'Open any webpage, job posting, article, or email and click Read Page to get tailored document offers.',
      suggestions: [],
    };
  }

  // 1. Job Posting / Career Page
  const isJobPage =
    /greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|wellfound\.com|indeed\.com|glassdoor\.com|linkedin\.com\/jobs|workable\.com|icims\.com|smartrecruiters\.com/.test(
      urlLower
    ) ||
    /\b(job description|responsibilities|qualifications|apply for this job|apply now|what you'll do|minimum qualifications|preferred qualifications|years of experience|compensation|benefits|hiring manager)\b/i.test(
      textLower
    );

  if (isJobPage) {
    return {
      pageKind: 'job',
      pageBadge: 'Job Posting Detected',
      summaryLine: `Read "${title}" — ready to draft application materials tailored to this role.`,
      suggestions: [
        {
          id: 'job-cover-letter',
          label: 'Cover Letter for This Role',
          description: 'Tailored cover letter connecting your background to the key requirements on this page.',
          intent: 'Job Application / Cover Letter',
          instruction: `Write a tailored, human-sounding cover letter for "${title}" addressing the core responsibilities and qualifications described on this page.`,
          voiceHint:
            'Confident, achievement-focused voice for job applications and career outreach',
        },
        {
          id: 'job-recruiter-note',
          label: 'Hiring Manager / Recruiter Intro',
          description: 'Short, punchy outreach note to stand out with a recruiter or hiring manager.',
          intent: 'Cold Outreach',
          instruction: `Draft a concise outreach message to the hiring manager or recruiter for "${title}" highlighting why I'm a strong fit based on the role details on this page.`,
          voiceHint:
            'Conversational and human — zero AI clichés or robotic filler',
        },
        {
          id: 'job-app-answers',
          label: 'Application Question / Pitch',
          description: 'Draft a clear "Why this company & role?" response grounded in the page details.',
          intent: 'Job Application / Cover Letter',
          instruction: `Draft a compelling answer to "Why are you interested in this role and team?" tailored specifically to "${title}".`,
          voiceHint:
            'Confident, achievement-focused voice for job applications and career outreach',
        },
      ],
    };
  }

  // 2. Email / Webmail Thread
  const isEmailPage =
    context.kind === 'email' ||
    /mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com|proton\.me/.test(
      hostLower
    );

  if (isEmailPage) {
    return {
      pageKind: 'email',
      pageBadge: 'Email Thread Detected',
      summaryLine: `Read email "${title}"${context.recipient ? ` (${context.recipient})` : ''} — choose how you'd like to respond.`,
      suggestions: [
        {
          id: 'email-reply',
          label: 'Reply to This Email',
          description: 'Clear, direct reply addressing the points and questions in the thread.',
          intent: 'Email Reply',
          instruction: `Draft a clear, natural reply to "${title}" addressing the key points and proposing concrete next steps.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
        {
          id: 'email-followup',
          label: 'Follow-Up / Check-In',
          description: 'Polite, crisp follow-up to keep momentum moving.',
          intent: 'Follow-Up',
          instruction: `Draft a concise follow-up regarding "${title}" summarizing where things stand and confirming next steps.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
        {
          id: 'email-decline',
          label: 'Decline Politely / Pushback',
          description: 'Respectful boundary-setting or alternative proposal.',
          intent: 'Decline Politely',
          instruction: `Draft a polite, clear response to "${title}" declining the request or proposing a practical alternative.`,
          voiceHint:
            'Conversational and human — zero AI clichés or robotic filler',
        },
        {
          id: 'email-team-summary',
          label: 'Summarize for Team / Slack',
          description: 'Turn this email thread into a quick internal update.',
          intent: 'Work Update / Slack',
          instruction: `Summarize the key takeaways, decisions, and action items from "${title}" as a concise team update.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
      ],
    };
  }

  // 3. Work Tool / Issue / Project Spec
  const isWorkTool =
    /github\.com|gitlab\.com|linear\.app|atlassian\.net|jira|asana\.com|trello\.com|notion\.so|figma\.com|slack\.com/.test(
      urlLower
    ) ||
    /\b(pull request|issue|sprint|milestone|roadmap|ticket|acceptance criteria|project brief|prd|spec)\b/i.test(
      textLower
    );

  if (isWorkTool) {
    return {
      pageKind: 'work_tool',
      pageBadge: 'Work / Project Page Detected',
      summaryLine: `Read "${title}" — ready to draft updates, handoffs, or follow-ups from this page.`,
      suggestions: [
        {
          id: 'work-slack-update',
          label: 'Team / Slack Status Update',
          description: 'Crisp summary of status, blockers, and next steps from this page.',
          intent: 'Work Update / Slack',
          instruction: `Draft a concise team update based on "${title}" covering current status, key takeaways, and next steps.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
        {
          id: 'work-stakeholder-email',
          label: 'Stakeholder Summary Email',
          description: 'Turn this page into a clean email briefing for teammates or leadership.',
          intent: 'Email Reply',
          instruction: `Draft an email briefing summarizing "${title}" and outlining any decisions or sign-offs needed.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
        {
          id: 'work-followup',
          label: 'Comment / Follow-Up Note',
          description: 'Draft a thoughtful response or review comment for this item.',
          intent: 'Follow-Up',
          instruction: `Draft a clear, constructive comment or follow-up note for "${title}" based on the details on this page.`,
          voiceHint:
            'Conversational and human — zero AI clichés or robotic filler',
        },
      ],
    };
  }

  // 4. Article / Essay / Reading / Documentation
  const isArticle =
    /substack\.com|medium\.com|wikipedia\.org|arxiv\.org|nytimes\.com|wsj\.com|theverge\.com|techcrunch\.com|hbr\.org|paulgraham\.com|blog/.test(
      urlLower
    ) || context.threadText.length > 900;

  if (isArticle) {
    return {
      pageKind: 'article',
      pageBadge: 'Article / Reading Detected',
      summaryLine: `Read "${title}" — ready to draft an essay, summary, or shareable note from this page.`,
      suggestions: [
        {
          id: 'article-essay',
          label: 'Essay / Response Piece',
          description: 'Draft a thoughtful essay or reflection engaging with the ideas on this page.',
          intent: 'Essay / Long-Form',
          instruction: `Write a thoughtful essay or response piece engaging with the main arguments and examples in "${title}".`,
          voiceHint:
            'Reflective, narrative essay style with clear transitions and concrete examples',
        },
        {
          id: 'article-summary',
          label: 'Key Takeaways & Work Brief',
          description: 'Distill the main insights from this page into a crisp briefing.',
          intent: 'Work Update / Slack',
          instruction: `Summarize the core insights and practical takeaways from "${title}" in a clear, scannable format.`,
          voiceHint:
            'Warm, concise, and action-oriented for day-to-day work and Slack/email',
        },
        {
          id: 'article-share-email',
          label: 'Email Sharing This Article',
          description: 'Send this page to a colleague or friend with your commentary.',
          intent: 'Email Reply',
          instruction: `Draft a short, natural email sharing "${title}" and highlighting why it's worth reading.`,
          voiceHint:
            'Conversational and human — zero AI clichés or robotic filler',
        },
      ],
    };
  }

  // 5. General Webpage Fallback
  return {
    pageKind: 'webpage',
    pageBadge: 'Page Read & Ready',
    summaryLine: `Read "${title}" — choose a document to draft from this page.`,
    suggestions: [
      {
        id: 'page-summary',
        label: 'Summary & Takeaways',
        description: 'Summarize what this page is about and key next steps.',
        intent: 'Work Update / Slack',
        instruction: `Summarize the key information and takeaways from "${title}" in a clear, practical format.`,
        voiceHint:
          'Warm, concise, and action-oriented for day-to-day work and Slack/email',
      },
      {
        id: 'page-email',
        label: 'Email About This Page',
        description: 'Draft an email referencing or sharing details from this page.',
        intent: 'Email Reply',
        instruction: `Draft a clear email regarding "${title}" using the relevant details from this page.`,
        voiceHint:
          'Conversational and human — zero AI clichés or robotic filler',
      },
      {
        id: 'page-essay',
        label: 'Essay / Write-Up on Topic',
        description: 'Draft a longer-form piece or reflection inspired by this page.',
        intent: 'Essay / Long-Form',
        instruction: `Write a thoughtful piece exploring the topic of "${title}" grounded in the details from this page.`,
        voiceHint:
          'Reflective, narrative essay style with clear transitions and concrete examples',
      },
      {
        id: 'page-outreach',
        label: 'Outreach / Inquiry Note',
        description: 'Reach out to the person, team, or organization behind this page.',
        intent: 'Cold Outreach',
        instruction: `Draft a concise, personalized outreach message referencing "${title}".`,
        voiceHint:
          'Conversational and human — zero AI clichés or robotic filler',
      },
    ],
  };
}
