import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "./auth";

// Same-origin: every /api/* call goes to the Next server, which rewrites it
// to the backend (see next.config.mjs). The browser never needs to know the
// backend's host/port, and the /api prefix is stripped by the rewrite.
// Node test runners can't resolve relative URLs, so they get an explicit
// origin (same-origin semantics are what's under test, not the host).
const BASE_URL =
  typeof window === "undefined" || process.env.NODE_ENV === "test"
    ? "http://localhost:3000"
    : "";

/**
 * Attach the in-memory access token to every request, and on a 401 refresh
 * the session and replay the request once.
 *
 * Request bodies are one-shot streams: they must be cloned BEFORE the
 * original request is sent, or the replay of a POST/PUT goes out with an
 * empty body (which is how class creation used to fail after a reload).
 */
const replayable = new WeakMap<Request, Request>();

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    replayable.set(request, request.clone());
    const token = getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ response, request }) {
    if (response.status !== 401) return response;

    // Try a silent refresh and replay the original request once.
    const fresh = await refreshAccessToken();
    if (!fresh) return response;

    const retried = replayable.get(request) ?? request.clone();
    retried.headers.set("Authorization", `Bearer ${fresh}`);
    return fetch(retried);
  },
};

// Late-bound fetch so test stubs of global.fetch are honoured (openapi-fetch
// would otherwise capture the real fetch at module-import time).
export const apiClient = createClient<paths>({
  baseUrl: BASE_URL,
  fetch: (request) => globalThis.fetch(request),
});
apiClient.use(authMiddleware);

/** Login helper — stores the access token and returns the account info
 * (the caller must route by the REAL role, never the stale persona cookie). */
export async function login(
  email: string,
  password: string
): Promise<{ account_id: string; role: string }> {
  const { data, error } = await apiClient.POST("/api/auth/login", {
    body: { email, password },
  });
  if (error) throw new Error("Login failed");
  setAccessToken(data.access_token);
  return { account_id: data.account_id, role: data.role };
}

/** Register a new adult account (parent or teacher). */
export async function register(
  email: string,
  password: string,
  role: "parent" | "teacher" = "parent"
): Promise<void> {
  const { error, response } = await apiClient.POST("/api/auth/register", {
    body: { email, password, role },
  });
  if (response.status === 409) {
    const e = new Error("email_exists");
    (e as Error & { code: string }).code = "email_exists";
    throw e;
  }
  if (error) throw new Error("Registration failed");
}

/** Create a child profile (unauthenticated — kid self-signup). */
export async function createChild(data: {
  nickname: string;
  avatar_id: string;
  birth_year: number;
  parent_email: string;
  /** The four digits they sign back in with; a kid signing up alone always sets one. */
  login_pin?: string;
}): Promise<{ id: string; access_token: string }> {
  const { data: res, error } = await apiClient.POST("/api/children", {
    body: data,
  });
  if (error || !res) throw new Error("Could not create profile");
  setAccessToken(res.access_token);
  return res;
}

/**
 * Sign a child back in on another device: their parent's email, their name and
 * their PIN. A child never has a password, so this is their way in, next to the
 * class code a student uses at school.
 */
export async function childLogin(
  parentEmail: string,
  nickname: string,
  pin: string,
): Promise<{ child_id: string; nickname: string; access_token: string }> {
  const { data, error } = await apiClient.POST("/api/children/login", {
    body: { parent_email: parentEmail, nickname, pin },
  });
  if (error || !data) throw new Error("Wrong email, name, or PIN");
  setAccessToken(data.access_token);
  return data;
}

/** Give a child a new PIN when they have forgotten it. Returns it once. */
export async function resetChildPin(
  childId: string,
): Promise<{ child_id: string; login_pin: string }> {
  const { data, error } = await apiClient.POST("/api/parent/children/{id}/reset-pin", {
    params: { path: { id: childId } },
  });
  if (error || !data) throw new Error("Could not make a new PIN");
  return data;
}

/**
 * Add a child from a signed-in parent's session. Same endpoint as
 * `createChild`, but deliberately does NOT adopt the returned kid token: the
 * parent keeps their own session (the backend also skips the kid refresh
 * cookie for authenticated adults). The parent's email is resolved server-side
 * from their token, so `parent_email` is just the consent-email destination.
 */
export async function addChild(data: {
  nickname: string;
  avatar_id: string;
  birth_year: number;
  parent_email: string;
}): Promise<{ id: string; access_token: string }> {
  const { data: res, error } = await apiClient.POST("/api/children", {
    body: data,
  });
  if (error || !res) throw new Error("Could not create profile");
  return res;
}

/**
 * The challenge the kid's teacher assigned to their class — their "current
 * mission". Null when the kid is in no class or the class has no assignment.
 */
export async function fetchClassMission(): Promise<{
  challenge_id: string;
  title: string;
} | null> {
  const { data, error } = await apiClient.GET("/api/me/class-mission");
  if (error) return null;
  return data ?? null;
}

/** Verify consent token (parent arrives from email link). */
export async function verifyConsent(token: string): Promise<void> {
  // The emailed consent token IS the grant credential (COPPA verifiable consent).
  const { error } = await apiClient.POST("/api/consents/{token}/grant", {
    params: { path: { token } },
  });
  if (error) throw new Error("Consent verification failed");
}

/** Create a class for a teacher account. */
export async function createClass(
  name: string
): Promise<{ id: string; class_code: string; name: string }> {
  const { data: res, error } = await apiClient.POST("/api/classes", {
    body: { name },
  });
  if (error || !res) throw new Error("Could not create class");
  return res;
}

// ── Teacher-managed class students (PIN login) ──────────────────────────────

export interface ClassStudent {
  child_id: string;
  nickname: string;
  avatar_id: string;
  has_login_pin: boolean;
}

/** Roster for the teacher's own class. */
export async function fetchClassStudents(): Promise<ClassStudent[]> {
  const { data, error } = await apiClient.GET("/api/teacher/class/students");
  if (error || !data) throw new Error("Failed to load students");
  return data;
}

/** Create a student; returns the one-time login PIN (shown once). */
export async function createStudent(body: {
  nickname: string;
  avatar_id: string;
  birth_year: number;
}): Promise<{ child_id: string; nickname: string; login_pin: string }> {
  const { data, error } = await apiClient.POST("/api/teacher/class/students", {
    body,
  });
  if (error || !data) throw new Error("Could not create student");
  return data;
}

/** Regenerate a student's login PIN (shown once). */
export async function resetStudentPin(
  childId: string
): Promise<{ child_id: string; login_pin: string }> {
  const { data, error } = await apiClient.POST(
    "/api/teacher/class/students/{id}/reset-pin",
    { params: { path: { id: childId } } }
  );
  if (error || !data) throw new Error("Could not reset PIN");
  return data;
}

export type ClassReport =
  paths["/api/teacher/class/report"]["get"]["responses"][200]["content"]["application/json"];
export type ClassReportStudent = ClassReport["students"][number];

/** The teacher's per-student report for one mission (default: assigned). */
export async function fetchClassReport(challengeId?: string): Promise<ClassReport> {
  const { data, error } = await apiClient.GET("/api/teacher/class/report", {
    params: { query: challengeId ? { challenge_id: challengeId } : {} },
  });
  if (error || !data) throw new Error("Failed to load class report");
  return data;
}

/**
 * Download the school-facing CSV for one mission. openapi-fetch is JSON-oriented,
 * so this uses a raw authed fetch (the access token lives in memory, not a
 * cookie); it refreshes once on a 401, mirroring the apiClient middleware.
 */
export async function fetchClassReportCsv(challengeId?: string): Promise<Blob> {
  const url = challengeId
    ? `/api/teacher/class/report.csv?challenge_id=${encodeURIComponent(challengeId)}`
    : "/api/teacher/class/report.csv";
  const run = (token: string | null) =>
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
  let res = await run(getAccessToken());
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await run(fresh);
  }
  if (!res.ok) throw new Error("Failed to export report");
  // Return the raw bytes (blob), NOT res.text() — text() strips the leading
  // UTF-8 BOM the server adds for spreadsheet/Persian compatibility.
  return res.blob();
}

/** Public: the pickable names for a class (nickname + avatar only). */
export async function fetchClassRoster(
  code: string
): Promise<{ child_id: string; nickname: string; avatar_id: string }[]> {
  const { data, error } = await apiClient.GET("/api/classes/{code}/roster", {
    params: { path: { code } },
  });
  if (error || !data) throw new Error("Failed to load class");
  return data;
}

/**
 * Public kid sign-in: class code + child + PIN. Adopts the returned kid token
 * (the server also sets the kid refresh cookie). The caller sets persona=kid.
 */
export async function classLogin(
  code: string,
  childId: string,
  pin: string
): Promise<{ child_id: string; nickname: string; access_token: string }> {
  const { data, error } = await apiClient.POST("/api/classes/{code}/login", {
    params: { path: { code } },
    body: { child_id: childId, pin },
  });
  if (error || !data) {
    const e = new Error("login_failed") as Error & { code?: string };
    e.code = "login_failed";
    throw e;
  }
  setAccessToken(data.access_token);
  return data;
}

// ── Explore ───────────────────────────────────────────────────────────────────

export async function fetchExplore(params?: {
  superpower_category?: string;
  age_mode?: string;
  page?: number;
  per_page?: number;
}) {
  const { data, error } = await apiClient.GET("/api/explore", {
    params: { query: params },
  });
  if (error) throw new Error("Failed to load explore");
  return data;
}

export async function fetchExploreVideo(id: string) {
  const { data, error } = await apiClient.GET("/api/explore/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error("Failed to load video");
  return data;
}

export async function recordVideoView(videoId: string) {
  const { data, error } = await apiClient.POST("/api/progress/video-view", {
    body: { video_id: videoId },
  });
  if (error) throw new Error("Failed to record video view");
  return data;
}

// ── Library ───────────────────────────────────────────────────────────────────

export async function fetchStudios() {
  const { data, error } = await apiClient.GET("/api/library/studios");
  if (error) throw new Error("Failed to load studios");
  return data;
}

export async function fetchQuickMakes(params?: {
  studio?: string;
  page?: number;
  per_page?: number;
}) {
  const { data, error } = await apiClient.GET("/api/library/quick-makes", {
    params: { query: params },
  });
  if (error) throw new Error("Failed to load quick makes");
  return data;
}

export async function fetchCourse(id: string) {
  const { data, error } = await apiClient.GET("/api/courses/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error("Failed to load course");
  return data;
}

export async function fetchMe() {
  const { data, error } = await apiClient.GET("/api/me");
  if (error) throw new Error("Failed to load account");
  return data;
}

export async function fetchEmailPreferences() {
  const { data, error } = await apiClient.GET("/api/account/email-preferences");
  if (error) throw new Error("Failed to load email preferences");
  return data;
}

export async function updateEmailPreferences(prefs: {
  marketing: boolean;
  new_content: boolean;
  activity_reports: boolean;
}) {
  const { data, error } = await apiClient.PUT("/api/account/email-preferences", {
    body: prefs,
  });
  if (error) throw new Error("Failed to update email preferences");
  return data;
}

export async function fetchCourses() {
  const { data, error } = await apiClient.GET("/api/library/courses");
  if (error) throw new Error("Failed to load courses");
  return data;
}

export async function fetchCreator(id: string) {
  const { data, error } = await apiClient.GET("/api/creators/{id}", {
    params: { path: { id } },
  });
  if (error) throw new Error("Failed to load creator");
  return data;
}

export async function recordLessonComplete(lessonId: string) {
  const { data, error } = await apiClient.POST("/api/progress/lesson-complete", {
    body: { lesson_id: lessonId },
  });
  if (error) throw new Error("Failed to record lesson complete");
  return data;
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function fetchProgressSummary() {
  const { data, error } = await apiClient.GET("/api/me/progress");
  if (error) throw new Error("Failed to load progress");
  return data;
}

/** +5 XP, once per mission, for defining its problem with the 5W1H questions. */
export async function claimDefineBonus(challengeId: string) {
  const { data, error } = await apiClient.POST("/api/challenges/{id}/define-bonus", {
    params: { path: { id: challengeId } },
  });
  if (error) throw new Error("Failed to claim the bonus");
  return data;
}

/** +10 XP, once per mission, for solving the problem with a first sketched idea. */
export async function claimSketchBonus(challengeId: string) {
  const { data, error } = await apiClient.POST("/api/challenges/{id}/sketch-bonus", {
    params: { path: { id: challengeId } },
  });
  if (error) throw new Error("Failed to claim the bonus");
  return data;
}

export async function fetchKidProgress() {
  const { data, error } = await apiClient.GET("/api/me/progress");
  if (error) throw new Error("Failed to load progress");
  return data;
}

export async function fetchMyProjects() {
  const { data, error } = await apiClient.GET("/api/me/projects");
  if (error) throw new Error("Failed to load projects");
  return data;
}

// ── Challenges ────────────────────────────────────────────────────────────────

/** `lang` is the UI locale; the mission comes back translated when it can be. */
export async function fetchChallenge(id: string, lang?: string) {
  const { data, error } = await apiClient.GET("/api/challenges/{id}", {
    params: { path: { id }, query: lang ? { lang } : {} },
  });
  if (error) throw new Error("Failed to load challenge");
  return data;
}

export async function startAttempt(challengeId: string) {
  const { data, error } = await apiClient.POST("/api/challenges/{id}/attempts", {
    params: { path: { id: challengeId } },
  });
  if (error) throw new Error("Failed to start attempt");
  return data;
}

export async function advanceStep(attemptId: string, step: number) {
  const { data, error } = await apiClient.PATCH("/api/attempts/{id}/step", {
    params: { path: { id: attemptId } },
    body: { step },
  });
  if (error) throw new Error("Failed to advance step");
  return data;
}

/**
 * Ask the scoped mission helper about the current step. Only the typed
 * question leaves the browser — the server owns the model key, moderation,
 * logging, and all gating. Throws Errors with a `code` of
 * 'rate_limited' | 'not_allowed' | 'unavailable' for UI-specific messages.
 */
export async function askMissionHelper(
  challengeId: string,
  step: number,
  question: string
): Promise<{ answer: string; blocked: boolean }> {
  const { data, error, response } = await apiClient.POST(
    "/api/challenges/{id}/steps/{step}/help",
    {
      params: { path: { id: challengeId, step } },
      body: { question },
    }
  );
  if (response.status === 429) {
    const e = new Error("rate_limited");
    (e as Error & { code: string }).code = "rate_limited";
    throw e;
  }
  if (response.status === 403 || response.status === 404) {
    const e = new Error("not_allowed");
    (e as Error & { code: string }).code = "not_allowed";
    throw e;
  }
  if (error || !data) {
    const e = new Error("unavailable");
    (e as Error & { code: string }).code = "unavailable";
    throw e;
  }
  return data;
}

export async function setChildHelperEnabled(childId: string, enabled: boolean) {
  const { data, error } = await apiClient.PUT("/api/parent/children/{id}/helper", {
    params: { path: { id: childId } },
    body: { enabled },
  });
  if (error) throw new Error("Failed to update helper toggle");
  return data;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(body: {
  title: string;
  what_i_made: string;
  what_i_used: string;
  what_was_hard: string;
  what_id_improve: string;
  challenge_id: string | null;
  step_type: "sketch" | "build";
}) {
  const { data, error } = await apiClient.POST("/api/projects", { body });
  if (error) throw new Error("Failed to create project");
  return data;
}

// ── Ideas Wall ────────────────────────────────────────────────────────────────

export async function fetchIdeas(
  challengeId: string,
  sort: "newest" | "most_remixed" = "newest"
) {
  const { data, error } = await apiClient.GET("/api/challenges/{id}/ideas", {
    params: { path: { id: challengeId }, query: { sort } },
  });
  if (error) throw new Error("Failed to load ideas");
  return data;
}

/** Returns the new idea id. Throws with code 'restricted' on 403. */
export async function submitIdea(
  challengeId: string,
  projectId: string,
  caption: string
) {
  const { data, error, response } = await apiClient.POST(
    "/api/challenges/{id}/ideas",
    {
      params: { path: { id: challengeId } },
      body: { project_id: projectId, caption },
    }
  );
  if (response.status === 403) {
    const e = new Error("restricted");
    (e as Error & { code: string }).code = "restricted";
    throw e;
  }
  if (error) throw new Error("Failed to submit idea");
  return data;
}

export async function reactToIdea(
  ideaId: string,
  reaction: "clap" | "star" | "lightbulb"
) {
  const { error } = await apiClient.POST("/api/ideas/{id}/react", {
    params: { path: { id: ideaId } },
    body: { reaction },
  });
  if (error) throw new Error("Failed to react");
}

export async function remixIdea(ideaId: string) {
  const { data, error, response } = await apiClient.POST(
    "/api/ideas/{id}/remix",
    { params: { path: { id: ideaId } } }
  );
  if (response.status === 403) {
    const e = new Error("restricted");
    (e as Error & { code: string }).code = "restricted";
    throw e;
  }
  if (error) throw new Error("Failed to remix");
  return data;
}

/** PATCH /api/projects/{id}/visibility. Throws with code 'restricted' on 403. */
export async function updateVisibility(
  projectId: string,
  visibility: "private" | "class" | "public"
) {
  const { data, error, response } = await apiClient.PATCH(
    "/api/projects/{id}/visibility",
    {
      params: { path: { id: projectId } },
      body: { visibility },
    }
  );
  if (response.status === 403) {
    const e = new Error("restricted");
    (e as Error & { code: string }).code = "restricted";
    throw e;
  }
  if (error) throw new Error("Failed to update visibility");
  return data;
}

// ── Parent ────────────────────────────────────────────────────────────────────

export async function fetchParentChildren() {
  const { data, error } = await apiClient.GET("/api/parent/children");
  if (error) throw new Error("Failed to load children");
  return data;
}

export async function fetchChildReport(childId: string) {
  const { data, error } = await apiClient.GET("/api/parent/children/{id}/report", {
    params: { path: { id: childId } },
  });
  if (error) throw new Error("Failed to load report");
  return data;
}

export async function setChildDisplayMode(
  childId: string,
  displayMode: "avatar_nickname" | "first_name" | "anonymous"
) {
  const { data, error } = await apiClient.PUT("/api/parent/children/{id}/display-mode", {
    params: { path: { id: childId } },
    body: { display_mode: displayMode },
  });
  if (error) throw new Error("Failed to update display mode");
  return data;
}

export async function fetchParentApprovals() {
  const { data, error } = await apiClient.GET("/api/parent/approvals");
  if (error) throw new Error("Failed to load approvals");
  return data;
}

export async function approveParentItem(id: string, kind: "share_post" | "premium_unlock") {
  const { data, error } = await apiClient.POST("/api/parent/approvals/{id}/approve", {
    params: { path: { id } },
    body: { kind },
  });
  if (error) throw new Error("Failed to approve");
  return data;
}

export async function dismissParentItem(id: string, kind: "share_post" | "premium_unlock") {
  const { data, error } = await apiClient.POST("/api/parent/approvals/{id}/dismiss", {
    params: { path: { id } },
    body: { kind },
  });
  if (error) throw new Error("Failed to dismiss");
  return data;
}

/** Kid asks their parent to unlock premium — queues a "Needs your OK" item. */
export async function requestPremiumUnlock() {
  const { data, error } = await apiClient.POST("/api/me/upgrade-request");
  if (error) throw new Error("Failed to send upgrade request");
  return data;
}

export async function grantConsent(childId: string, scope: "class" | "public" | "all") {
  const { error } = await apiClient.POST("/api/consents/grant", {
    body: { child_id: childId, scope },
  });
  if (error) throw new Error("Failed to grant consent");
}

export async function revokeConsent(childId: string, scope: "class" | "public" | "all") {
  const { error } = await apiClient.POST("/api/consents/revoke", {
    body: { child_id: childId, scope },
  });
  if (error) throw new Error("Failed to revoke consent");
}

export async function startCheckout(plan: "monthly" | "annual") {
  const { data, error } = await apiClient.POST("/billing/checkout", {
    body: { plan },
  });
  if (error) throw new Error("Failed to start checkout");
  return data;
}

export async function openBillingPortal() {
  const { data, error } = await apiClient.POST("/billing/portal");
  if (error) throw new Error("Failed to open billing portal");
  return data;
}

export async function fetchSubscription() {
  const { data, error } = await apiClient.GET("/billing/subscription");
  if (error) throw new Error("Failed to load subscription");
  return data;
}

// ── Teacher ───────────────────────────────────────────────────────────────────

export async function fetchTeacherClass() {
  const { data, error } = await apiClient.GET("/api/teacher/class");
  if (error) throw new Error("Failed to load class");
  return data;
}

export async function assignMission(challengeId: string) {
  const { error } = await apiClient.POST("/api/teacher/class/assign", {
    body: { challenge_id: challengeId },
  });
  if (error) throw new Error("Failed to assign mission");
}

export async function fetchClassGallery() {
  const { data, error } = await apiClient.GET("/api/teacher/class/gallery");
  if (error) throw new Error("Failed to load gallery");
  return data;
}

// ── Moderation ────────────────────────────────────────────────────────────────

export async function fetchModerationQueue(status?: "pending" | "approved" | "rejected") {
  const { data, error } = await apiClient.GET("/api/moderation/queue", {
    params: { query: status ? { status } : undefined },
  });
  if (error) throw new Error("Failed to load moderation queue");
  return data;
}

export async function approveItem(itemId: string) {
  const { error } = await apiClient.POST("/api/moderation/{id}/approve", {
    params: { path: { id: itemId } },
  });
  if (error) throw new Error("Failed to approve item");
}

export async function rejectItem(itemId: string, reason: string) {
  const { error } = await apiClient.POST("/api/moderation/{id}/reject", {
    params: { path: { id: itemId } },
    body: { reason },
  });
  if (error) throw new Error("Failed to reject item");
}

export async function fetchReports() {
  const { data, error } = await apiClient.GET("/api/reports");
  if (error) throw new Error("Failed to load reports");
  return data;
}

/** `lang` is the UI locale; missions come back translated when they can be. */
export async function fetchChallenges(lang?: string) {
  // The API pages at 20 by default; ask for its maximum page so every
  // mission (50 across two seasons) is listed.
  const { data, error } = await apiClient.GET("/api/challenges", {
    params: { query: { per_page: 100, ...(lang ? { lang } : {}) } },
  });
  if (error) throw new Error("Failed to load challenges");
  // The backend paginates ({items, total, …}); e2e route mocks may still
  // fulfil a bare array. Always hand consumers the array.
  return Array.isArray(data) ? data : (data?.items ?? []);
}
