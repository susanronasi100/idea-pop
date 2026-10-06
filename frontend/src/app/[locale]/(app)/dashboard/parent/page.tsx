'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import {
  fetchParentChildren,
  fetchChildReport,
  resetChildPin,
  grantConsent,
  revokeConsent,
  fetchSubscription,
  startCheckout,
  openBillingPortal,
  fetchMe,
  fetchEmailPreferences,
  updateEmailPreferences,
  fetchParentApprovals,
  approveParentItem,
  dismissParentItem,
  setChildDisplayMode,
  setChildHelperEnabled,
} from '@/lib/api/client';
import { Link } from '@/i18n/routing';
import { AVATARS } from '@/lib/avatars';
import type { components } from '@/lib/api/schema';

type ParentChild = components['schemas']['ParentChild'];
type ChildReport = components['schemas']['ChildReport'];
type SubscriptionResponse = components['schemas']['SubscriptionResponse'];
type EmailPreferences = components['schemas']['EmailPreferences'];
type ParentApproval = components['schemas']['ParentApproval'];
type DisplayMode = ParentChild['display_mode'];

const DEFAULT_EMAIL_PREFS: EmailPreferences = {
  marketing: false,
  new_content: false,
  activity_reports: false,
};


// Parent-portal buttons, from the designer's "free plan" frame: a lime pill with deep
// green text, and a white pill with a deep green outline. Text is a shade deeper than
// the mockup's #18785A so it passes AA on lime. 48px tall, landing-page shadow.
const limeBtn =
  'inline-flex min-h-12 items-center justify-center rounded-pill bg-[#D1EF5A] px-7 font-body text-base font-extrabold text-[#145F48] shadow-[inset_0_0_0_1px_rgba(24,120,90,0.35),0_4px_4px_rgba(0,0,0,0.2)] transition-all hover:scale-[1.04] hover:brightness-105 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#145F48] focus-visible:ring-offset-2';
const outlineBtn =
  'inline-flex min-h-12 items-center justify-center rounded-pill border-2 border-[#18785A] bg-white px-7 font-body text-base font-extrabold text-[#145F48] shadow-[0_4px_4px_rgba(0,0,0,0.15)] transition-all hover:scale-[1.04] hover:bg-[#F3FFC2] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#145F48] focus-visible:ring-offset-2';
const card = 'rounded-[1rem] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]';

function avatarFor(id: string) {
  return AVATARS.find((a) => a.id === id) ?? null;
}

// ── Avatar bubble ──────────────────────────────────────────────────────────────

function AvatarBubble({ avatarId, size = 44 }: { avatarId: string; size?: number }) {
  const a = avatarFor(avatarId);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl ring-2 ring-white"
      style={{ width: size, height: size, backgroundColor: a?.bg ?? '#FBF7D5' }}
      aria-hidden="true"
    >
      {a?.img ? (
        <Image src={a.img} alt="" width={size} height={size} className="h-full w-full object-contain" />
      ) : (
        <span>{a?.emoji ?? '🧒'}</span>
      )}
    </span>
  );
}

// ── Weekly report modal (kept — golden-path test target) ───────────────────────

function WeeklyReportModal({
  childNickname,
  report,
  onClose,
}: {
  childNickname: string;
  report: ChildReport | null;
  onClose: () => void;
}) {
  const t = useTranslations('parent_dashboard');
  const format = useFormatter();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="weekly-report-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-card bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">{t('report_heading', { name: childNickname })}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="text-ink/40 hover:text-ink">
            ✕
          </button>
        </div>

        {report ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center" data-testid="report-stats">
              <div className="rounded-card bg-tint-lime py-3">
                <p className="font-display text-2xl font-bold text-ink">{format.number(report.explore_videos_watched)}</p>
                <p className="font-body text-xs text-ink/60">{t('report_videos')}</p>
              </div>
              <div className="rounded-card bg-tint-cream py-3">
                <p className="font-display text-2xl font-bold text-ink">{format.number(report.lessons_completed)}</p>
                <p className="font-body text-xs text-ink/60">{t('report_lessons')}</p>
              </div>
              <div className="rounded-card bg-tint-blue py-3">
                <p className="font-display text-2xl font-bold text-ink">{format.number(report.challenges_completed)}</p>
                <p className="font-body text-xs text-ink/60">{t('report_challenges')}</p>
              </div>
            </div>
            <p className="font-body text-sm text-ink/60">
              <span dir="ltr">{t('report_xp', { xp: report.xp_earned })}</span>
            </p>

            {report.projects.length > 0 && (
              <div>
                <p className="mb-2 font-display text-sm font-bold text-ink">{t('report_projects')}</p>
                <div className="flex flex-col gap-2">
                  {report.projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-card bg-tint-blue px-3 py-2"
                    >
                      <span className="font-body text-sm text-ink">{p.title}</span>
                      <span className="font-body text-xs text-ink/60">{p.visibility}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-32 animate-pulse rounded-card bg-ink/5" />
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ParentDashboardPage() {
  const t = useTranslations('parent_dashboard');
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [reports, setReports] = useState<Record<string, ChildReport>>({});
  const [sub, setSub] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportChild, setReportChild] = useState<ParentChild | null>(null);
  /* A new PIN, held only long enough for the parent to read it to their child. */
  const [newPin, setNewPin] = useState<{ id: string; pin: string } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [account, setAccount] = useState<{ email: string; display_name: string } | null>(null);

  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>(DEFAULT_EMAIL_PREFS);
  const [approvals, setApprovals] = useState<ParentApproval[]>([]);

  useEffect(() => {
    Promise.all([
      fetchParentChildren().catch(() => [] as ParentChild[]),
      fetchSubscription().catch(() => null),
    ]).then(async ([kids, subscription]) => {
      const list = (kids ?? []) as ParentChild[];
      setChildren(list);
      setSub(subscription as SubscriptionResponse | null);
      setLoading(false);
      // Fetch weekly reports for the inline "this week" summary.
      const entries = await Promise.all(
        list.map(async (c) => [c.id, await fetchChildReport(c.id).catch(() => null)] as const),
      );
      const map: Record<string, ChildReport> = {};
      for (const [id, r] of entries) if (r) map[id] = r as ChildReport;
      setReports(map);
    });
    fetchMe()
      .then((m) => setAccount(m as { email: string; display_name: string }))
      .catch(() => {});
    fetchEmailPreferences()
      .then((p) => setEmailPrefs(p as EmailPreferences))
      .catch(() => {});
    fetchParentApprovals()
      .then((a) => setApprovals((a ?? []) as ParentApproval[]))
      .catch(() => {});
  }, []);

  async function handleResolveApproval(item: ParentApproval, approve: boolean) {
    const previous = approvals;
    setApprovals((prev) => prev.filter((a) => a.id !== item.id)); // optimistic
    try {
      if (approve) await approveParentItem(item.id, item.kind);
      else await dismissParentItem(item.id, item.kind);
    } catch {
      setApprovals(previous); // revert on failure
    }
  }

  async function handleToggleHelper(child: ParentChild) {
    const next = !child.helper_enabled;
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, helper_enabled: next } : c)),
    );
    try {
      await setChildHelperEnabled(child.id, next);
    } catch {
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, helper_enabled: !next } : c)),
      );
    }
  }

  async function handleDisplayMode(child: ParentChild, mode: DisplayMode) {
    const previous = child.display_mode;
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, display_mode: mode } : c)),
    );
    try {
      await setChildDisplayMode(child.id, mode);
    } catch {
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, display_mode: previous } : c)),
      );
    }
  }

  async function handleEmailPref(key: keyof EmailPreferences, value: boolean) {
    const previous = emailPrefs;
    const next = { ...emailPrefs, [key]: value };
    setEmailPrefs(next); // optimistic
    try {
      await updateEmailPreferences(next);
    } catch {
      setEmailPrefs(previous); // revert on failure
    }
  }

  const greetingName =
    account?.display_name?.trim() || account?.email?.split('@')[0] || '';

  const isPremium = sub?.is_premium ?? false;

  async function handleViewReport(child: ParentChild) {
    setReportChild(child);
    if (!reports[child.id]) {
      const r = await fetchChildReport(child.id).catch(() => null);
      if (r) setReports((prev) => ({ ...prev, [child.id]: r as ChildReport }));
    }
  }

  /* A forgotten PIN: the server makes a new one and hands it back this once, so it can be read out to the child
     and then exists nowhere but in their head. */
  async function handleResetPin(child: ParentChild) {
    const res = await resetChildPin(child.id).catch(() => null);
    if (res) setNewPin({ id: child.id, pin: res.login_pin });
  }

  async function handleToggleClass(child: ParentChild) {
    const next = !child.class_sharing_enabled;
    try {
      if (next) await grantConsent(child.id, 'class');
      else await revokeConsent(child.id, 'class');
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, class_sharing_enabled: next } : c)),
      );
    } catch {
      /* revert silently */
    }
  }

  async function handleTogglePublic(child: ParentChild) {
    const next = !child.public_sharing_enabled;
    try {
      if (next) await grantConsent(child.id, 'public');
      else await revokeConsent(child.id, 'public');
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, public_sharing_enabled: next } : c)),
      );
    } catch {
      /* revert silently */
    }
  }

  async function handleCheckout(plan: 'monthly' | 'annual') {
    setBillingLoading(true);
    try {
      const result = await startCheckout(plan);
      if (result?.url) window.location.href = result.url;
    } finally {
      setBillingLoading(false);
    }
  }

  async function handlePortal() {
    setBillingLoading(true);
    try {
      const result = await openBillingPortal();
      if (result?.url) window.location.href = result.url;
    } finally {
      setBillingLoading(false);
    }
  }

  const pendingConsent = children.filter((c) => !c.consent_granted);

  return (
    <div data-testid="parent-dashboard" className="mx-auto flex max-w-4xl flex-col gap-7 px-4 py-6 md:px-8">
      {reportChild && (
        <WeeklyReportModal
          childNickname={reportChild.nickname}
          report={reports[reportChild.id] ?? null}
          onClose={() => setReportChild(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center gap-4">
        <span
          className="flex h-28 w-28 items-center justify-center rounded-full bg-[#F7EFE3] text-5xl ring-[6px] ring-[#EFE6D6]"
          aria-hidden="true"
        >
          🧑
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {greetingName ? t('greeting', { name: greetingName }) : t('welcome')}
          </h1>
          <p className="font-display text-lg text-ink">{t('portal_subtitle')}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* My account */}
        <section id="account" className={`flex flex-col gap-3 ${card} p-5 scroll-mt-4`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">{t('account_heading')}</h2>
            <Link href="/login" className="font-display text-sm text-[#18785A] hover:underline">
              {t('forgot_password')}
            </Link>
          </div>
          <p className="font-body text-sm font-semibold text-ink">
            {account?.email || t('account_email_fallback')}
          </p>

          <div className="mt-1 flex flex-col gap-3 border-t border-ink/10 pt-3">
            <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink/50">
              {t('email_settings')}
            </p>
            <EmailPref
              label={t('email_marketing_label')}
              hint={t('email_marketing_hint')}
              checked={emailPrefs.marketing}
              testid="email-pref-marketing"
              onChange={(v) => handleEmailPref('marketing', v)}
            />
            <EmailPref
              label={t('email_new_content_label')}
              hint={t('email_new_content_hint')}
              checked={emailPrefs.new_content}
              testid="email-pref-new-content"
              onChange={(v) => handleEmailPref('new_content', v)}
            />
            <EmailPref
              label={t('email_activity_label')}
              hint={isPremium ? t('email_activity_hint') : t('email_activity_hint_locked')}
              checked={isPremium && emailPrefs.activity_reports}
              disabled={!isPremium}
              testid="email-pref-activity-reports"
              onChange={(v) => handleEmailPref('activity_reports', v)}
            />
          </div>
        </section>

        {/* My Plan (billing) */}
        <section
          data-testid="billing-section"
          className={`flex flex-col gap-3 ${card} p-5`}
        >
          <h2 className="font-display text-lg font-bold text-ink">{t('billing_heading')}</h2>
          <div className="rounded-[1rem] border border-[#D1EF5A] bg-white p-4">
            {isPremium ? (
              <>
                <p className="font-display font-bold text-ink">{t('billing_active', { plan: sub?.plan ?? t('plan_default') })}</p>
                {sub?.current_period_end && (
                  <p className="mt-1 font-body text-sm text-ink/60">
                    {t('billing_renews', { date: new Date(sub.current_period_end).toLocaleDateString() })}
                  </p>
                )}
                <button
                  type="button"
                  data-testid="manage-billing-btn"
                  onClick={handlePortal}
                  disabled={billingLoading}
                  className={`mt-3 ${outlineBtn}`}
                >
                  {t('billing_manage')}
                </button>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-ink">{t('plan_free')}</p>
                <p className="mt-1 font-body text-sm text-ink/70">
                  {t('plan_free_desc')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="checkout-monthly-btn"
                    onClick={() => handleCheckout('monthly')}
                    disabled={billingLoading}
                    className={`flex-1 ${limeBtn}`}
                  >
                    {t('billing_monthly')}
                  </button>
                  <button
                    type="button"
                    data-testid="checkout-annual-btn"
                    onClick={() => handleCheckout('annual')}
                    disabled={billingLoading}
                    className={`flex-1 ${outlineBtn}`}
                  >
                    {t('billing_annual')}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* My kid(s) */}
      <section aria-label={t('children_heading')} className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold text-ink">{t('children_heading')}</h2>
        {loading ? (
          <div className="h-28 animate-pulse rounded-card bg-white" />
        ) : children.length === 0 ? (
          <p className="font-body text-sm text-ink/60">{t('no_children')}</p>
        ) : (
          children.map((child) => {
            const r = reports[child.id];
            return (
              <div
                key={child.id}
                data-testid="child-card"
                className="flex flex-col gap-2 rounded-[1rem] bg-[#EEFFA9] p-5"
              >
                <div className="flex items-center gap-3">
                  <AvatarBubble avatarId={child.avatar_id} />
                  <div>
                    <p className="font-display text-base font-bold text-ink">
                      {child.nickname} · <span dir="ltr">{t('level_short', { level: child.level })}</span>
                    </p>
                    <p className="font-body text-xs text-ink/60">
                      <span dir="ltr">{t('xp_label', { xp: child.total_xp })}</span>
                    </p>
                  </div>
                </div>
                {r && (
                  <p className="font-body text-sm font-semibold text-ink/70">
                    {t('week_summary', {
                      videos: r.explore_videos_watched,
                      lessons: r.lessons_completed,
                      challenges: r.challenges_completed,
                    })}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    data-testid="view-report-btn"
                    onClick={() => handleViewReport(child)}
                    className="w-fit font-body text-sm font-bold text-[#145F48] underline-offset-2 hover:underline"
                  >
                    {t('view_report')}
                  </button>
                  {/* A child signs in with four digits, not a password. When they forget them, this is where a new
                      set comes from — shown once, here and nowhere else. */}
                  <button
                    type="button"
                    data-testid="reset-child-pin-btn"
                    onClick={() => handleResetPin(child)}
                    className="w-fit font-body text-sm font-bold text-[#145F48] underline-offset-2 hover:underline"
                  >
                    {t('new_pin')}
                  </button>
                </div>
                {newPin?.id === child.id && (
                  <p
                    role="status"
                    data-testid="new-child-pin"
                    className="rounded-lg bg-tint-lime px-4 py-3 font-body text-sm text-ink"
                  >
                    {t('new_pin_shown', { name: child.nickname })}{' '}
                    <span dir="ltr" className="font-display text-base font-bold tracking-[0.3em]">
                      {newPin.pin}
                    </span>
                  </p>
                )}
              </div>
            );
          })
        )}
        <Link
          href="/onboarding/kid"
          id="add-child"
          data-testid="add-child-btn"
          className="flex scroll-mt-4 flex-col items-center justify-center gap-0.5 rounded-[1rem] border-2 border-dashed border-[#C9E64A] py-3 font-body text-base font-semibold text-ink/80 transition-colors hover:bg-[#EEFFA9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#145F48]"
        >
          <span aria-hidden="true" className="text-3xl font-extrabold leading-none text-[#C9E64A]">+</span> {t('invite_child')}
        </Link>
      </section>

      {/* Needs your OK — pending consent + the real approval queue */}
      {!loading && (
        <section aria-label={t('needs_ok_heading')} className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold text-ink">{t('needs_ok_heading')}</h2>
          {pendingConsent.length === 0 && approvals.length === 0 ? (
            <div className={`${card} p-5 font-body text-base text-ink/70`}>
              ✅ {t('all_caught_up')}
            </div>
          ) : (
            <>
              {pendingConsent.map((child) => (
                <div
                  key={child.id}
                  className={`flex flex-col items-start justify-between gap-3 ${card} p-5 sm:flex-row sm:items-center`}
                >
                  <p className="font-body text-lg font-semibold text-ink">
                    🛡️ {t('approve_account', { name: child.nickname })}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTogglePublic(child)}
                    className={outlineBtn}
                  >
                    {t('review')}
                  </button>
                </div>
              ))}
              {approvals.map((item) => (
                <div
                  key={item.id}
                  data-testid="approval-item"
                  className={`flex flex-col items-start justify-between gap-3 ${card} p-5 sm:flex-row sm:items-center`}
                >
                  <p className="font-body text-lg font-semibold text-ink">
                    {item.kind === 'premium_unlock' ? (
                      <>🔓 {t('approval_premium', { name: item.child_nickname })}</>
                    ) : (
                      <>
                        📤{' '}
                        {t('approval_share', {
                          name: item.child_nickname,
                          hasTitle: item.title ? 'true' : 'false',
                          title: item.title ?? '',
                          place: item.requested_visibility ?? 'none',
                        })}
                      </>
                    )}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      data-testid="approval-approve-btn"
                      onClick={() => handleResolveApproval(item, true)}
                      className={limeBtn}
                    >
                      {t('approve')}
                    </button>
                    <button
                      type="button"
                      data-testid="approval-dismiss-btn"
                      onClick={() => handleResolveApproval(item, false)}
                      className={outlineBtn}
                    >
                      {t('dismiss')}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      )}

      {/* Safety */}
      {!loading && children.length > 0 && (
        <section aria-label={t('safety_heading')} className={`flex max-w-xl flex-col gap-3 ${card} p-5`}>
          <h2 className="font-display text-lg font-bold text-ink">{t('safety_heading')}</h2>
          {children.map((child) => (
            <div key={child.id} className="flex flex-col gap-3">
              {children.length > 1 && (
                <p className="font-body text-sm font-semibold text-ink/60">{child.nickname}</p>
              )}
              <SafetyToggle
                label={t('public_sharing_label')}
                checked={child.public_sharing_enabled}
                testid="toggle-public-sharing"
                ariaLabel={t('aria_public_sharing', { name: child.nickname })}
                onToggle={() => handleTogglePublic(child)}
              />
              <SafetyToggle
                label={t('class_sharing_label')}
                checked={child.class_sharing_enabled}
                testid="toggle-class-sharing"
                ariaLabel={t('aria_class_sharing', { name: child.nickname })}
                onToggle={() => handleToggleClass(child)}
              />
              <SafetyToggle
                label={`🤖 ${t('helper_label')}`}
                checked={child.helper_enabled}
                testid="toggle-mission-helper"
                ariaLabel={t('aria_helper', { name: child.nickname })}
                onToggle={() => handleToggleHelper(child)}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="font-body text-sm text-ink">{t('display_mode_label')}</span>
                <select
                  aria-label={t('aria_display_mode', { name: child.nickname })}
                  data-testid="display-mode-select"
                  value={child.display_mode}
                  onChange={(e) => handleDisplayMode(child, e.target.value as DisplayMode)}
                  className="rounded-pill bg-[#EEFFA9] px-3 py-1.5 font-body text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#145F48]"
                >
                  <option value="avatar_nickname">{t('display_avatar_nickname')}</option>
                  <option value="first_name">{t('display_first_name')}</option>
                  <option value="anonymous">{t('display_anonymous')}</option>
                </select>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ── Small controls ─────────────────────────────────────────────────────────────

function EmailPref({
  label,
  hint,
  checked,
  disabled = false,
  testid,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  testid?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testid}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#18785A]"
      />
      <span>
        <span className="block font-body text-sm font-semibold text-ink">{label}</span>
        <span className="block font-body text-xs text-ink/55">{hint}</span>
      </span>
    </label>
  );
}

function SafetyToggle({
  label,
  checked,
  testid,
  ariaLabel,
  onToggle,
}: {
  label: string;
  checked: boolean;
  testid: string;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-body text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        data-testid={testid}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#0F766E]' : 'bg-ink/25'
        }`}
      >
        <span
          className={`mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
