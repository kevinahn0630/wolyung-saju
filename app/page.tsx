'use client';

import {
  CalendarDays,
  Check,
  ChevronLeft,
  Circle,
  Heart,
  MoonStar,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoveTopics } from '@/components/love-topics';
import { SajuChartTable } from '@/components/saju-chart-table';
import { Button } from '@/components/ui/button';
import { CONSENT_COPY, CONTACT_COPY } from '@/lib/consent';
import { buildLoveReading } from '@/lib/love-reading';
import { calculateSaju, type SajuChart } from '@/lib/saju/pillars';
import {
  isValidAccountNumber,
  isValidInstagram,
  isValidStudentId,
  normalizeInstagram,
  parseBirthTime,
  parseBirthday,
  saveSubmission,
  toSajuInput,
} from '@/lib/submission';
import {
  DETAIL_ERROR_MESSAGES,
  FIELD_COPY,
  FORM_COPY,
  FORM_STEPS,
  HERO_COPY,
  HERO_FOOTER_POINTS,
  MATCH_REVISIT_COPY,
  READING_POINTS,
  RECRUITMENT_CLOSED_COPY,
  RECRUITMENT_CLOSES_AT,
  RECRUITMENT_SCHEDULE,
  REFUND_BANKS,
  RESULT_COPY,
  UNIVERSITIES,
  getErrorMessage,
  isRecruitmentClosed,
  type Direction,
  type FlowScreen,
  type FormStep,
  type SubmissionDraft,
} from '@/lib/wolyung-flow';

const EMPTY_DRAFT: SubmissionDraft = {
  name: '',
  birthday: '',
  calendarType: 'solar',
  birthTime: '',
  unknownTime: false,
  gender: 'female',
  university: '',
  department: '',
  instagram: '',
  studentId: '',
  refundBank: '',
  refundAccount: '',
  consentAgreed: false,
};

export default function Home() {
  const [screen, setScreen] = useState<FlowScreen>('intro');
  const [direction, setDirection] = useState<Direction>('forward');
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT);
  // 성별은 고르기 전까지 아무 버튼도 눌린 상태가 아니어야 해서 따로 둔다.
  const [genderPicked, setGenderPicked] = useState(false);
  const [chart, setChart] = useState<SajuChart | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const previousScreen = useRef<FlowScreen>('intro');

  const goToScreen = useCallback(
    (nextScreen: FlowScreen, mode: 'push' | 'replace' = 'push') => {
      const nextDirection =
        getScreenIndex(nextScreen) < getScreenIndex(previousScreen.current)
          ? 'backward'
          : 'forward';
      const nextUrl =
        nextScreen === 'intro'
          ? `${window.location.pathname}${window.location.search}`
          : `#_q=${nextScreen}`;

      if (mode === 'replace') {
        window.history.replaceState({ wolyungStep: nextScreen }, '', nextUrl);
      } else {
        window.history.pushState({ wolyungStep: nextScreen }, '', nextUrl);
      }

      previousScreen.current = nextScreen;
      setDirection(nextDirection);
      setScreen(nextScreen);
    },
    [],
  );

  useEffect(() => {
    // 새로고침으로 들어오면 입력값이 없으므로 언제나 처음 화면에서 시작한다.
    if (window.location.hash) {
      window.history.replaceState(
        { wolyungStep: 'intro' },
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }

    const syncScreenState = () => {
      const nextScreen = getScreenFromHash();
      setDirection(
        getScreenIndex(nextScreen) < getScreenIndex(previousScreen.current)
          ? 'backward'
          : 'forward',
      );
      previousScreen.current = nextScreen;
      setScreen(nextScreen);
    };

    window.addEventListener('popstate', syncScreenState);
    window.addEventListener('hashchange', syncScreenState);

    return () => {
      window.removeEventListener('popstate', syncScreenState);
      window.removeEventListener('hashchange', syncScreenState);
    };
  }, []);

  const [recruitmentClosed, setRecruitmentClosed] = useState(() =>
    isRecruitmentClosed(),
  );
  // 기기 시계가 틀려 화면은 열려 있었지만 서버가 마감으로 거절한 경우.
  const [submissionClosed, setSubmissionClosed] = useState(false);

  // 첫 화면을 열어 둔 채 마감 시각을 넘기면 버튼도 그 순간 닫히도록 타이머를 건다.
  useEffect(() => {
    if (recruitmentClosed) {
      return;
    }

    const remaining = RECRUITMENT_CLOSES_AT - Date.now();

    // setTimeout 은 약 24.8일을 넘는 지연을 곧바로 실행해 버린다. 그보다 멀면
    // 그 사이의 새로고침에 맡긴다.
    if (remaining > 2_147_483_647) {
      return;
    }

    const timer = window.setTimeout(
      () => setRecruitmentClosed(true),
      Math.max(remaining, 0),
    );

    return () => window.clearTimeout(timer);
  }, [recruitmentClosed]);

  /**
   * 마지막 단계에서 부른다. 사주를 세우고 저장을 걸어 둔 뒤 로딩 화면으로 넘어간다.
   * 입력이 온전하지 않으면 'invalid', 모집이 끝났으면 'closed' 를 돌려주어 폼이
   * 알맞은 오류를 띄우게 한다.
   */
  const beginReading = useCallback(
    (honeypot: string): 'ok' | 'invalid' | 'closed' => {
      // 마감 전에 폼을 열어 두고 채운 사람도 여기서 막힌다.
      if (isRecruitmentClosed()) {
        setRecruitmentClosed(true);
        return 'closed';
      }

      const sajuInput = toSajuInput(draft);

      if (!sajuInput) {
        return 'invalid';
      }

      const nextChart = calculateSaju(sajuInput);
      setChart(nextChart);

      void saveSubmission(draft, nextChart, honeypot).then((result) => {
        setSubmissionClosed(result.closed === true);
        setSaveFailed(!result.ok && result.closed !== true);
      });

      goToScreen('loading');
      return 'ok';
    },
    [draft, goToScreen],
  );

  // 로딩 화면을 잠깐 보여 준 뒤 풀이로 넘어간다.
  useEffect(() => {
    if (screen !== 'loading' || !chart) {
      return;
    }

    const timer = window.setTimeout(() => {
      goToScreen('result', 'replace');
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [chart, goToScreen, screen]);

  const restart = () => {
    setDraft(EMPTY_DRAFT);
    setGenderPicked(false);
    setChart(null);
    setSaveFailed(false);
    setSubmissionClosed(false);
    goToScreen('intro', 'replace');
  };

  return (
    <main className="min-h-dvh bg-[#090d1c] text-white">
      <section className="mx-auto min-h-dvh w-full max-w-[450px] overflow-hidden bg-[#0b1024] shadow-[0_0_70px_rgb(3_7_18/55%)] sm:rounded-[28px]">
        {screen === 'intro' && (
          <HeroScreen
            closed={recruitmentClosed}
            onStart={() => goToScreen('name')}
          />
        )}

        {screen === 'result' && chart && (
          <ResultScreen
            chart={chart}
            draft={draft}
            onRestart={restart}
            saveFailed={saveFailed}
            submissionClosed={submissionClosed}
          />
        )}

        {screen !== 'intro' && screen !== 'result' && (
          <BirthInfoForm
            direction={direction}
            draft={draft}
            genderPicked={genderPicked}
            onBack={() => goToScreen(getPreviousScreen(screen), 'replace')}
            onDraftChange={setDraft}
            onGenderPicked={() => setGenderPicked(true)}
            onStepChange={goToScreen}
            onSubmit={beginReading}
            screen={screen}
          />
        )}
      </section>
    </main>
  );
}

function getScreenFromHash(): FlowScreen {
  const hashValue = window.location.hash.replace('#_q=', '');

  if (
    FORM_STEPS.includes(hashValue as FormStep) ||
    hashValue === 'loading' ||
    hashValue === 'result'
  ) {
    return hashValue as FlowScreen;
  }

  return 'intro';
}

function getScreenIndex(screen: FlowScreen) {
  if (screen === 'intro') {
    return -1;
  }

  if (screen === 'loading') {
    return FORM_STEPS.length;
  }

  if (screen === 'result') {
    return FORM_STEPS.length + 1;
  }

  return FORM_STEPS.indexOf(screen);
}

function getPreviousScreen(screen: FlowScreen): FlowScreen {
  if (screen === 'loading' || screen === 'result') {
    return FORM_STEPS[FORM_STEPS.length - 1];
  }

  const currentIndex = FORM_STEPS.indexOf(screen as FormStep);

  return currentIndex > 0 ? FORM_STEPS[currentIndex - 1] : 'intro';
}

function HeroScreen({
  closed,
  onStart,
}: {
  /** 모집이 끝났으면 신청 버튼을 막고 매칭 공지 시각을 안내한다. */
  closed: boolean;
  onStart: () => void;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <img
        src="/astrology-woman.png"
        alt={HERO_COPY.imageAlt}
        className="hero-portrait absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(5_9_22/10%)_0%,rgb(6_10_28/20%)_38%,rgb(5_8_20/78%)_73%,rgb(4_7_18/96%)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_4%,rgb(219_235_255/58%),transparent_21%),linear-gradient(180deg,rgb(2_5_19/35%),transparent)]" />
      <div className="stars-layer" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-5 pt-5">
        <a
          href="/"
          aria-label={HERO_COPY.navLabel}
          className="flex items-center gap-2"
        >
          <span className="grid size-8 place-items-center rounded-[7px] border border-[#e7c27a]/55 bg-[#7b1f2d]/95 text-[11px] font-bold leading-none text-[#ffe7b0]">
            {HERO_COPY.logoMark}
          </span>
          <span className="text-[1.35rem] font-semibold tracking-[0.08em] text-white [text-shadow:0_2px_14px_rgb(0_0_0/55%)]">
            {HERO_COPY.logoText}
          </span>
        </a>
        <ContactMenu />
      </header>

      {/*
        헤더 아래 남은 높이만 차지해야 화면 높이에 맞게 바닥에 붙는다. 여기에 min-h-dvh 를
        주면 헤더만큼 화면보다 길어져, 아래 내용이 하단 고정 CTA 영역(약 136px)에 가린다.
      */}
      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-[150px] pt-24">
        <div className="mb-6 text-center">
          <p className="hero-audience-badge">{HERO_COPY.audienceBadge}</p>
          <p className="mb-2 text-[1.28rem] font-semibold tracking-[0.06em] text-[#f9f5ea] [text-shadow:0_3px_15px_rgb(0_0_0/70%)]">
            {HERO_COPY.brand}
          </p>
          <h1 className="hero-title font-serif font-black text-white [text-shadow:0_10px_28px_rgb(0_0_0/70%),0_0_24px_rgb(120_166_255/70%)]">
            {HERO_COPY.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[19rem] text-[1.05rem] font-medium leading-7 text-[#f4f7ff] [text-shadow:0_3px_13px_rgb(0_0_0/70%)]">
            {HERO_COPY.description[0]}
            <br />
            {HERO_COPY.description[1]}
          </p>
        </div>

        <dl className="hero-schedule">
          {RECRUITMENT_SCHEDULE.map((item) => (
            <div key={item.label} className="hero-schedule-item">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-3 gap-2.5">
          {READING_POINTS.map((point) => (
            <div
              key={point}
              className="rounded-[8px] border border-white/16 bg-[#071127]/50 px-2 py-3 text-center text-[0.82rem] font-semibold text-[#dce9ff] shadow-[0_8px_28px_rgb(0_0_0/22%)] backdrop-blur-md"
            >
              {point}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[450px] bg-[linear-gradient(180deg,transparent,rgb(4_7_18/92%)_18%,rgb(4_7_18/98%))] px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-8 sm:absolute">
        <Button
          type="button"
          size="lg"
          onClick={onStart}
          disabled={closed}
          className="h-14 w-full rounded-[8px] border border-white/55 bg-[linear-gradient(90deg,#d9e7ff,#ffffff_48%,#dbe8ff)] text-[1rem] font-extrabold text-[#101b35] shadow-[0_16px_36px_rgb(9_17_42/50%),inset_0_0_0_1px_rgb(255_255_255/60%)] hover:brightness-105 disabled:opacity-70"
        >
          {closed ? (
            RECRUITMENT_CLOSED_COPY.cta
          ) : (
            <>
              <Sparkles className="size-5" data-icon="inline-start" />
              {HERO_COPY.cta}
            </>
          )}
        </Button>
        {/* 마감 뒤에는 같은 자리에 공지 시각을 적는다. 줄 높이가 같아 하단 영역이 커지지 않는다. */}
        {closed ? (
          <p className="mt-3 text-center text-[0.76rem] font-semibold text-[#f0d7a8]">
            {RECRUITMENT_CLOSED_COPY.heroNote}
          </p>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-4 text-[0.76rem] font-medium text-[#c4d2f2]">
            <span className="inline-flex items-center gap-1.5">
              <MoonStar className="size-3.5" />
              {HERO_FOOTER_POINTS[0]}
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {HERO_FOOTER_POINTS[1]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 첫 화면 오른쪽 위 `문의` 버튼.
 *
 * 개인정보 정정·삭제 요청을 받을 창구를 어디서든 찾을 수 있어야 해서, 동의
 * 전문 안에만 두지 않고 첫 화면에도 꺼내 뒀다.
 */
function ContactMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="contact-menu">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="contact-panel"
        aria-label={open ? CONTACT_COPY.closeLabel : CONTACT_COPY.openLabel}
        className="h-10 rounded-full bg-white/8 px-4 text-[0.9rem] font-bold text-white shadow-[0_8px_24px_rgb(0_0_0/25%)] backdrop-blur-md hover:bg-white/16 hover:text-white"
      >
        {CONTACT_COPY.buttonLabel}
      </Button>

      {open && (
        <>
          {/* 패널 바깥을 누르면 닫힌다. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="contact-scrim"
          />
          {/* 초점을 가두지 않으므로 dialog 가 아니라 여닫이(disclosure)다. */}
          <div id="contact-panel" className="contact-panel">
            <p className="contact-panel-body">
              {CONTACT_COPY.bodyBefore}
              <a
                href={CONTACT_COPY.handleHref}
                target="_blank"
                rel="noreferrer"
                className="contact-panel-handle"
              >
                {CONTACT_COPY.handle}
              </a>
              {CONTACT_COPY.bodyAfter}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function BirthInfoForm({
  direction,
  draft,
  genderPicked,
  onBack,
  onDraftChange,
  onGenderPicked,
  onStepChange,
  onSubmit,
  screen,
}: {
  direction: Direction;
  draft: SubmissionDraft;
  genderPicked: boolean;
  onBack: () => void;
  onDraftChange: (draft: SubmissionDraft) => void;
  onGenderPicked: () => void;
  onStepChange: (screen: FlowScreen, mode?: 'push' | 'replace') => void;
  /** 마지막 단계에서 부른다. 입력이 온전하지 않으면 'invalid', 마감이면 'closed'. */
  onSubmit: (honeypot: string) => 'ok' | 'invalid' | 'closed';
  screen: Exclude<FlowScreen, 'intro' | 'result'>;
}) {
  const [error, setError] = useState<{
    message: string;
    screen: Exclude<FlowScreen, 'intro' | 'result'>;
  } | null>(null);
  // 사람에게는 보이지 않는 미끼 항목. 봇이 폼을 통째로 채우면 여기에 값이 들어간다.
  const [honeypot, setHoneypot] = useState('');

  const currentStepIndex = FORM_STEPS.indexOf(screen as FormStep);
  const progress =
    currentStepIndex >= 0 ? currentStepIndex + 1 : FORM_STEPS.length;
  const progressWidth = `${(progress / FORM_STEPS.length) * 100}%`;
  const currentError = error?.screen === screen ? error.message : '';
  const isLastStep = currentStepIndex === FORM_STEPS.length - 1;

  const update = (patch: Partial<SubmissionDraft>) => {
    onDraftChange({ ...draft, ...patch });
    setError(null);
  };

  const handleBirthdayChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)];
    update({ birthday: parts.filter(Boolean).join('.') });
  };

  const handleBirthTimeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    update({
      birthTime:
        digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits,
    });
  };

  /** 통과하면 null, 막히면 보여 줄 문구를 돌려준다. */
  const validateCurrentStep = (): string | null => {
    if (screen === 'name') {
      return draft.name.trim().length > 0 ? null : getErrorMessage(screen);
    }

    if (screen === 'birthday') {
      if (draft.birthday.length !== 10) {
        return getErrorMessage(screen);
      }

      return parseBirthday(draft.birthday)
        ? null
        : DETAIL_ERROR_MESSAGES.birthdayNotReal;
    }

    if (screen === 'birth-time') {
      if (draft.unknownTime) {
        return null;
      }

      if (draft.birthTime.length !== 5) {
        return getErrorMessage(screen);
      }

      return parseBirthTime(draft.birthTime)
        ? null
        : DETAIL_ERROR_MESSAGES.birthTimeRange;
    }

    if (screen === 'gender') {
      return genderPicked ? null : getErrorMessage(screen);
    }

    if (screen === 'university') {
      if (!draft.university) {
        return getErrorMessage(screen);
      }

      return draft.department.trim().length > 0
        ? null
        : DETAIL_ERROR_MESSAGES.departmentRequired;
    }

    if (screen === 'instagram') {
      if (normalizeInstagram(draft.instagram).length === 0) {
        return getErrorMessage(screen);
      }

      if (!isValidInstagram(draft.instagram)) {
        return DETAIL_ERROR_MESSAGES.instagramFormat;
      }

      if (!isValidStudentId(draft.studentId)) {
        return DETAIL_ERROR_MESSAGES.studentIdFormat;
      }

      if (!draft.refundBank) {
        return DETAIL_ERROR_MESSAGES.refundBankRequired;
      }

      if (!isValidAccountNumber(draft.refundAccount)) {
        return DETAIL_ERROR_MESSAGES.refundAccountFormat;
      }

      return draft.consentAgreed ? null : CONSENT_COPY.error;
    }

    return null;
  };

  const handleNext = () => {
    const message = validateCurrentStep();

    if (message) {
      setError({ message, screen });
      return;
    }

    if (!isLastStep) {
      onStepChange(FORM_STEPS[currentStepIndex + 1]);
      return;
    }

    const outcome = onSubmit(honeypot);

    if (outcome === 'closed') {
      setError({ message: RECRUITMENT_CLOSED_COPY.formError, screen });
    } else if (outcome === 'invalid') {
      setError({ message: DETAIL_ERROR_MESSAGES.birthdayNotReal, screen });
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <img
        src="/astrology-woman.png"
        alt=""
        aria-hidden="true"
        className="form-backdrop-image absolute inset-0 h-full w-full object-cover blur-[6px]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(13_20_36/86%)_0%,rgb(15_22_39/66%)_34%,rgb(12_16_27/84%)_72%,rgb(4_5_9/96%)_100%)]" />

      <button
        type="button"
        onClick={onBack}
        aria-label={FORM_COPY.backLabel}
        className="absolute left-4 top-5 z-30 grid size-11 place-items-center rounded-full text-white transition hover:bg-white/10"
      >
        <ChevronLeft className="size-9 stroke-[2.5]" />
      </button>

      <form
        onSubmit={(event) => event.preventDefault()}
        className="birth-form relative z-10 flex min-h-dvh flex-col"
      >
        {/*
          미끼 항목. 화면에서 감추고 보조기기와 자동완성에서도 빼 두었으므로
          사람은 채울 일이 없다. 폼을 통째로 훑는 봇만 여기에 값을 넣는다.
        */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="honeypot-field"
        />
        <div
          className="form-progress"
          aria-label={FORM_COPY.progressLabel(progress, FORM_STEPS.length)}
        >
          <span>
            {progress}/{FORM_STEPS.length}
          </span>
          <div className="form-progress-track">
            <div
              className="form-progress-bar"
              style={{ width: progressWidth }}
            />
          </div>
        </div>

        <div key={screen} className={`form-step-panel form-step-${direction}`}>
          {screen === 'name' && (
            <FieldBlock label={FIELD_COPY.name.label}>
              <input
                value={draft.name}
                onChange={(event) =>
                  update({
                    name: event.target.value.slice(
                      0,
                      FIELD_COPY.name.maxLength,
                    ),
                  })
                }
                placeholder={FIELD_COPY.name.placeholder}
                aria-label={FIELD_COPY.name.ariaLabel}
                className="form-line-input"
              />
            </FieldBlock>
          )}

          {screen === 'birthday' && (
            <FieldBlock
              label={FIELD_COPY.birthday.label}
              action={
                <div className="flex items-center gap-5">
                  <ChoiceButton
                    active={draft.calendarType === 'solar'}
                    label={FIELD_COPY.calendar.solarLabel}
                    onClick={() => update({ calendarType: 'solar' })}
                  />
                  <ChoiceButton
                    active={false}
                    disabled
                    label={FIELD_COPY.calendar.lunarLabel}
                    suffix={FIELD_COPY.calendar.lunarPendingLabel}
                    onClick={() => undefined}
                  />
                </div>
              }
              helper={FIELD_COPY.calendar.lunarPendingNote}
            >
              <input
                inputMode="numeric"
                value={draft.birthday}
                onChange={(event) => handleBirthdayChange(event.target.value)}
                placeholder={FIELD_COPY.birthday.placeholder}
                aria-label={FIELD_COPY.birthday.ariaLabel}
                className="form-line-input"
              />
            </FieldBlock>
          )}

          {screen === 'birth-time' && (
            <FieldBlock
              label={FIELD_COPY.birthTime.label}
              action={
                <ChoiceButton
                  active={draft.unknownTime}
                  label={FIELD_COPY.birthTime.unknownLabel}
                  onClick={() => update({ unknownTime: !draft.unknownTime })}
                />
              }
            >
              <input
                inputMode="numeric"
                value={draft.birthTime}
                onChange={(event) => handleBirthTimeChange(event.target.value)}
                disabled={draft.unknownTime}
                placeholder={FIELD_COPY.birthTime.placeholder}
                aria-label={FIELD_COPY.birthTime.ariaLabel}
                className="form-line-input disabled:text-white/35"
              />
            </FieldBlock>
          )}

          {screen === 'gender' && (
            <fieldset>
              <legend className="gender-legend">
                {FIELD_COPY.gender.label}
              </legend>
              <div className="gender-grid">
                <PickerButton
                  active={genderPicked && draft.gender === 'male'}
                  label={FIELD_COPY.gender.maleLabel}
                  onClick={() => {
                    onGenderPicked();
                    update({ gender: 'male' });
                  }}
                />
                <PickerButton
                  active={genderPicked && draft.gender === 'female'}
                  label={FIELD_COPY.gender.femaleLabel}
                  onClick={() => {
                    onGenderPicked();
                    update({ gender: 'female' });
                  }}
                />
              </div>
            </fieldset>
          )}

          {screen === 'university' && (
            <>
              <fieldset>
                <legend className="gender-legend">
                  {FIELD_COPY.university.label}
                </legend>
                <div className="university-grid">
                  {UNIVERSITIES.map((item) => (
                    <PickerButton
                      key={item.value}
                      active={draft.university === item.value}
                      label={item.label}
                      onClick={() => update({ university: item.value })}
                    />
                  ))}
                </div>
                <p className="university-helper">
                  {FIELD_COPY.university.helper}
                </p>
              </fieldset>

              <div className="university-department">
                <FieldBlock label={FIELD_COPY.department.label}>
                  <input
                    value={draft.department}
                    onChange={(event) =>
                      update({
                        department: event.target.value.slice(
                          0,
                          FIELD_COPY.department.maxLength,
                        ),
                      })
                    }
                    placeholder={FIELD_COPY.department.placeholder}
                    aria-label={FIELD_COPY.department.ariaLabel}
                    className="form-line-input"
                  />
                </FieldBlock>
              </div>
            </>
          )}

          {screen === 'instagram' && (
            <FieldBlock
              label={FIELD_COPY.instagram.label}
              helper={FIELD_COPY.instagram.helper}
            >
              <span className="instagram-input">
                <span aria-hidden="true">@</span>
                <input
                  value={draft.instagram}
                  onChange={(event) =>
                    update({
                      instagram: event.target.value
                        .replace(/\s/g, '')
                        .slice(0, FIELD_COPY.instagram.maxLength + 1),
                    })
                  }
                  placeholder={FIELD_COPY.instagram.placeholder}
                  aria-label={FIELD_COPY.instagram.ariaLabel}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="form-line-input"
                />
              </span>
            </FieldBlock>
          )}

          {screen === 'instagram' && (
            <div className="refund-fields">
              <FieldBlock label={FIELD_COPY.studentId.label}>
                <input
                  inputMode="numeric"
                  value={draft.studentId}
                  onChange={(event) =>
                    update({
                      studentId: event.target.value
                        .replace(/[^0-9-]/g, '')
                        .slice(0, FIELD_COPY.studentId.maxLength),
                    })
                  }
                  placeholder={FIELD_COPY.studentId.placeholder}
                  aria-label={FIELD_COPY.studentId.ariaLabel}
                  className="form-line-input"
                />
              </FieldBlock>

              <FieldBlock
                label={FIELD_COPY.refund.label}
                helper={FIELD_COPY.refund.helper}
              >
                <div className="refund-account-row">
                  <select
                    value={draft.refundBank}
                    onChange={(event) =>
                      update({
                        refundBank: event.target
                          .value as SubmissionDraft['refundBank'],
                      })
                    }
                    aria-label={FIELD_COPY.refund.bankAriaLabel}
                    className="form-line-input refund-bank-select"
                  >
                    <option value="" disabled>
                      {FIELD_COPY.refund.bankPlaceholder}
                    </option>
                    {REFUND_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft.refundAccount}
                    onChange={(event) =>
                      update({
                        refundAccount: event.target.value
                          .replace(/[^0-9-]/g, '')
                          .slice(0, FIELD_COPY.refund.accountMaxLength),
                      })
                    }
                    placeholder={FIELD_COPY.refund.accountPlaceholder}
                    aria-label={FIELD_COPY.refund.accountAriaLabel}
                    className="form-line-input"
                  />
                </div>
              </FieldBlock>
            </div>
          )}

          {screen === 'instagram' && (
            <ConsentBlock
              agreed={draft.consentAgreed}
              onToggle={() => update({ consentAgreed: !draft.consentAgreed })}
            />
          )}

          {screen === 'loading' && (
            <output className="result-panel" aria-live="polite">
              <Sparkles className="size-9 animate-pulse text-[#dbe8ff]" />
              <p className="result-title">{RESULT_COPY.loading.title}</p>
              <p className="result-copy">{RESULT_COPY.loading.body}</p>
            </output>
          )}

          {currentError && <p className="form-error">{currentError}</p>}
        </div>

        {screen !== 'loading' && (
          <div className="form-bottom-action">
            <Button
              type="button"
              onClick={handleNext}
              className="next-button w-full bg-[linear-gradient(90deg,#d9e7ff,#ffffff_52%,#dce9ff)] font-extrabold text-[#111b34] hover:brightness-105"
            >
              <Sparkles className="size-5" data-icon="inline-start" />
              {isLastStep ? FORM_COPY.submitLabel : FORM_COPY.nextLabel}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function ResultScreen({
  chart,
  draft,
  onRestart,
  saveFailed,
  submissionClosed,
}: {
  chart: SajuChart;
  draft: SubmissionDraft;
  onRestart: () => void;
  saveFailed: boolean;
  /** 서버가 마감으로 신청을 거절했으면, 접수된 것처럼 보이지 않게 한다. */
  submissionClosed: boolean;
}) {
  const [requested, setRequested] = useState(false);
  // 재접속 안내는 한 번만 띄운다. 닫은 뒤 다시 스크롤해도 또 뜨지 않는다.
  const [revisitOpen, setRevisitOpen] = useState(false);
  const revisitShown = useRef(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const revisitConfirmRef = useRef<HTMLButtonElement>(null);

  // 저장에 실패했거나 마감으로 거절된 사람은 매칭 대상이 아니므로 안내하지 않는다.
  const revisitEligible = !saveFailed && !submissionClosed;

  const showRevisitNotice = useCallback(() => {
    if (revisitShown.current) {
      return;
    }

    revisitShown.current = true;
    setRevisitOpen(true);
  }, []);

  // 풀이를 끝까지 내려 하단 영역이 보이면 "다 읽었다" 고 보고 안내를 띄운다.
  useEffect(() => {
    const target = ctaRef.current;

    if (!target || !revisitEligible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          showRevisitNotice();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [revisitEligible, showRevisitNotice]);

  // 열리면 확인 버튼으로 초점을 옮기고, Esc 로도 닫을 수 있게 한다.
  useEffect(() => {
    if (!revisitOpen) {
      return;
    }

    revisitConfirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRevisitOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [revisitOpen]);

  const topics = useMemo(
    () => buildLoveReading(chart, draft.name),
    [chart, draft.name],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handle = normalizeInstagram(draft.instagram);

  return (
    <div className="result-page relative min-h-dvh">
      {/*
        배경 이미지는 화면 위쪽 띠 안에만 둔다. 문서 전체 높이에 걸친 블러 레이어는
        스크롤할 때마다 다시 합성돼서 모바일에서 눈에 띄게 버벅인다.
      */}
      <div className="result-backdrop" aria-hidden="true">
        <img
          src="/astrology-woman.png"
          alt=""
          className="form-backdrop-image absolute inset-0 h-full w-full object-cover blur-[10px]"
        />
        <div className="result-backdrop-veil" />
        <div className="stars-layer" />
      </div>

      <div className="result-screen relative z-10">
        <button
          type="button"
          onClick={onRestart}
          aria-label={FORM_COPY.resetLabel}
          className="absolute left-0 top-0 grid size-11 place-items-center rounded-full text-white transition hover:bg-white/10"
        >
          <ChevronLeft className="size-8 stroke-[2.5]" />
        </button>

        <header className="result-header">
          <p className="result-brand">{HERO_COPY.brand}</p>
          <h1 className="result-heading">
            {draft.name.trim() || '그대'} 님의 연애운
          </h1>
          <p className="result-subject">
            {draft.birthday}
            {draft.unknownTime ? ' · 시간 미상' : ` · ${draft.birthTime}`}
            {` · ${draft.gender === 'male' ? '남성' : '여성'}`}
            {handle ? ` · @${handle}` : ''}
          </p>
        </header>

        <section className="result-section">
          <h2 className="result-section-title">{RESULT_COPY.chart.title}</h2>
          <p className="result-section-caption">{RESULT_COPY.chart.caption}</p>
          <SajuChartTable chart={chart} />
        </section>

        <section className="result-section">
          <h2 className="result-section-title">{RESULT_COPY.reading.title}</h2>
          <p className="result-section-caption">
            {RESULT_COPY.reading.caption}
          </p>
          <LoveTopics topics={topics} />
        </section>

        <div ref={ctaRef} className="result-cta">
          <Button
            type="button"
            disabled={requested || submissionClosed}
            onClick={() => {
              setRequested(true);

              if (revisitEligible) {
                showRevisitNotice();
              }
            }}
            className="next-button w-full bg-[linear-gradient(90deg,#f0d7a8,#fff6e2_52%,#efd6a6)] font-extrabold text-[#2a1a16] hover:brightness-105 disabled:opacity-100"
          >
            <Heart className="size-5" data-icon="inline-start" />
            {requested ? '연분을 찾는 중입니다' : RESULT_COPY.cta.label}
          </Button>

          {requested ? (
            <p className="result-cta-note result-cta-done">
              {RESULT_COPY.cta.done}
            </p>
          ) : (
            <p className="result-cta-note">{RESULT_COPY.cta.note}</p>
          )}

          {submissionClosed && (
            <p className="result-cta-warning">
              {RECRUITMENT_CLOSED_COPY.resultNotice}
            </p>
          )}

          {saveFailed && (
            <p className="result-cta-warning">
              신청서를 저장하지 못했습니다. 풀이는 그대로 보실 수 있지만, 매칭
              신청은 잠시 뒤 다시 시도해 주세요.
            </p>
          )}

          <p className="result-disclaimer">{RESULT_COPY.disclaimer}</p>

          <button type="button" onClick={onRestart} className="result-restart">
            {FORM_COPY.resetLabel}
          </button>
        </div>
      </div>

      {revisitOpen && revisitEligible && (
        <div className="revisit-overlay">
          <div
            aria-hidden="true"
            className="revisit-scrim"
            onClick={() => setRevisitOpen(false)}
          />
          {/*
            네이티브 dialog 를 열린 상태로 그린다. 가운데 정렬·흐린 배경·Esc 처리는
            위의 오버레이와 효과가 맡으므로 showModal 을 쓰지 않는다.
          */}
          <dialog
            open
            aria-labelledby="revisit-title"
            aria-describedby="revisit-message"
            className="revisit-card"
          >
            <MoonStar className="revisit-icon" aria-hidden="true" />
            <p id="revisit-title" className="revisit-title">
              {MATCH_REVISIT_COPY.title}
            </p>
            <p id="revisit-message" className="revisit-message">
              {MATCH_REVISIT_COPY.message}
            </p>
            <Button
              ref={revisitConfirmRef}
              type="button"
              onClick={() => setRevisitOpen(false)}
              className="next-button mt-5 w-full bg-[linear-gradient(90deg,#f0d7a8,#fff6e2_52%,#efd6a6)] font-extrabold text-[#2a1a16] hover:brightness-105"
            >
              {MATCH_REVISIT_COPY.confirmLabel}
            </Button>
          </dialog>
        </div>
      )}
    </div>
  );
}

/**
 * 개인정보 수집·이용 동의.
 *
 * 체크박스에는 무엇에 동의하는지 한 줄로 적고, 전문은 눌러서 펼치게 한다.
 * 스텝을 하나 더 만들지 않은 것은 모바일에서 단계가 늘수록 이탈이 커지기 때문이다.
 */
function ConsentBlock({
  agreed,
  onToggle,
}: {
  agreed: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="consent-block">
      <label className="consent-check">
        <input
          type="checkbox"
          checked={agreed}
          onChange={onToggle}
          className="consent-checkbox"
        />
        <span>{CONSENT_COPY.checkboxLabel}</span>
      </label>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="consent-detail"
        className="consent-toggle"
      >
        {expanded ? CONSENT_COPY.collapseLabel : CONSENT_COPY.expandLabel}
      </button>

      <div id="consent-detail" className="consent-detail" hidden={!expanded}>
        <h2 className="consent-detail-title">{CONSENT_COPY.title}</h2>
        <dl>
          {CONSENT_COPY.sections.map((section) => (
            <div key={section.heading} className="consent-row">
              <dt>{section.heading}</dt>
              <dd>{section.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  action,
  helper,
  children,
}: {
  label: string;
  action?: ReactNode;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field-group">
      <div className="form-field">
        <span className="form-field-header">
          <span className="form-field-label">{label}</span>
          {action}
        </span>
        {children}
      </div>
      {helper && <p className="form-field-helper">{helper}</p>}
    </div>
  );
}

function ChoiceButton({
  active,
  disabled,
  label,
  suffix,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  suffix?: string;
  onClick: () => void;
}) {
  const Icon = active ? Check : Circle;

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="choice-button disabled:opacity-45"
    >
      <span
        className={`choice-icon ${
          active ? 'bg-white text-[#172039]' : 'text-white/58'
        }`}
      >
        <Icon className="choice-icon-svg" />
      </span>
      {label}
      {suffix && <span className="choice-suffix">{suffix}</span>}
    </button>
  );
}

function PickerButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="gender-button"
    >
      {label}
    </button>
  );
}
