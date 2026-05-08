export type Provider = "google" | "linkedin";

export type UserRole = "attendee" | "owner";

export interface EventContext {
  eventId: string;
  eventName: string;
  startsAtIso: string;
  endsAtIso: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  headline: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  role: UserRole;
  whatIOffer: string[];
  whatISeek: string[];
}

export interface OnboardingInput {
  provider: Provider;
  consentAccepted: boolean;
  autoDeleteAfter24h: boolean;
  whatIOffer: [string, string, string];
  whatISeek: [string, string, string];
}

export interface MatchCandidate {
  profile: UserProfile;
  matchReason: string;
  score: number;
}

export interface MatchWave {
  id: string;
  eventId: string;
  sentAtIso: string;
  candidates: MatchCandidate[];
}

export type MatchAction = "like" | "pass";

export interface MatchActionInput {
  waveId: string;
  targetUserId: string;
  action: MatchAction;
}

export type ConnectionState =
  | "pending_their_like"
  | "pending_your_like"
  | "mutual_like_contact_unlocked";

export interface ConnectionRecord {
  userId: string;
  targetUserId: string;
  state: ConnectionState;
  revealedAtIso?: string;
}

export interface OwnerEventOverview {
  eventId: string;
  totalAttendees: number;
  onboardedUsers: number;
  mutualLikes: number;
  pendingMatches: number;
}
