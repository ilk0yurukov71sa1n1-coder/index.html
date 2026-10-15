export type Platform = "email" | "instagram" | "linkedin" | "x";
export type YesNo = "Y" | "N";
export type PayAnswer = "Y" | "N" | "Maybe";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  /** Profile link or @handle for Instagram / LinkedIn / X */
  handle: string | null;
  platform: Platform;
  company: string;
  whatTheyDo: string;
  /** Your personal opening line for this lead. Required before sending. */
  firstLine: string;
  notes: string;
  createdAt: string;
  /** First message (any channel) */
  dateMessaged: string | null;
  channelMessaged: Platform | null;
  followUpSentAt: string | null;
  followUpCancelled: boolean;
  replied: boolean;
  repliedAt: string | null;
  painConfirmed: YesNo | null;
  wouldPay: PayAnswer | null;
  doNotContact: boolean;
}

export type MessageKind = "first" | "followup" | "other";

export interface SentMessage {
  id: string;
  leadId: string;
  channel: Platform;
  kind: MessageKind;
  templateId: string;
  to: string;
  subject: string;
  body: string;
  /** RFC 5322 Message-ID of the sent email (email channel only) */
  messageId: string | null;
  sentAt: string;
  dryRun: boolean;
}

export interface Reply {
  id: string;
  leadId: string | null;
  from: string;
  subject: string;
  text: string;
  receivedAt: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  optOut: boolean;
}

export interface Settings {
  dryRun: boolean;
  /** Your own address: dry-run emails go here */
  ownAddress: string;
  senderName: string;
  businessName: string;
  dailyCap: number;
  /** Sofia local hours, sending allowed in [startHour, endHour) */
  startHour: number;
  endHour: number;
  minGapMinutes: number;
  followUpDays: number;
  pollMinutes: number;
  targets: { painConfirmed: number; wouldPay: number; minSent: number; days: number };
}

export const HARD_MAX_DAILY_CAP = 30;
export const TIME_ZONE = "Europe/Sofia";

export const DEFAULT_SETTINGS: Settings = {
  dryRun: true,
  ownAddress: "",
  senderName: "Ilko",
  businessName: "Rollcfluence",
  dailyCap: 10,
  startHour: 9,
  endHour: 19,
  minGapMinutes: 3,
  followUpDays: 3,
  pollMinutes: 2,
  targets: { painConfirmed: 5, wouldPay: 2, minSent: 40, days: 14 },
};

export interface Template {
  id: string;
  name: string;
  /** Which step this message belongs to */
  purpose: "first" | "followup" | "interview" | "offer" | "price" | "close";
  channel: "dm" | "email";
  subject: string;
  body: string;
}

export interface Store {
  version: 1;
  leads: Lead[];
  templates: Template[];
  sent: SentMessage[];
  replies: Reply[];
  suppressed: string[];
  settings: Settings;
}
