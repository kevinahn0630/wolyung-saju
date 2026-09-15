/**
 * 폼에서 모은 값을 사주 계산 입력으로 바꾸고, 서버에 저장한다.
 *
 * 사주 풀이 자체는 브라우저에서 계산한다. 저장은 나중에 매칭에 쓰기 위한 것이라
 * 실패해도 풀이는 그대로 보여 준다.
 */

import { CONSENT_VERSION } from './consent';
import type { SajuChart, SajuInput } from './saju/pillars';
import type { SubmissionDraft } from './wolyung-flow';

/** 인스타그램이 허용하는 문자: 영문·숫자·마침표·밑줄, 최대 30자. */
const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

/** 앞에 붙은 @ 와 공백을 걷어 낸다. */
export function normalizeInstagram(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

export function isValidInstagram(raw: string): boolean {
  return INSTAGRAM_PATTERN.test(normalizeInstagram(raw));
}

/** 학번: 숫자와 하이픈, 숫자는 5자리 이상. 학교마다 형식이 달라 넉넉하게 받는다. */
export function isValidStudentId(raw: string): boolean {
  const trimmed = raw.trim();

  return (
    /^[0-9-]{5,15}$/.test(trimmed) && trimmed.replace(/-/g, '').length >= 5
  );
}

/** 계좌번호는 하이픈과 공백을 걷어 내고 숫자만 남긴다. */
export function normalizeAccountNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

/** 국내 은행 계좌번호는 대체로 10~14자리이고, 일부는 16자리까지 있다. */
export function isValidAccountNumber(raw: string): boolean {
  return /^[0-9]{10,16}$/.test(normalizeAccountNumber(raw));
}

/** 'YYYY.MM.DD' 를 실제로 존재하는 날짜인지까지 확인하며 쪼갠다. */
export function parseBirthday(
  birthday: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(birthday);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  // 월별 마지막 날은 다음 달 0일로 얻는다.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return day <= lastDayOfMonth ? { year, month, day } : null;
}

/** 'HH:MM' 을 쪼갠다. */
export function parseBirthTime(
  birthTime: string,
): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(birthTime);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/**
 * 폼 값을 사주 계산 입력으로 바꾼다. 값이 온전하지 않으면 null 을 돌려준다.
 *
 * 음력은 아직 변환하지 않는다. 그래서 폼에서 음력 선택을 막아 두었다.
 */
export function toSajuInput(draft: SubmissionDraft): SajuInput | null {
  const date = parseBirthday(draft.birthday);

  if (!date) {
    return null;
  }

  const time = draft.unknownTime ? null : parseBirthTime(draft.birthTime);

  if (!draft.unknownTime && !time) {
    return null;
  }

  return {
    year: date.year,
    month: date.month,
    day: date.day,
    hour: time?.hour ?? 12,
    minute: time?.minute ?? 0,
    hourKnown: !draft.unknownTime,
    gender: draft.gender,
  };
}

export type SubmissionPayload = {
  name: string;
  /** 'YYYY-MM-DD' */
  birthDate: string;
  calendarType: SubmissionDraft['calendarType'];
  /** 'HH:MM'. 시간을 모르면 null. */
  birthTime: string | null;
  hourKnown: boolean;
  gender: SubmissionDraft['gender'];
  university: SubmissionDraft['university'];
  department: string;
  instagram: string;
  studentId: string;
  refundBank: SubmissionDraft['refundBank'];
  /** 숫자만. */
  refundAccount: string;
  consentAgreed: boolean;
  consentVersion: string;
  /**
   * 사람 눈에 보이지 않는 미끼 항목. 사람이 채운 요청에서는 언제나 빈 문자열이고,
   * 폼을 기계적으로 훑는 봇만 여기에 값을 넣는다.
   */
  website: string;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  elementCounts: Record<string, number>;
};

export function toSubmissionPayload(
  draft: SubmissionDraft,
  chart: SajuChart,
  honeypot = '',
): SubmissionPayload {
  const date = parseBirthday(draft.birthday);
  const isoDate = date
    ? [
        String(date.year),
        String(date.month).padStart(2, '0'),
        String(date.day).padStart(2, '0'),
      ].join('-')
    : draft.birthday;

  return {
    name: draft.name.trim(),
    birthDate: isoDate,
    calendarType: draft.calendarType,
    birthTime: draft.unknownTime ? null : draft.birthTime,
    hourKnown: !draft.unknownTime,
    gender: draft.gender,
    university: draft.university,
    department: draft.department.trim(),
    instagram: normalizeInstagram(draft.instagram),
    studentId: draft.studentId.trim(),
    refundBank: draft.refundBank,
    refundAccount: normalizeAccountNumber(draft.refundAccount),
    consentAgreed: draft.consentAgreed,
    consentVersion: CONSENT_VERSION,
    website: honeypot,
    pillars: {
      year: chart.yearPillar.sexagenary,
      month: chart.monthPillar.sexagenary,
      day: chart.dayPillar.sexagenary,
      hour: chart.hourPillar?.sexagenary ?? null,
    },
    elementCounts: chart.elementCounts,
  };
}

/**
 * 저장 요청. 실패해도 예외를 던지지 않는다. 풀이 화면은 저장과 무관하게 떠야 한다.
 */
export async function saveSubmission(
  draft: SubmissionDraft,
  chart: SajuChart,
  honeypot = '',
): Promise<{ ok: boolean; closed?: boolean; error?: string }> {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toSubmissionPayload(draft, chart, honeypot)),
    });

    if (!response.ok) {
      // 마감 뒤 요청은 서버가 403 과 closed 로 거절한다. 일반 실패와 안내를 달리한다.
      const payload = (await response.json().catch(() => null)) as {
        closed?: unknown;
      } | null;

      return {
        ok: false,
        closed: response.status === 403 && payload?.closed === true,
        error: `서버 응답 ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
