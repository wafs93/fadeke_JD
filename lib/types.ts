export const STAGES = ["Saved", "Applied", "Replied", "Interview", "Offer", "Rejected"] as const;
export type Stage = (typeof STAGES)[number];

export type ScamLevel = "low" | "medium" | "high";

export interface Bullet {
  text: string;
  tags: string[];
}

export interface Profile {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  timezone: string;
  target_titles: string[];
  min_hourly_rate: number | null;
  summary: string;
  skills: string[];
  tools: string[];
  languages: string[];
}

export interface Experience {
  id: string;
  user_id: string;
  employer: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  location: string | null;
  remote: boolean;
  bullets: Bullet[];
  verified: boolean;
  sort_order: number;
}

export interface Education {
  id: string;
  user_id: string;
  school: string;
  degree: string;
  field: string;
  start_year: number | null;
  end_year: number | null;
}

export interface ScamFlag {
  id: string;
  label: string;
  weight: number;
  evidence?: string;
}

export interface Job {
  id: string;
  source: string;
  external_id: string;
  title: string;
  company: string;
  url: string;
  description: string;
  region_text: string;
  posted_at: string | null;
  salary_text: string | null;
  ng_eligible: boolean | null;
  ng_reason: string | null;
  /** Added by migration 002; absent until it has been run. */
  ng_evidence?: string | null;
  ng_method?: "rules" | "ai" | null;
  ng_checked_at?: string | null;
  scam_score: number;
  scam_flags: ScamFlag[];
  scam_level: ScamLevel;
  fetched_at: string;
}

export interface Match {
  id: string;
  user_id: string;
  job_id: string;
  score: number;
  reasons: string[];
  have: string[];
  gaps: string[];
  created_at: string;
}

export interface Kit {
  id: string;
  user_id: string;
  job_id: string;
  cv_text: string;
  cover_letter: string;
  answers_text: string;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  stage: Stage;
  applied_on: string | null;
  follow_up_on: string | null;
  notes: string;
  updated_at: string;
}

/** What a source adapter returns, before eligibility and scam checks. */
export interface RawJob {
  source: string;
  external_id: string;
  title: string;
  company: string;
  url: string;
  description: string;
  region_text: string;
  posted_at: string | null;
  salary_text: string | null;
}
