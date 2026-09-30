'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { fetchClassRoster, classLogin } from '@/lib/api/client';
import { setPersona } from '@/lib/auth/persona';
import { AVATARS } from '@/lib/avatars';
import { btnLime, btnGlassOnCard, tighten } from '@/components/ui/kit';

type RosterEntry = { child_id: string; nickname: string; avatar_id: string };
type Phase = 'code' | 'pick' | 'pin';

const CARD = '#2A2A2A';
/* The kit's two buttons, as everywhere else in signing up and logging in. */
const nextBtn = `${tighten(btnLime)} disabled:opacity-40 disabled:pointer-events-none focus-visible:ring-offset-[#2A2A2A]`;
const backBtn = `${tighten(btnGlassOnCard)} focus-visible:ring-offset-[#2A2A2A]`;
const darkInput =
  'w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-body text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#CDEB5A]';

function avatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? '🧒';
}

/* The three phases a student goes through with a class code: the code, who they are on the list, then their PIN.
   Two hosts render it -- its own page, and the overlay, which passes onDone so it closes itself as the app moves on. */
export default function ClassLogin({ onDone }: { onDone?: () => void } = {}) {
  const t = useTranslations('class_login');
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('code');
  const [code, setCode] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [child, setChild] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'code' | 'login' | null>(null);

  async function loadRoster() {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    try {
      const list = await fetchClassRoster(c);
      setRoster(list);
      setPhase('pick');
    } catch {
      setError('code');
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!child || pin.trim().length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await classLogin(code.trim(), child.child_id, pin.trim());
      // Persist the child's identity so the app shell / dashboard greet them by
      // name (and pick the right avatar) instead of the generic fallback.
      try {
        localStorage.setItem(
          'kidProfile',
          JSON.stringify({ nickname: child.nickname, avatar_id: child.avatar_id }),
        );
        localStorage.setItem('ideapop_nickname', child.nickname);
      } catch {
        /* private mode — greeting falls back to the generic name */
      }
      setPersona('kid');
      onDone?.();
      router.push('/dashboard/kid');
    } catch {
      setError('login');
      setBusy(false);
    }
  }

  return (
    <div data-testid="class-login" className="flex w-full flex-col items-center">
      <div className="mt-6 w-full max-w-md rounded-[1.75rem] p-7 shadow-xl" style={{ backgroundColor: CARD }}>
        <h1 className="mb-1 text-center font-display text-2xl font-bold text-[#CDEB5A]">
          {t('title')}
        </h1>

        {phase === 'code' && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-center font-body text-sm text-white/60">{t('intro')}</p>
            <label htmlFor="class-code" className="sr-only">
              {t('code_label')}
            </label>
            <input
              id="class-code"
              type="text"
              autoFocus
              autoCapitalize="characters"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadRoster();
              }}
              placeholder={t('code_placeholder')}
              data-testid="code-input"
              dir="ltr"
              className={`${darkInput} text-center tracking-[0.3em]`}
            />
            {error === 'code' && (
              <p role="alert" className="text-center text-sm text-red-300">
                {t('error_code')}
              </p>
            )}
            <button
              type="button"
              data-testid="code-next-btn"
              className={`${nextBtn} self-center`}
              onClick={() => void loadRoster()}
              disabled={busy || code.trim().length === 0}
            >
              {t('code_next')}
            </button>
          </div>
        )}

        {phase === 'pick' && (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-center font-body text-sm text-white/60">{t('pick_name')}</p>
            {roster.length === 0 ? (
              <p className="text-center font-body text-sm text-white/60">{t('no_students')}</p>
            ) : (
              <div data-testid="roster-list" className="grid grid-cols-2 gap-3">
                {roster.map((r) => (
                  <button
                    key={r.child_id}
                    type="button"
                    data-testid="roster-pick"
                    onClick={() => {
                      setChild(r);
                      setPin('');
                      setPhase('pin');
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-3 py-4 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CDEB5A]"
                  >
                    <span className="text-4xl" aria-hidden="true">
                      {avatarEmoji(r.avatar_id)}
                    </span>
                    <span className="font-display text-sm font-bold text-white">{r.nickname}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={`${backBtn} self-center`} onClick={() => setPhase('code')}>
              {t('back')}
            </button>
          </div>
        )}

        {phase === 'pin' && child && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-5xl" aria-hidden="true">
                {avatarEmoji(child.avatar_id)}
              </span>
              <span className="font-display text-lg font-bold text-white">{child.nickname}</span>
            </div>
            <label htmlFor="class-pin" className="sr-only">
              {t('pin_label')}
            </label>
            <input
              id="class-pin"
              type="text"
              autoFocus
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void signIn();
              }}
              placeholder={t('pin_placeholder')}
              data-testid="pin-input"
              dir="ltr"
              className={`${darkInput} text-center text-2xl tracking-[0.5em]`}
            />
            {error === 'login' && (
              <p role="alert" data-testid="class-login-error" className="text-center text-sm text-red-300">
                {t('error_login')}
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button type="button" className={backBtn} onClick={() => setPhase('pick')}>
                {t('back')}
              </button>
              <button
                type="button"
                data-testid="class-login-btn"
                className={nextBtn}
                onClick={() => void signIn()}
                disabled={busy || pin.trim().length === 0}
              >
                {busy ? t('logging_in') : t('login_btn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
