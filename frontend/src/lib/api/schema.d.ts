/**
 * Idea Pop API — TypeScript types
 * Auto-generated from openapi.json by openapi-typescript v7.
 * Run `npm run generate` in packages/api-types to refresh from the live server.
 *
 * DO NOT EDIT MANUALLY.
 */

export interface paths {
  "/api/auth/register": {
    post: operations["authRegister"];
  };
  "/api/auth/login": {
    post: operations["authLogin"];
  };
  "/api/auth/refresh": {
    post: operations["authRefresh"];
  };
  "/api/auth/logout": {
    post: operations["authLogout"];
  };
  "/api/auth/verify-email": {
    post: operations["authVerifyEmail"];
  };
  "/api/children": {
    post: operations["createChild"];
  };
  "/api/children/login": {
    post: operations["childLogin"];
  };
  "/api/children/{id}": {
    get: operations["getChild"];
  };
  "/api/consent/request": {
    post: {
      responses: {
        204: { content: never };
      };
    };
  };
  "/api/consents/{token}/grant": {
    post: {
      parameters: { path: { token: string } };
      responses: {
        200: { content: never };
      };
    };
  };
  "/api/classes": {
    post: operations["createClass"];
  };
  "/api/classes/{code}/roster": {
    get: {
      parameters: { path: { code: string } };
      responses: {
        200: {
          content: {
            "application/json": {
              child_id: string;
              nickname: string;
              avatar_id: string;
            }[];
          };
        };
      };
    };
  };
  "/api/classes/{code}/login": {
    post: {
      parameters: { path: { code: string } };
      requestBody: {
        content: {
          "application/json": { child_id: string; pin: string };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              child_id: string;
              nickname: string;
              access_token: string;
            };
          };
        };
      };
    };
  };
  "/api/teacher/class/students": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              child_id: string;
              nickname: string;
              avatar_id: string;
              has_login_pin: boolean;
            }[];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": {
            nickname: string;
            avatar_id: string;
            birth_year: number;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              child_id: string;
              nickname: string;
              login_pin: string;
            };
          };
        };
      };
    };
  };
  "/api/teacher/class/students/{id}/reset-pin": {
    post: {
      parameters: { path: { id: string } };
      responses: {
        200: {
          content: {
            "application/json": { child_id: string; login_pin: string };
          };
        };
      };
    };
  };
  "/api/teacher/class/report": {
    get: {
      parameters: { query?: { challenge_id?: string } };
      responses: {
        200: {
          content: {
            "application/json": {
              summary: {
                challenge_id: string;
                challenge_title: string;
                student_count: number;
                completed: number;
                in_progress: number;
                not_started: number;
                average_step_reached: number;
              };
              students: {
                child_id: string;
                nickname: string;
                avatar_id: string;
                status: string;
                current_step: number;
                xp: number;
                last_active: string | null;
                shared: boolean;
              }[];
            };
          };
        };
      };
    };
  };
  "/api/children/{id}/class": {
    post: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: { content: never };
      };
    };
  };
  "/api/explore": {
    get: {
      parameters: {
        query?: {
          superpower_category?: string;
          age_mode?: string;
          page?: number;
          per_page?: number;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["ExplorePageResponse"];
          };
        };
      };
    };
  };
  "/api/explore/{id}": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["ExploreVideo"];
          };
        };
      };
    };
  };
  "/api/library/studios": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["StudioCountResponse"][];
          };
        };
      };
    };
  };
  "/api/library/quick-makes": {
    get: {
      parameters: {
        query?: { studio?: string; page?: number; per_page?: number };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["QuickMakePageResponse"];
          };
        };
      };
    };
  };
  "/api/courses/{id}": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CourseDetailResponse"];
          };
        };
      };
    };
  };
  "/api/creators/{id}": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CreatorResponse"];
          };
        };
      };
    };
  };
  "/api/library/courses": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["CourseSummaryResponse"][];
          };
        };
      };
    };
  };
  "/api/progress/video-view": {
    post: {
      requestBody: {
        content: {
          "application/json": { video_id: string };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["XpAwardResponse"];
          };
        };
      };
    };
  };
  "/api/progress/lesson-complete": {
    post: {
      requestBody: {
        content: {
          "application/json": { lesson_id: string };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["XpAwardResponse"];
          };
        };
      };
    };
  };
  "/api/me": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["MeResponse"];
          };
        };
      };
    };
  };
  "/api/me/class-mission": {
    get: {
      responses: {
        200: {
          content: {
            // The kid's class-assigned challenge, or null when none.
            "application/json": {
              challenge_id: string;
              title: string;
            } | null;
          };
        };
      };
    };
  };
  "/api/account/email-preferences": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["EmailPreferences"];
          };
        };
      };
    };
    put: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["EmailPreferences"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["EmailPreferences"];
          };
        };
      };
    };
  };
  "/api/me/progress": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["KidProgressResponse"];
          };
        };
      };
    };
  };
  "/api/me/projects": {
    get: {
      responses: {
        200: {
          content: {
            // Backend returns ProjectListResponse { items: [...] }, not a bare array.
            "application/json": {
              items: components["schemas"]["KidProjectSummary"][];
            };
          };
        };
      };
    };
  };
  "/api/challenges": {
    get: {
      parameters: { query?: { lang?: string; per_page?: number; page?: number } };
      responses: {
        200: {
          content: {
            "application/json": {
              items: components["schemas"]["ChallengeDetail"][];
              total: number;
              page: number;
              per_page: number;
            };
          };
        };
      };
    };
  };
  "/api/challenges/{id}": {
    get: {
      parameters: { path: { id: string }; query?: { lang?: string } };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["ChallengeDetail"];
          };
        };
      };
    };
  };
  "/api/challenges/{id}/attempts": {
    post: {
      parameters: { path: { id: string } };
      responses: {
        // 200 = existing in-progress attempt resumed; 201 = freshly created.
        200: {
          content: {
            "application/json": components["schemas"]["StartAttemptResponse"];
          };
        };
        201: {
          content: {
            "application/json": components["schemas"]["StartAttemptResponse"];
          };
        };
      };
    };
  };
  "/api/attempts/{id}/step": {
    patch: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          "application/json": { step: number };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["AdvanceStepResponse"];
          };
        };
      };
    };
  };
  "/api/progress/summary": {
    get: operations["getProgressSummary"];
  };
  "/api/progress/xp": {
    get: operations["getProgressXp"];
  };
  "/api/progress/badges": {
    get: operations["getProgressBadges"];
  };
  "/api/projects": {
    get: {
      responses: {
        200: { content: { "application/json": unknown[] } };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["ProjectCreateRequest"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["ProjectResponse"];
          };
        };
      };
    };
  };
  "/api/projects/{id}": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { "application/json": unknown } };
      };
    };
  };
  "/api/projects/{id}/visibility": {
    patch: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          "application/json": components["schemas"]["UpdateVisibilityRequest"];
        };
      };
      responses: {
        200: { content: { "application/json": components["schemas"]["ProjectResponse"] } };
        403: { content: never };
      };
    };
  };
  "/api/challenges/{id}/ideas": {
    get: {
      parameters: {
        path: { id: string };
        query?: { sort?: "newest" | "most_remixed" };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["IdeaWallEntry"][];
          };
        };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          "application/json": components["schemas"]["SubmitIdeaRequest"];
        };
      };
      responses: {
        201: { content: { "application/json": { id: string } } };
        403: { content: never };
      };
    };
  };
  "/api/ideas/{id}/react": {
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          "application/json": components["schemas"]["ReactionRequest"];
        };
      };
      responses: {
        200: { content: { "application/json": unknown } };
      };
    };
  };
  "/api/ideas/{id}/remix": {
    post: {
      parameters: { path: { id: string } };
      responses: {
        201: { content: { "application/json": { attempt_id: string } } };
        403: { content: never };
      };
    };
  };
  "/api/ideas-wall": {
    get: {
      responses: {
        200: { content: { "application/json": unknown[] } };
      };
    };
  };
  "/api/ideas-wall/{id}/react": {
    post: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { "application/json": unknown } };
      };
    };
  };
  "/api/health-log": {
    get: {
      responses: {
        200: { content: { "application/json": unknown[] } };
      };
    };
    post: {
      responses: {
        201: { content: { "application/json": unknown } };
      };
    };
  };
  "/billing/checkout": {
    post: operations["billingCheckout"];
  };
  "/billing/portal": {
    post: operations["billingPortal"];
  };
  "/billing/subscription": {
    get: operations["getSubscription"];
  };
  "/billing/premium-check": {
    get: operations["getPremiumCheck"];
  };
  "/webhooks/stripe": {
    post: {
      responses: {
        200: { content: never };
      };
    };
  };
  "/api/parent/children/{id}/reset-pin": {
    post: operations["resetChildPin"];
  };
  "/api/parent/children": {
    get: {
      responses: {
        200: { content: { "application/json": components["schemas"]["ParentChild"][] } };
      };
    };
  };
  "/api/parent/children/{id}/report": {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { "application/json": components["schemas"]["ChildReport"] } };
      };
    };
  };
  "/api/challenges/{id}/steps/{step}/help": {
    post: {
      parameters: { path: { id: string; step: number } };
      requestBody: {
        content: { "application/json": { question: string } };
      };
      responses: {
        200: {
          content: { "application/json": { answer: string; blocked: boolean } };
        };
      };
    };
  };
  "/api/parent/children/{id}/helper": {
    put: {
      parameters: { path: { id: string } };
      requestBody: {
        content: { "application/json": { enabled: boolean } };
      };
      responses: {
        200: { content: { "application/json": { child_id: string; enabled: boolean } } };
      };
    };
  };
  "/api/parent/children/{id}/display-mode": {
    put: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          "application/json": { display_mode: "avatar_nickname" | "first_name" | "anonymous" };
        };
      };
      responses: {
        200: {
          content: { "application/json": { child_id: string; display_mode: string } };
        };
      };
    };
  };
  "/api/parent/approvals": {
    get: {
      responses: {
        200: { content: { "application/json": components["schemas"]["ParentApproval"][] } };
      };
    };
  };
  "/api/parent/approvals/{id}/approve": {
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: { "application/json": { kind: "share_post" | "premium_unlock" } };
      };
      responses: {
        200: { content: { "application/json": { id: string; status: string } } };
      };
    };
  };
  "/api/parent/approvals/{id}/dismiss": {
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: { "application/json": { kind: "share_post" | "premium_unlock" } };
      };
      responses: {
        200: { content: { "application/json": { id: string; status: string } } };
      };
    };
  };
  "/api/me/upgrade-request": {
    post: {
      responses: {
        200: { content: { "application/json": { status: string } } };
      };
    };
  };
  "/api/consents/grant": {
    post: {
      requestBody: {
        content: { "application/json": components["schemas"]["ConsentToggleRequest"] };
      };
      responses: { 200: { content: never } };
    };
  };
  "/api/consents/revoke": {
    post: {
      requestBody: {
        content: { "application/json": components["schemas"]["ConsentToggleRequest"] };
      };
      responses: { 200: { content: never } };
    };
  };
  "/api/teacher/class": {
    get: {
      responses: {
        200: { content: { "application/json": components["schemas"]["TeacherClass"] } };
      };
    };
  };
  "/api/teacher/class/assign": {
    post: {
      requestBody: {
        content: { "application/json": { challenge_id: string } };
      };
      responses: { 200: { content: never } };
    };
  };
  "/api/teacher/class/gallery": {
    get: {
      responses: {
        200: { content: { "application/json": components["schemas"]["ClassGalleryItem"][] } };
      };
    };
  };
  "/api/moderation/queue": {
    get: {
      parameters: { query?: { status?: "pending" | "approved" | "rejected" } };
      responses: {
        200: { content: { "application/json": components["schemas"]["ModerationItem"][] } };
      };
    };
  };
  "/api/moderation/{id}/approve": {
    post: {
      parameters: { path: { id: string } };
      responses: { 200: { content: never } };
    };
  };
  "/api/moderation/{id}/reject": {
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: { "application/json": { reason: string } };
      };
      responses: { 200: { content: never } };
    };
  };
  "/api/reports": {
    get: {
      responses: {
        200: { content: { "application/json": components["schemas"]["ContentReport"][] } };
      };
    };
  };
}

export interface components {
  schemas: {
    AuthLoginRequest: {
      email: string;
      password: string;
    };
    AuthLoginResponse: {
      account_id: string;
      role: string;
      email_verified: boolean;
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    AuthRegisterRequest: {
      email: string;
      password: string;
      role: "parent" | "reviewer" | "teacher";
    };
    CreateChildRequest: {
      nickname: string;
      avatar_id: string;
      birth_year: number;
      parent_email: string;
      /** The four digits the child signs back in with on another device. */
      login_pin?: string;
    };
    ChildLoginRequest: {
      parent_email: string;
      nickname: string;
      pin: string;
    };
    ChildLoginResponse: {
      child_id: string;
      nickname: string;
      access_token: string;
    };
    ResetChildPinResponse: {
      child_id: string;
      login_pin: string;
    };
    CreateChildResponse: {
      id: string;
      access_token: string;
    };
    CreateClassRequest: {
      name: string;
    };
    CreateClassResponse: {
      id: string;
      class_code: string;
      name: string;
    };
    ExploreVideo: {
      id: string;
      title: string;
      slug: string;
      superpower_category:
        | "masters_of_disguise"
        | "soft_engineers"
        | "speed_champions"
        | "master_builders";
      taxonomy: string;
      video_url: string;
      duration_s: number;
      design_secret: string;
      sticker_id: string;
      xp_reward: number;
      ai_generated: boolean;
      age_modes: ("young" | "older")[];
      created_at: string;
    };
    ExplorePageResponse: {
      items: components["schemas"]["ExploreVideo"][];
      total: number;
      page: number;
      per_page: number;
    };
    StudioCountResponse: {
      studio: string;
      quick_make_count: number;
      course_count: number;
    };
    QuickMakeResponse: {
      id: string;
      title: string;
      slug: string;
      studio: string;
      difficulty: number;
      time_minutes: number;
      materials: string[];
      mess_level: number;
      video_url: string;
      xp_reward: number;
      ai_generated: boolean;
      created_at: string;
    };
    QuickMakePageResponse: {
      items: components["schemas"]["QuickMakeResponse"][];
      total: number;
      page: number;
      per_page: number;
    };
    LessonResponse: {
      id: string;
      ordinal: number;
      title: string;
      video_url: string;
      duration_s: number;
      xp_reward: number;
    };
    CourseDetailResponse: {
      id: string;
      title: string;
      slug: string;
      studio: string;
      creator_id: string;
      summary: string;
      /** Format: int16 */
      difficulty: number;
      /** Format: int16 */
      age_min: number;
      materials: string[];
      /**
       * Format: int32
       * @description Own price in Toman for a special expert course sold one by one; null = included in Plus / Family.
       */
      price_toman?: number | null;
      created_at: string;
      lessons: components["schemas"]["LessonResponse"][];
    };
    CreatorResponse: {
      id: string;
      display_name: string;
      bio: string;
      studio: string;
      avatar_url: string;
      created_at: string;
    };
    MeResponse: {
      account_id: string;
      role: string;
      email: string;
      display_name: string;
    };
    EmailPreferences: {
      marketing: boolean;
      new_content: boolean;
      activity_reports: boolean;
    };
    CourseSummaryResponse: {
      id: string;
      title: string;
      slug: string;
      studio: string;
      creator_id: string;
      creator_name: string;
      /** Format: int16 */
      difficulty: number;
      /** Format: int16 */
      age_min: number;
      /**
       * Format: int32
       * @description Own price in Toman for a special expert course sold one by one; null = included in Plus / Family.
       */
      price_toman?: number | null;
      /** Format: int64 */
      lesson_count: number;
    };
    XpAwardResponse: {
      xp_earned: number;
      xp_total: number;
      level: number;
      rank: string;
      is_new: boolean;
      cycle_bonus_earned: boolean;
    };
    NatureClue: {
      emoji: string;
      title: string;
      description: string;
      image_url: string | null;
      explore_video_id: string | null;
      xp_reward: number;
    };
    ChallengeDetail: {
      id: string;
      title: string;
      slug: string;
      season: number;
      week_number: number;
      xp_reward: number;
      /** Raw 8-step payloads. The player reads the FLATTENED fields below —
       * never index into steps[] from UI code. */
      steps: unknown[];
      /** "Need a hint?" ladder for the Skill step; the LAST entry is the give-away. */
      skill_hints: string[];
      /** "Need a hint?" ladder for the Build & test step; the LAST entry is the give-away. */
      build_hints: string[];
      brief: string;
      emoji: string;
      completion_xp: number;
      design_secret: string;
      design_secret_story: string | null;
      /** The Sketch step's own prompt/guidance (empty string when absent). */
      sketch_prompt?: string;
      sketch_guidance?: string;
      nature_clues: components["schemas"]["NatureClue"][];
      skill_lesson_id: string | null;
      /** The Skill step's authored instructions text, if any. */
      skill_instructions?: string | null;
      related_explore_ids: string[];
      tools: {
        kind: "five_whys" | "scamper" | "mind_map" | "brainstorm" | "empathy_map" | "how_might_we" | "like_wish_what_if" | "nature_translator" | "design_spiral";
        age_mode: "young" | "older";
      }[];
      age_tier_variants: {
        age_tier: string;
        title_override?: string | null;
        summary: string;
      }[];
      related_video_ids: string[];
      /** True when this mission needs a family subscription to play. */
      is_premium: boolean;
      /** True when premium and the caller's family has no active subscription. */
      locked: boolean;
      /** The mission's story layer (Story Spine chapters, Popi's lines, the
       * per-step games, the sticker). Null for missions without a story. */
      story?: components["schemas"]["MissionStory"] | null;
      created_at: string;
    };
    // Mirrors the backend domain MissionStory (crates/domain/src/story.rs).
    MissionStory: {
      /** "How does nature…?" — heads the Nature clues step. */
      function_question: string;
      hero: { name: string; role: string; image: string | null; emoji: string };
      scene_image: string | null;
      /** Exactly 3: Once upon a time / Every day / Until one day. */
      opening: {
        beat: string;
        emoji: string;
        text: string;
        /** Full illustration; when present the Brief is a picture book. */
        image?: string | null;
        /** Label in the picture's top corner, e.g. "3 hours". */
        badge?: string | null;
        /** Where it happens, labelled in the picture's bottom corner. */
        place?: string | null;
        thought?: { big: string; small: string } | null;
      }[];
      card: { hero: string; place: string; problem: string; goal: string; rules: string; helpers: string };
      /** One per step in play order: brief, your_idea, nature_clues,
       * design_secret, skill, tool, sketch, build_and_test, celebrate_and_share. */
      chapters: { step: string; label: string; beat: string; title: string; line: string }[];
      guide: {
        brief: string;
        your_idea: string;
        nature_clues: string;
        design_secret: string;
        skill: string;
        sketch: string;
        build_and_test: string;
        retry_tip: string;
        ending: string;
      };
      quick_check: { question: string; options: string[]; answer: number; right: string; wrong: string };
      clue_cards: {
        name: string;
        emoji: string;
        image: string | null;
        tagline: string;
        trick: string;
        does: string;
        group: string;
      }[];
      match_groups: { key: string; label: string }[];
      predict: {
        prompt: string;
        choices: string[];
        items: { emoji: string; label: string; answer: number }[];
        explain: string;
      };
      lab: { title: string; predict: string; options: string[]; measure: string; higher_is_better: boolean };
      tool: {
        kind: "scamper" | "mind_map" | "five_whys" | "brainstorm" | "empathy_map" | "how_might_we" | "like_wish_what_if" | "nature_translator" | "design_spiral";
        name: string;
        intro: string;
        example_object: string;
        parts: { key: string; name: string; what: string; example: string; starter: string }[];
        locked: string[];
        badge: string;
      };
      sketch_checklist: string[];
      test: {
        measure: string;
        higher_is_better: boolean;
        check_question: string;
        check_options: string[];
        change_prompt: string;
      };
      reflection: { question: string; options: string[] };
      sticker: { name: string; emoji: string };
      /** 5W1H problem definition shown with Popi under the last opening picture. */
      define_problem?: {
        popi: string;
        title: string;
        question: string;
        hint: string;
        image: string | null;
        prompts: { key: string; label: string; question: string; example: string }[];
      } | null;
    };
    IdeaWallEntry: {
      id: string;
      challenge_id: string;
      author_nickname: string;
      author_avatar_id: string;
      project_photo_url: string | null;
      caption: string | null;
      clap_count: number;
      star_count: number;
      lightbulb_count: number;
      remix_count: number;
      created_at: string;
    };
    SubmitIdeaRequest: {
      project_id: string;
      caption: string;
    };
    ReactionRequest: {
      reaction: "clap" | "star" | "lightbulb";
    };
    UpdateVisibilityRequest: {
      visibility: "private" | "class" | "public";
    };
    // Mirrors the backend StartAttemptResponse — note `attempt_id`, not `id`
    // (the old hand-written shape drifted and silently broke step tracking).
    StartAttemptResponse: {
      attempt_id: string;
      challenge_id: string;
      current_step: number;
      status: string;
    };
    // Mirrors the backend AdvanceStepResponse (PATCH /attempts/{id}/step).
    AdvanceStepResponse: {
      attempt_id: string;
      current_step: number;
      status: string;
      xp_earned: number;
      cycle_bonus_earned: boolean;
    };
    ProjectCreateRequest: {
      title: string;
      what_i_made: string;
      what_i_used: string;
      what_was_hard: string;
      what_id_improve: string;
      challenge_id: string | null;
      step_type: "sketch" | "build";
    };
    ProjectResponse: {
      id: string;
      title: string;
      visibility: "private" | "class" | "public";
      created_at: string;
    };
    SubscriptionResponse: {
      status: string;
      plan: string | null;
      current_period_end: string | null;
      is_premium: boolean;
    };
    CheckoutRequest: {
      plan: "monthly" | "annual";
    };
    CheckoutResponse: {
      url: string;
    };
    ProgressSummary: {
      level: number;
      total_xp: number;
      rank: string;
    };
    // Mirrors the backend ProgressResponse (GET /api/me/progress). Level-progress
    // (into/remaining) is derived client-side from xp_total via the level curve.
    KidProgressResponse: {
      xp_total: number;
      level: number;
      rank: string;
      explore_count: number;
      learn_count: number;
      solve_count: number;
      medals: {
        explore: string | null;
        learn: string | null;
        solve: string | null;
      };
      creative_cycles_completed: number;
      badges: {
        badge_id: string;
        slug: string;
        name: string;
        icon_url: string;
        awarded_at: string;
      }[];
    };
    KidProjectSummary: {
      id: string;
      title: string;
      what_i_made: string;
      project_photo_url: string | null;
      visibility: "private" | "class" | "public";
      visibility_pending: boolean;
      created_at: string;
      challenge_title: string | null;
    };
    ParentChild: {
      id: string;
      nickname: string;
      avatar_id: string;
      birth_year: number;
      level: number;
      total_xp: number;
      consent_granted: boolean;
      class_sharing_enabled: boolean;
      public_sharing_enabled: boolean;
      display_mode: "avatar_nickname" | "first_name" | "anonymous";
      helper_enabled: boolean;
    };
    ParentApproval: {
      id: string;
      kind: "share_post" | "premium_unlock";
      child_id: string;
      child_nickname: string;
      title: string | null;
      requested_visibility: string | null;
      created_at: string;
    };
    ChildReport: {
      child_id: string;
      week_start: string;
      explore_videos_watched: number;
      lessons_completed: number;
      challenges_completed: number;
      xp_earned: number;
      projects: components["schemas"]["KidProjectSummary"][];
    };
    ConsentToggleRequest: {
      child_id: string;
      scope: "class" | "public" | "all";
    };
    TeacherClass: {
      id: string;
      name: string;
      class_code: string;
      student_count: number;
      assigned_challenge_id: string | null;
      assigned_challenge_title: string | null;
    };
    ClassGalleryItem: {
      id: string;
      student_nickname: string;
      student_avatar_id: string;
      project_title: string;
      project_photo_url: string | null;
      challenge_title: string;
      created_at: string;
    };
    ModerationItem: {
      id: string;
      type: "project" | "idea";
      content_id: string;
      content_title: string;
      content_photo_url: string | null;
      author_nickname: string;
      submitted_at: string;
      status: "pending" | "approved" | "rejected";
      rejection_reason: string | null;
    };
    ContentReport: {
      id: string;
      content_id: string;
      content_type: "project" | "idea" | "comment";
      reporter_id: string;
      reason: string;
      created_at: string;
      resolved: boolean;
    };
  };
}

export interface operations {
  authRegister: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["AuthRegisterRequest"];
      };
    };
    responses: {
      201: { content: never };
      422: { content: never };
    };
  };
  authLogin: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["AuthLoginRequest"];
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["AuthLoginResponse"];
        };
      };
      401: { content: never };
    };
  };
  authRefresh: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["AuthLoginResponse"];
        };
      };
    };
  };
  authLogout: {
    responses: {
      204: { content: never };
    };
  };
  authVerifyEmail: {
    responses: {
      200: { content: never };
    };
  };
  createChild: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateChildRequest"];
      };
    };
    responses: {
      201: {
        content: {
          "application/json": components["schemas"]["CreateChildResponse"];
        };
      };
    };
  };
  childLogin: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["ChildLoginRequest"];
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["ChildLoginResponse"];
        };
      };
    };
  };
  resetChildPin: {
    parameters: { path: { id: string } };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["ResetChildPinResponse"];
        };
      };
    };
  };
  createClass: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateClassRequest"];
      };
    };
    responses: {
      201: {
        content: {
          "application/json": components["schemas"]["CreateClassResponse"];
        };
      };
    };
  };
  getChild: {
    parameters: {
      path: { id: string };
    };
    responses: {
      200: { content: { "application/json": unknown } };
      404: { content: never };
    };
  };
  getProgressSummary: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["ProgressSummary"];
        };
      };
    };
  };
  getProgressXp: {
    responses: {
      200: {
        content: {
          "application/json": unknown[];
        };
      };
    };
  };
  getProgressBadges: {
    responses: {
      200: {
        content: {
          "application/json": unknown[];
        };
      };
    };
  };
  billingCheckout: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["CheckoutRequest"];
      };
    };
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["CheckoutResponse"];
        };
      };
    };
  };
  billingPortal: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["CheckoutResponse"];
        };
      };
    };
  };
  getSubscription: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SubscriptionResponse"];
        };
      };
    };
  };
  getPremiumCheck: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SubscriptionResponse"];
        };
      };
    };
  };
}
