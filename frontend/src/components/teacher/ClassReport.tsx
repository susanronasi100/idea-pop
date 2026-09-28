'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations, useFormatter } from 'next-intl';
import {
  fetchChallenges,
  fetchClassReport,
  fetchClassReportCsv,
  type ClassReport as Report,
  type ClassReportStudent,
} from '@/lib/api/client';
import { AVATARS } from '@/lib/avatars';

function avatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? '🧒';
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-[#D6F0C2] text-[#2E5F1E]',
  in_progress: 'bg-[#CDEBFA] text-[#17567D]',
  abandoned: 'bg-ink/10 text-ink/60',
  not_started: 'bg-ink/10 text-ink/50',
};

type MissionOption = { id: string; title: string; emoji?: string };

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'mission'
  );
}

export default function ClassReport() {
  const t = useTranslations('teacher_dashboard');
  const format = useFormatter();
  const [missions, setMissions] = useState<MissionOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printChild, setPrintChild] = useState<ClassReportStudent | null>(null);

  const locale = useLocale();

  useEffect(() => {
    fetchChallenges(locale)
      .then((cs) =>
        setMissions((cs ?? []).map((c) => ({ id: c.id, title: c.title, emoji: c.emoji }))),
      )
      .catch(() => {});
    // First load defaults to the class's assigned mission (server-resolved).
    fetchClassReport()
      .then((r) => {
        setReport(r);
        setSelectedId(r.summary.challenge_id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [locale]);

  async function loadMission(id: string) {
    setSelectedId(id);
    setLoading(true);
    setError(false);
    try {
      setReport(await fetchClassReport(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Print only the selected child's summary for the selected mission, then clear.
  useEffect(() => {
    if (!printChild) return;
    const done = () => {
      document.body.classList.remove('printing-parent-report');
      setPrintChild(null);
    };
    document.body.classList.add('printing-parent-report');
    window.addEventListener('afterprint', done, { once: true });
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printChild]);

  async function exportCsv() {
    if (exporting || !report) return;
    setExporting(true);
    try {
      const blob = await fetchClassReportCsv(report.summary.challenge_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-report-${slug(report.summary.challenge_title)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  }

  const statusLabel = (s: string) =>
    t(
      s === 'completed'
        ? 'status_completed'
        : s === 'in_progress'
          ? 'status_in_progress'
          : s === 'abandoned'
            ? 'status_abandoned'
            : 'status_not_started',
    );

  const fmtDate = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : t('never_active');

  return (
    <section data-testid="class-report" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold text-ink">{t('report_heading')}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="mission-picker" className="sr-only">
            {t('mission_label')}
          </label>
          <select
            id="mission-picker"
            data-testid="mission-picker"
            value={selectedId}
            onChange={(e) => loadMission(e.target.value)}
            disabled={missions.length === 0}
            className="rounded-pill border border-ink/20 bg-white px-4 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#1E7FB8]"
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji ? `${m.emoji} ` : ''}
                {m.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="export-csv-btn"
            onClick={exportCsv}
            disabled={exporting || !report || report.students.length === 0}
            className="rounded-pill border-2 border-[#2E5F4B]/60 bg-white px-5 py-2 font-display text-sm font-bold text-[#2E5F4B] transition-all hover:bg-[#F4FADD] active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5F4B] focus-visible:ring-offset-2"
          >
            {exporting ? t('exporting') : t('export_csv')}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-card bg-tint-blush p-4 font-body text-sm text-ink">
          {t('report_error')}
        </p>
      )}

      {loading && !report ? (
        <div className="h-24 animate-pulse rounded-card bg-white" />
      ) : report ? (
        <>
          {/* Mission summary */}
          <div
            data-testid="report-summary"
            className="grid grid-cols-2 gap-3 rounded-card bg-[#CDEBFA] p-4 sm:grid-cols-4"
          >
            <SummaryStat
              label={t('summary_completed')}
              value={`${format.number(report.summary.completed)} / ${format.number(report.summary.student_count)}`}
            />
            <SummaryStat
              label={t('summary_in_progress')}
              value={format.number(report.summary.in_progress)}
            />
            <SummaryStat
              label={t('summary_not_started')}
              value={format.number(report.summary.not_started)}
            />
            <SummaryStat
              label={t('summary_avg_step')}
              value={t('step_value', { step: report.summary.average_step_reached })}
            />
          </div>

          {report.students.length === 0 ? (
            <p className="rounded-card bg-white p-6 text-center font-body text-sm text-ink/50">
              {t('report_empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="font-display text-xs text-ink/60">
                    <th className="px-3 py-2">{t('col_name')}</th>
                    <th className="px-3 py-2">{t('col_status')}</th>
                    <th className="px-3 py-2">{t('col_step')}</th>
                    <th className="px-3 py-2">{t('col_xp')}</th>
                    <th className="px-3 py-2">{t('col_last_active')}</th>
                    <th className="px-3 py-2">{t('col_shared')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="font-body text-sm">
                  {report.students.map((s) => (
                    <tr key={s.child_id} data-testid="report-row" className="border-t border-ink/10">
                      <td className="px-3 py-2 font-semibold text-ink">
                        <span aria-hidden="true">{avatarEmoji(s.avatar_id)}</span> {s.nickname}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          data-testid="status-badge"
                          className={`rounded-pill px-3 py-0.5 font-display text-xs ${STATUS_STYLE[s.status] ?? STATUS_STYLE.not_started}`}
                        >
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink/80" dir="ltr">
                        {t('step_value', { step: s.current_step })}
                      </td>
                      <td className="px-3 py-2 text-ink/80" dir="ltr">
                        {format.number(s.xp)}
                      </td>
                      <td className="px-3 py-2 text-ink/60">{fmtDate(s.last_active)}</td>
                      <td className="px-3 py-2 text-ink/70">
                        {s.shared ? t('shared_yes') : t('shared_no')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          data-testid="parent-report-btn"
                          onClick={() => setPrintChild(s)}
                          className="font-body text-xs font-bold text-explore underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore"
                        >
                          {t('parent_report')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {/* Per-child parent printout — ONLY this child's data (see print CSS). */}
      {printChild && report && (
        <div className="parent-report-print" data-testid="parent-report-print">
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {t('print_title', { name: printChild.nickname })}
          </h1>
          <p style={{ color: '#555', marginBottom: '1.25rem' }}>{t('print_subtitle')}</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem' }}>
            <dt style={{ fontWeight: 700 }}>{t('print_mission_label')}</dt>
            <dd>{report.summary.challenge_title}</dd>
            <dt style={{ fontWeight: 700 }}>{t('print_status_label')}</dt>
            <dd>{statusLabel(printChild.status)}</dd>
            <dt style={{ fontWeight: 700 }}>{t('print_step_label')}</dt>
            <dd dir="ltr">{t('step_value', { step: printChild.current_step })}</dd>
            <dt style={{ fontWeight: 700 }}>{t('print_xp_label')}</dt>
            <dd dir="ltr">{format.number(printChild.xp)}</dd>
            <dt style={{ fontWeight: 700 }}>{t('print_shared_label')}</dt>
            <dd>{printChild.shared ? t('shared_yes') : t('shared_no')}</dd>
          </dl>
          <p style={{ marginTop: '2rem', color: '#888', fontSize: '0.85rem' }}>
            {t('print_generated')}
          </p>
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-2xl font-bold text-[#17567D]" dir="ltr">
        {value}
      </span>
      <span className="font-body text-xs text-ink/70">{label}</span>
    </div>
  );
}
