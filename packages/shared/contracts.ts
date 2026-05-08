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
  name: string;
  role: string;
  company: string;
  offers: [string, string, string];
  seeks: [string, string, string];
  consentAccepted: true;
  deleteAfter24h: boolean;
  icebreakerResponses: IcebreakerResponse[];
  whatsapp?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  headline?: string;
  fullName?: string;
  whatIOffer?: [string, string, string];
  whatISeek?: [string, string, string];
}

export interface OnboardingInput {
  provider: Provider;
  profile: Pick<
    UserProfile,
    "id" | "name" | "role" | "company" | "offers" | "seeks" | "icebreakerResponses"
  >;
  consentAccepted: true;
  deleteAfter24h: boolean;
  autoDeleteAfter24h?: boolean;
  whatIOffer?: [string, string, string];
  whatISeek?: [string, string, string];
}

export interface MatchCandidate {
  candidateUserId: string;
  name: string;
  role: string;
  company: string;
  compatibilityScore: number;
  compatibilityReasons: [string, string, string];
  revealStatus: RevealStatus;
  profile?: UserProfile;
  matchReason?: string;
  score?: number;
}

export interface Wave {
  waveId: string;
  eventId: string;
  createdAt: string;
  candidates: MatchCandidate[];
  id?: string;
  sentAtIso?: string;
}

export type MatchWave = Wave;

export type LikeAction = "like" | "pass";

export type MatchAction = LikeAction;

export interface MatchActionInput {
  waveId: string;
  targetUserId: string;
  action: LikeAction;
}

export interface LikeActionInput extends MatchActionInput {}

export type RevealStatus = "locked" | "unlocked";

export interface MutualMatch {
  userId: string;
  targetUserId: string;
  isMutual: boolean;
  revealStatus: RevealStatus;
  revealedChannels: ("whatsapp")[];
}

export interface IcebreakerResponse {
  questionId: string;
  answer: string;
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

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isTripleStringTuple = (
  value: unknown
): value is [string, string, string] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((item) => isNonEmptyString(item));

const isIcebreakerResponses = (value: unknown): value is IcebreakerResponse[] =>
  Array.isArray(value) &&
  value.length >= 3 &&
  value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      isNonEmptyString((entry as IcebreakerResponse).questionId) &&
      isNonEmptyString((entry as IcebreakerResponse).answer)
  );

const isRevealStatus = (value: unknown): value is RevealStatus =>
  value === "locked" || value === "unlocked";

const isLikeAction = (value: unknown): value is LikeAction =>
  value === "like" || value === "pass";

const isIsoDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UserProfile;
  return (
    isNonEmptyString(candidate.id) &&
    (isNonEmptyString(candidate.name) || isNonEmptyString(candidate.fullName)) &&
    isNonEmptyString(candidate.role) &&
    isNonEmptyString(candidate.company) &&
    (isTripleStringTuple(candidate.offers) || isTripleStringTuple(candidate.whatIOffer)) &&
    (isTripleStringTuple(candidate.seeks) || isTripleStringTuple(candidate.whatISeek)) &&
    candidate.consentAccepted === true &&
    typeof candidate.deleteAfter24h === "boolean" &&
    isIcebreakerResponses(candidate.icebreakerResponses)
  );
}

export function assertUserProfile(value: unknown): asserts value is UserProfile {
  if (!isUserProfile(value)) {
    throw new Error(
      "Invalid UserProfile: requires identity fields, consentAccepted=true, deleteAfter24h, exactly 3 offers, exactly 3 seeks, and at least 3 icebreaker responses."
    );
  }
}

export function isOnboardingInput(value: unknown): value is OnboardingInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as OnboardingInput;
  const offers = candidate.profile?.offers ?? candidate.whatIOffer;
  const seeks = candidate.profile?.seeks ?? candidate.whatISeek;
  const deleteAfter24h = candidate.deleteAfter24h ?? candidate.autoDeleteAfter24h;

  return (
    (candidate.provider === "google" || candidate.provider === "linkedin") &&
    candidate.consentAccepted === true &&
    typeof deleteAfter24h === "boolean" &&
    isTripleStringTuple(offers) &&
    isTripleStringTuple(seeks) &&
    isIcebreakerResponses(candidate.profile?.icebreakerResponses)
  );
}

export function assertOnboardingInput(
  value: unknown
): asserts value is OnboardingInput {
  if (!isOnboardingInput(value)) {
    throw new Error(
      "Invalid OnboardingInput: provider, consentAccepted=true, deleteAfter24h, exactly 3 offers/seeks, and minimum 3 icebreaker responses are required."
    );
  }
}

export function isMatchCandidate(value: unknown): value is MatchCandidate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as MatchCandidate;
  return (
    isNonEmptyString(candidate.candidateUserId) &&
    isNonEmptyString(candidate.name) &&
    isNonEmptyString(candidate.role) &&
    isNonEmptyString(candidate.company) &&
    typeof candidate.compatibilityScore === "number" &&
    candidate.compatibilityScore >= 0 &&
    candidate.compatibilityScore <= 1 &&
    Array.isArray(candidate.compatibilityReasons) &&
    candidate.compatibilityReasons.length === 3 &&
    candidate.compatibilityReasons.every((reason) => isNonEmptyString(reason)) &&
    isRevealStatus(candidate.revealStatus)
  );
}

export function assertMatchCandidate(
  value: unknown
): asserts value is MatchCandidate {
  if (!isMatchCandidate(value)) {
    throw new Error(
      "Invalid MatchCandidate: requires identity summary, score in [0,1], 3 compatibility reasons, and revealStatus."
    );
  }
}

export function isWave(value: unknown): value is Wave {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Wave;
  return (
    isNonEmptyString(candidate.waveId) &&
    isNonEmptyString(candidate.eventId) &&
    isIsoDateString(candidate.createdAt) &&
    Array.isArray(candidate.candidates) &&
    candidate.candidates.every((entry) => isMatchCandidate(entry))
  );
}

export function assertWave(value: unknown): asserts value is Wave {
  if (!isWave(value)) {
    throw new Error(
      "Invalid Wave: requires waveId, eventId, createdAt ISO timestamp, and valid candidates."
    );
  }
}

export function isLikeActionInput(value: unknown): value is LikeActionInput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as LikeActionInput;
  return (
    isNonEmptyString(candidate.waveId) &&
    isNonEmptyString(candidate.targetUserId) &&
    isLikeAction(candidate.action)
  );
}

export function assertLikeActionInput(
  value: unknown
): asserts value is LikeActionInput {
  if (!isLikeActionInput(value)) {
    throw new Error(
      "Invalid LikeActionInput: requires waveId, targetUserId, and action of like/pass."
    );
  }
}

export function isMutualMatch(value: unknown): value is MutualMatch {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as MutualMatch;
  return (
    isNonEmptyString(candidate.userId) &&
    isNonEmptyString(candidate.targetUserId) &&
    typeof candidate.isMutual === "boolean" &&
    isRevealStatus(candidate.revealStatus) &&
    Array.isArray(candidate.revealedChannels) &&
    candidate.revealedChannels.every((channel) => channel === "whatsapp")
  );
}

export function assertMutualMatch(value: unknown): asserts value is MutualMatch {
  if (!isMutualMatch(value)) {
    throw new Error(
      "Invalid MutualMatch: requires user ids, isMutual flag, revealStatus, and revealed WhatsApp channels."
    );
  }
}
