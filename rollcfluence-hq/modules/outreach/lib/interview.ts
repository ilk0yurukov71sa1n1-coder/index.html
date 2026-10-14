import type { Lead, PayAnswer, YesNo } from "./types.ts";

/**
 * The 5-question interview. Questions ask about past behaviour, not opinions about your idea,
 * so the answers are honest evidence. Edit the wording freely; keep them about real events.
 */
export const INTERVIEW_QUESTIONS = [
  "Walk me through the automations you run for clients today. Which ones matter most?",
  "Tell me about the last time one of them failed or did the wrong thing. How did you find out?",
  "What did that cost you: time to fix it, money, or the client's trust?",
  "What do you do today to catch problems before your client notices?",
  "If something showed you every week what broke, what failed silently and roughly what it cost, what would that be worth to you?",
] as const;

export const PROOF_QUESTION = "Do clients ever ask you to prove what your AI or automations actually did?";

export interface InterviewInput {
  answers: string[];
  proofAnswer: string;
  pain: YesNo | null;
  pay: PayAnswer | null;
}

/** Problems that stop the interview being saved. */
export function interviewProblems(i: InterviewInput): string[] {
  const p: string[] = [];
  const filled = i.answers.filter((a) => a.trim().length > 0).length;
  if (filled === 0) p.push("Write down at least one answer.");
  if (i.answers.length > INTERVIEW_QUESTIONS.length) p.push("Too many answers.");
  if (!i.pain) p.push('Decide "Pain confirmed": did they describe a real, costly problem?');
  return p;
}

/** Writes the interview back to the lead: stores answers, sets pain confirmed / would pay, marks them as replied. */
export function applyInterview(lead: Lead, i: InterviewInput, at: Date): Lead {
  return {
    ...lead,
    replied: true,
    repliedAt: lead.repliedAt ?? at.toISOString(),
    painConfirmed: i.pain,
    wouldPay: i.pay,
    interview: {
      at: at.toISOString(),
      answers: INTERVIEW_QUESTIONS.map((_, k) => (i.answers[k] ?? "").trim().slice(0, 4000)),
      proofAnswer: i.proofAnswer.trim().slice(0, 4000),
    },
  };
}
