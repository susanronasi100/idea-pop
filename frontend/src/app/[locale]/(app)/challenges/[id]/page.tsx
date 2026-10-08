'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { useAgeMode } from '@/lib/hooks/useAgeMode';
import { useXpToast } from '@/lib/hooks/useXpToast';
import { fetchChallenge, startAttempt, advanceStep, claimSketchBonus } from '@/lib/api/client';
import MissionHUD from '@/components/challenge/MissionHUD';
import StepBrief from '@/components/challenge/StepBrief';
import StepIdeaFork from '@/components/challenge/StepIdeaFork';
import StepNatureClues from '@/components/challenge/StepNatureClues';
import StepDesignSecret from '@/components/challenge/StepDesignSecret';
import StepSkill from '@/components/challenge/StepSkill';
import StepSketch from '@/components/challenge/StepSketch';
import StepBuild from '@/components/challenge/StepBuild';
import StepCelebrate from '@/components/challenge/StepCelebrate';
import IdeasWallTab from '@/components/challenge/IdeasWallTab';
import XpBurst from '@/components/explore/XpBurst';
import DefineCelebration from '@/components/challenge/story/DefineCelebration';
import StoryBrief from '@/components/challenge/story/StoryBrief';
import StoryClues from '@/components/challenge/story/StoryClues';
import StorySecret from '@/components/challenge/story/StorySecret';
import StoryLab from '@/components/challenge/story/StoryLab';
import ToolLesson from '@/components/challenge/story/ToolLesson';
import StoryEnding from '@/components/challenge/story/StoryEnding';
import { StoryFairTest, StorySketchTop } from '@/components/challenge/story/StorySketchBuild';
import { Popi } from '@/components/challenge/story/StoryBits';
import { howQuestion } from '@/components/challenge/story/StoryPictureBook';
import { useMissionGame } from '@/components/challenge/story/useMissionGame';
import type { components } from '@/lib/api/schema';

type ChallengeDetail = components['schemas']['ChallengeDetail'];
type StartAttempt = components['schemas']['StartAttemptResponse'];
type XpAward = components['schemas']['XpAwardResponse'];

type StepNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type ActiveTab = 'mission' | 'wall';

function isStepNum(n: number): n is StepNum {
  return n >= 1 && n <= 8;
}

function wallStorageKey(challengeId: string) {
  return `wallSubmitted_${challengeId}`;
}

export default function ChallengePage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('challenge');
  const ageMode = useAgeMode();
  const { visible, award, show, dismiss } = useXpToast();

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [attempt, setAttempt] = useState<StartAttempt | null>(null);
  // Highest step already recorded server-side — PATCH only when the kid moves
  // FORWARD past it, so revisiting earlier steps never regresses the report.
  const highestRecordedRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('mission');
  const [currentStep, setCurrentStep] = useState<StepNum>(1);
  const [reachedSteps, setReachedSteps] = useState<Set<number>>(new Set([1]));
  const [ideaPath, setIdeaPath] = useState<'yes' | 'no' | null>(null);
  const [sketchProjectId, setSketchProjectId] = useState<string | null>(null);
  const [wallUnlocked, setWallUnlocked] = useState(false);
  // Story missions split step 5 into the lab and the creativity-tool power-up.
  const [skillPhase, setSkillPhase] = useState<'lab' | 'tool'>('lab');
  // The "you solved it!" moment after the sketch (TEMP rule 35).
  const [solvedCelebration, setSolvedCelebration] = useState<{ xp: number } | null>(null);
  const { game, update: updateGame, award: awardBadge } = useMissionGame(params.id);

  const locale = useLocale();

  // Load challenge data
  useEffect(() => {
    fetchChallenge(params.id, locale)
      .then((c) => setChallenge(c as ChallengeDetail))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [params.id, locale]);

  // Restore wall-unlocked state from localStorage
  useEffect(() => {
    if (!params.id) return;
    const stored = localStorage.getItem(wallStorageKey(params.id));
    if (stored === 'true') setWallUnlocked(true);
  }, [params.id]);

  // Start (or resume) the attempt once the challenge is loaded. The server is
  // idempotent: re-opening a mission returns the existing in-progress attempt.
  useEffect(() => {
    if (!challenge || attempt) return;
    startAttempt(challenge.id)
      .then((a) => {
        if (!a) return;
        setAttempt(a);
        // Resuming mid-mission: don't re-record steps already reached.
        highestRecordedRef.current = Math.max(1, a.current_step);
      })
      .catch(() => { /* silently fail — don't block the UI */ });
  }, [challenge, attempt]);

  const goToStep = useCallback(
    async (step: number) => {
      if (!isStepNum(step)) return;

      // Record real progress (and the step-8 completion + XP) — only when the
      // kid moves FORWARD past what's already recorded; failures never block.
      if (attempt && step > highestRecordedRef.current) {
        try {
          const res = await advanceStep(attempt.attempt_id, step);
          highestRecordedRef.current = step;
          if (res && res.xp_earned) {
            show(res as unknown as XpAward);
          }
        } catch {
          // Don't block navigation on tracking failure
        }
      }

      setCurrentStep(step);
      if (step === 6) setSkillPhase('lab');
      setReachedSteps((prev) => {
        const next = new Set(prev);
        next.add(step);
        return next;
      });
      setActiveTab('mission');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [attempt, show],
  );

  const handleIdeaYes = useCallback(() => {
    setIdeaPath('yes');
    // A kid with an idea goes straight to the sketch; Nature clues stays open in the menu.
    setReachedSteps((prev) => new Set(prev).add(3));
    goToStep(4);
  }, [goToStep]);

  const handleIdeaNo = useCallback(() => {
    setIdeaPath('no');
    goToStep(3);
  }, [goToStep]);

  function handleWallSubmitted() {
    setWallUnlocked(true);
    if (params.id) {
      localStorage.setItem(wallStorageKey(params.id), 'true');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tint-blue">
        <div className="animate-pulse font-display text-lg text-challenge">{t('loading_mission')}</div>
      </div>
    );
  }

  if (fetchError || !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-tint-blue gap-4 p-8">
        <p className="font-body text-ink/70">{fetchError ? t('load_error') : t('not_found')}</p>
        <Link href="/challenges" className="text-challenge font-body text-sm underline">
          {t('back_to_challenges')}
        </Link>
      </div>
    );
  }

  const sharedProps = { challenge, ageMode };
  // The storytelling + Popi instructor layer; null → the classic mission.
  const story = challenge.story ?? null;
  const gameProps = { game, update: updateGame };

  // A picture-book brief fills the frame; every other step keeps the narrow reading column.
  // The Your idea? choice cards get room to be big, too.
  const wide =
    (currentStep === 1 && story && story.opening.length > 0 && story.opening.every((p) => p.image)) || currentStep === 2
      ? 'max-w-5xl'
      : 'max-w-2xl';
  return (
    <div data-testid="challenge-page" className="min-h-screen bg-tint-blue">
      <MissionHUD
        challenge={challenge}
        currentStep={currentStep}
        reachedSteps={reachedSteps}
        onJumpTo={goToStep}
        ideaPath={ideaPath}
        keyInfo={story ? story.card : null}
        summary={challenge.brief}
      />

      {/* Mission / Ideas Wall tabs */}
      <div className={`${wide} mx-auto px-4 pt-4`}>
        <div className="mb-4 flex gap-1 rounded-pill bg-white p-1.5 shadow-sm" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'mission'}
            data-testid="tab-mission"
            onClick={() => setActiveTab('mission')}
            className={`flex-1 rounded-pill px-6 min-h-11 font-body text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0F3F63] focus-visible:ring-offset-1 ${activeTab === 'mission' ? 'bg-[#1A6FA6] text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]' : 'text-[#3E5566] hover:bg-[#EAF5FC] hover:text-[#1F2A33]'}`}
          >
            {t('tab_mission')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'wall'}
            data-testid="tab-wall"
            onClick={() => setActiveTab('wall')}
            className={`flex-1 rounded-pill px-6 min-h-11 font-body text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0F3F63] focus-visible:ring-offset-1 ${activeTab === 'wall' ? 'bg-[#1A6FA6] text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]' : 'text-[#3E5566] hover:bg-[#EAF5FC] hover:text-[#1F2A33]'}`}
          >
            {t('tab_wall')}
          </button>
        </div>
      </div>

      {/* Mission tab content */}
      {activeTab === 'mission' && (
        <div className={`${wide} mx-auto px-4 pb-24`}>
          {currentStep === 1 &&
            (story ? (
              <StoryBrief challenge={challenge} story={story} {...gameProps} onNext={() => goToStep(2)} />
            ) : (
              <StepBrief {...sharedProps} onNext={() => goToStep(2)} />
            ))}

          {currentStep === 2 && story && (
            <div className="flex flex-col gap-4 pt-4">
              <Popi text={howQuestion(story) ?? story.guide.your_idea} />
            </div>
          )}

          {currentStep === 2 && (
            <StepIdeaFork
              {...sharedProps}
              onYes={handleIdeaYes}
              onNo={handleIdeaNo}
              onBack={() => goToStep(1)}
            />
          )}

          {currentStep === 3 &&
            (story ? (
              <StoryClues
                story={story}
                {...gameProps}
                award={awardBadge}
                onNext={() => goToStep(4)}
                onBack={() => goToStep(2)}
              />
            ) : (
              <StepNatureClues
                {...sharedProps}
                onNext={() => goToStep(4)}
                onBack={() => goToStep(2)}
              />
            ))}

          {currentStep === 4 && story && <StorySketchTop story={story} {...gameProps} />}

          {currentStep === 4 && (
            <StepSketch
              {...sharedProps}
              hideTools={story !== null}
              onNext={(projectId) => {
                if (projectId) setSketchProjectId(projectId);
                // The kid has solved the problem with a first idea: celebrate, then
                // invite them on to find more ideas (design secret, skill, build).
                setSolvedCelebration({ xp: 0 });
                claimSketchBonus(challenge.id)
                  .then((r) => setSolvedCelebration((c) => (c ? { xp: r?.xp_earned ?? 0 } : c)))
                  .catch(() => {});
              }}
              onBack={() => goToStep(ideaPath === 'yes' ? 2 : 3)}
            />
          )}

          {currentStep === 5 &&
            (story ? (
              <StorySecret
                challenge={challenge}
                story={story}
                {...gameProps}
                onNext={() => goToStep(6)}
                onBack={() => goToStep(4)}
              />
            ) : (
              <StepDesignSecret
                {...sharedProps}
                onNext={() => goToStep(6)}
                onBack={() => goToStep(4)}
              />
            ))}

          {currentStep === 6 &&
            (story ? (
              skillPhase === 'lab' ? (
                <StoryLab
                  challenge={challenge}
                  story={story}
                  {...gameProps}
                  onNext={() => {
                    setSkillPhase('tool');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onBack={() => goToStep(5)}
                />
              ) : (
                <ToolLesson
                  story={story}
                  {...gameProps}
                  award={awardBadge}
                  onNext={() => goToStep(7)}
                  onBack={() => setSkillPhase('lab')}
                />
              )
            ) : (
              <StepSkill
                {...sharedProps}
                onNext={() => goToStep(7)}
                onBack={() => goToStep(5)}
              />
            ))}

          {currentStep === 7 && story && <StoryFairTest story={story} {...gameProps} />}

          {currentStep === 7 && (
            <StepBuild
              {...sharedProps}
              hideTestQuestion={story !== null}
              sketchProjectId={sketchProjectId}
              onNext={() => {
                show({
                  xp_earned: challenge.completion_xp,
                  xp_total: 0,
                  level: 1,
                  rank: 'Explorer',
                  is_new: false,
                  cycle_bonus_earned: false,
                });
                goToStep(8);
              }}
              onBack={() => goToStep(6)}
            />
          )}

          {currentStep === 8 && story && <StoryEnding story={story} {...gameProps} />}

          {currentStep === 8 && (
            <StepCelebrate
              {...sharedProps}
              completionXp={challenge.completion_xp}
              // Bonuses earned along the way count toward the total too: defining the problem (+5)
              defineXp={game.badges.includes('define') ? 5 : 0}
              // The "you solved it!" bonus after the sketch (+10).
              sketchXp={game.badges.includes('solved') ? 10 : 0}
              sketchProjectId={sketchProjectId}
              wallAlreadySubmitted={wallUnlocked}
              onWallSubmitted={handleWallSubmitted}
              onRestart={() => {
                window.location.href = '/challenges';
              }}
            />
          )}
        </div>
      )}

      {/* Ideas Wall tab content */}
      {activeTab === 'wall' && (
        <div className="max-w-2xl mx-auto pb-24">
          <IdeasWallTab
            challengeId={challenge.id}
            ageMode={ageMode}
            wallUnlocked={wallUnlocked}
            onWriteMyIdea={() => {
              setActiveTab('mission');
              goToStep(8);
            }}
          />
        </div>
      )}

      {solvedCelebration && (
        <DefineCelebration
          variant="solved"
          xp={solvedCelebration.xp}
          onClose={() => {
            setSolvedCelebration(null);
            if (story) updateGame((g) => ({ badges: g.badges.includes('solved') ? g.badges : [...g.badges, 'solved'] }));
            goToStep(5);
          }}
        />
      )}

      {visible && award && (
        <XpBurst
          award={award}
          stickerEmoji={story?.sticker.emoji ?? '⭐'}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
}
