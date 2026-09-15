export const FORM_STEPS = [
  'name',
  'birthday',
  'birth-time',
  'gender',
  'university',
  'instagram',
] as const;

export type CalendarType = 'solar' | 'lunar';
export type Gender = 'male' | 'female' | '';
export type FormStep = (typeof FORM_STEPS)[number];
export type FlowScreen = 'intro' | FormStep | 'loading' | 'result';
export type Direction = 'forward' | 'backward';

/**
 * 받는 학교.
 *
 * 서울권 대학 일곱 곳을 받는다. 화면 문구가 아니라 코드값을 저장하는 것은,
 * 나중에 학교로 매칭을 걸 때 표기가 흔들리지 않게 하려는 것이다. 이미 저장된
 * 행이 있으므로 기존 코드값은 바꾸지 않는다. 학교를 늘리려면 이 표에 한 줄
 * 더하면 되고, 서버 허용 목록도 이 표에서 만들어진다.
 */
export const UNIVERSITIES = [
  { value: 'snu', label: '서울대' },
  { value: 'yonsei', label: '연세대' },
  { value: 'korea', label: '고려대' },
  { value: 'sogang', label: '서강대' },
  { value: 'skku', label: '성균관대' },
  { value: 'hanyang', label: '한양대' },
  { value: 'ewha', label: '이화여대' },
] as const;

export type University = (typeof UNIVERSITIES)[number]['value'] | '';

/** 폼에서 모은 값. 저장과 사주 계산의 입력이 된다. */
export type SubmissionDraft = {
  name: string;
  /** 'YYYY.MM.DD' */
  birthday: string;
  calendarType: CalendarType;
  /** 'HH:MM'. 시간을 모르면 빈 문자열. */
  birthTime: string;
  unknownTime: boolean;
  gender: Exclude<Gender, ''>;
  /** 고르기 전에는 빈 문자열. */
  university: University;
  department: string;
  /** @ 없이 저장한다. */
  instagram: string;
  /** 개인정보 수집·이용 동의. 체크하지 않으면 제출할 수 없다. */
  consentAgreed: boolean;
};

export const HERO_COPY = {
  /**
   * 첫 화면에서 가장 먼저 읽히는 줄.
   *
   * 받는 대상을 첫 줄에 박아 두어야 자기 얘기로 읽힌다. 받는 학교가 바뀌면
   * UNIVERSITIES 와 함께 고친다.
   */
  audienceBadge: '서울권 대학생 전용',
  brand: '월영아씨',
  logoMark: '月影',
  logoText: '월영당',
  navLabel: '월영당 홈',
  imageAlt: '달빛 아래 점성술 차트를 살피는 월영당 상담가',
  title: '사주 소개팅',
  description: ['왠지 끌리는 사람에게는', '이유가 있습니다'],
  cta: '내 연분 확인하기',
} as const;

/**
 * 첫 화면의 모집 일정.
 *
 * 날짜가 바뀌면 이 표만 고치면 된다. 요일은 직접 적어 두었으니 날짜와 함께 맞춘다.
 */
export const RECRUITMENT_SCHEDULE = [
  { label: '모집 마감', value: '9/17(목) 23:59' },
  { label: '매칭 공지', value: '9/18(금) 12:00' },
] as const;

export const READING_POINTS = [
  '사주 기반 궁합',
  '관계 성향 매칭',
  '프리미엄 소개팅',
] as const;

export const HERO_FOOTER_POINTS = [
  '사주 기반 궁합',
  '프리미엄 소개팅',
] as const;

export const FORM_COPY = {
  backLabel: '이전 단계로 돌아가기',
  nextLabel: '다음으로',
  submitLabel: '풀이 시작하기',
  resetLabel: '처음으로',
  progressLabel: (current: number, total: number) =>
    `진행률 ${current}/${total}`,
} as const;

export const FIELD_COPY = {
  name: {
    label: '이름',
    placeholder: '이름을 입력해 주세요. (최대 4글자)',
    ariaLabel: '이름',
    maxLength: 4,
  },
  birthday: {
    label: '생년월일',
    placeholder: '0000.00.00',
    ariaLabel: '생년월일',
  },
  birthTime: {
    label: '태어난 시간',
    placeholder: '태어난 시간 입력 (예: 13:20)',
    ariaLabel: '태어난 시간',
    unknownLabel: '시간 모름',
  },
  gender: {
    label: '성별',
    maleLabel: '남성',
    femaleLabel: '여성',
  },
  university: {
    label: '재학중인 대학교',
    helper: '지금은 위 일곱 개 학교에서만 받고 있습니다.',
  },
  department: {
    label: '학과',
    placeholder: '학과를 입력해 주세요. (예: 경영학과)',
    ariaLabel: '학과',
    maxLength: 30,
  },
  instagram: {
    label: '인스타그램 아이디',
    placeholder: '@ 없이 입력해 주세요',
    ariaLabel: '인스타그램 아이디',
    // 인스타그램 규칙: 영문·숫자·마침표·밑줄, 최대 30자.
    maxLength: 30,
    helper: '연분이 닿으면 이 아이디로 서로를 이어 드립니다.',
  },
  calendar: {
    solarLabel: '양력',
    lunarLabel: '음력',
    // 음력→양력 변환은 아직 붙이지 않았다. 붙일 때 이 안내를 지우면 된다.
    lunarPendingLabel: '준비 중',
    lunarPendingNote:
      '음력 변환은 준비 중입니다. 지금은 양력으로 입력해 주세요.',
  },
} as const;

export const RESULT_COPY = {
  loading: {
    title: '풀이를 준비하고 있습니다',
    body: '입력해주신 생년월일의 결을 살피는 중입니다.',
  },
  chart: {
    title: '사주 원국',
    caption: '태어난 순간의 기운을 여덟 글자로 세운 것입니다.',
    stemLabel: '천간',
    branchLabel: '지지',
    unknownHour: '시간 미상',
    unknownHourNote:
      '태어난 시간을 몰라 시주를 비웠습니다. 나머지 여섯 글자로 풀이했습니다.',
  },
  reading: {
    title: '연애운 풀이',
    caption: '화두를 눌러 자세한 풀이를 펼쳐 보세요.',
  },
  cta: {
    label: '운명의 상대 찾기',
    note: '입력하신 정보는 매칭에만 씁니다.',
  },
  disclaimer:
    '사주 풀이는 재미로 보는 참고 자료입니다. 중요한 결정은 스스로 내려 주세요.',
} as const;

const ERROR_MESSAGES = {
  name: '필수 항목입니다.',
  birthday: '생년월일 8자리를 입력해 주세요.',
  'birth-time': '태어난 시간을 입력하거나 시간 모름을 선택해 주세요.',
  gender: '성별을 선택해 주세요.',
  university: '재학중인 대학교를 선택해 주세요.',
  instagram: '인스타그램 아이디를 입력해 주세요.',
  loading: '필수 항목입니다.',
  result: '필수 항목입니다.',
} satisfies Record<Exclude<FlowScreen, 'intro'>, string>;

export function getErrorMessage(screen: Exclude<FlowScreen, 'intro'>) {
  return ERROR_MESSAGES[screen];
}

/** 형식은 맞았지만 값이 말이 안 될 때 쓰는 문구. */
export const DETAIL_ERROR_MESSAGES = {
  birthdayNotReal: '실제로 있는 날짜를 입력해 주세요.',
  birthTimeRange: '00:00 부터 23:59 사이로 입력해 주세요.',
  departmentRequired: '학과를 입력해 주세요.',
  instagramFormat: '영문·숫자·마침표·밑줄만 쓸 수 있습니다.',
} as const;

/** 저장된 코드값을 화면에 보여 줄 이름으로 바꾼다. */
export function getUniversityLabel(value: string): string {
  return UNIVERSITIES.find((item) => item.value === value)?.label ?? value;
}
