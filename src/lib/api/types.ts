// Contract types — mirrors the API Contract in the workspace CLAUDE.md. Do not redefine elsewhere.

export type ApiError = { code: string; message: string };

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
  meta: Record<string, unknown>;
};

/** A response that apiClient has already checked: error is null and data is present. */
export type ApiSuccess<T> = { data: T; error: null; meta: Record<string, unknown> };

export type Role = "admin" | "parent";

export type User = { id: string; email: string; role: Role };

/** Returned by POST /api/auth/login and POST /api/auth/refresh. */
export type AuthSession = { accessToken: string; user: User };

export type AgeBand = "1-2" | "3-5";
export type Mood = "playful" | "calm" | "lullaby";
export type LengthSec = 60 | 90 | 120;

export type Child = {
  id: string;
  displayName: string;
  phoneticName: string | null;
  ageBand: AgeBand;
  createdAt: string;
};

export type SongStatus =
  | "queued"
  | "writing"
  | "checking"
  | "composing"
  | "illustrating"
  | "mixing"
  | "pending_review"
  | "ready"
  | "rejected"
  | "failed";

export type Song = {
  id: string;
  childId: string | null;
  topic: string;
  mood: Mood;
  ageBand: AgeBand;
  lengthSec: LengthSec;
  status: SongStatus;
  title: string | null;
  lyrics: string[] | null;
  safety: { pass: boolean; reasons: string[] } | null;
  audioUrl: string | null; // stable API URL (/api/media/...), never an S3 URL
  imageUrl: string | null; // stable API URL
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  approvedAt: string | null;
  shared: boolean; // generic + ready + not removed from the catalog
};

export type SongSummary = Pick<
  Song,
  "id" | "childId" | "topic" | "mood" | "status" | "title" | "imageUrl" | "createdAt"
>;

export type LibrarySong = Pick<Song, "id" | "childId" | "title" | "mood" | "audioUrl" | "imageUrl" | "durationMs">;

/** POST /api/songs response. */
export type CreatedSong = Pick<Song, "id" | "status">;

export type RegenPart = "lyrics" | "music" | "image";

export type InviteStatus = "pending" | "used" | "expired" | "revoked";
export type Invite = { id: string; email: string; status: InviteStatus; createdAt: string; expiresAt: string };
/** POST /api/invites response: the raw link is only ever returned here. A failed email never rolls back the invite. */
export type CreatedInvite = Invite & { inviteUrl: string; emailStatus: "sent" | "failed" };

/** GET /api/catalog item. Never carries topic, creator or anything personal. */
export type CatalogSong = Pick<Song, "id" | "title" | "mood" | "ageBand" | "lyrics" | "audioUrl" | "imageUrl" | "durationMs"> & {
  inMyLibrary: boolean;
  mine: boolean;
};
