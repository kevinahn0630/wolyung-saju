/**
 * 사주 소개팅 신청서를 D1 에 저장한다.
 *
 * 나중에 매칭 쿼리를 바로 걸 수 있도록, 원본 입력과 함께 계산된 사주 네 기둥과
 * 오행 분포도 같이 넣어 둔다.
 *
 * 같은 인스타그램 아이디로 다시 제출하면 기존 행을 덮어쓴다.
 *
 * 공개된 엔드포인트라 세 겹으로 막는다.
 * 1. 개인정보 수집·이용에 동의하지 않은 요청은 받지 않는다.
 * 2. 사람 눈에 보이지 않는 미끼 항목이 채워져 오면 단순 봇으로 본다.
 * 3. 같은 IP 에서 한 시간에 보낼 수 있는 횟수를 제한한다.
 */

import { env } from 'cloudflare:workers';

import { CONSENT_VERSION } from '@/lib/consent';
import { UNIVERSITIES } from '@/lib/wolyung-flow';

/** vite.config.ts 가 `.openai/hosting.json` 의 `d1` 값으로 만드는 바인딩 이름. */
const D1_BINDING = 'DB';

/** 같은 IP 에서 한 시간에 받아 줄 제출 횟수. */
const RATE_LIMIT_PER_HOUR = 5;

/** 제출 기록을 남겨 두는 기간. 이보다 오래된 기록은 지운다. */
const ATTEMPT_RETENTION_HOURS = 24;

/**
 * IP 해시에 섞는 고정 값.
 *
 * IPv4 는 경우의 수가 적어서 해시만으로는 되돌릴 수 있다. 이 값은 익명화가
 * 아니라 원문 IP 를 그대로 적재하지 않기 위한 것이다.
 */
const IP_HASH_SALT = 'wolyung-saju/submission-rate-limit';

const CREATE_SUBMISSIONS_SQL =
  'CREATE TABLE IF NOT EXISTS submissions (' +
  'id TEXT PRIMARY KEY, ' +
  'instagram_key TEXT NOT NULL UNIQUE, ' +
  'created_at TEXT NOT NULL, ' +
  'updated_at TEXT NOT NULL, ' +
  'name TEXT NOT NULL, ' +
  'birth_date TEXT NOT NULL, ' +
  'calendar_type TEXT NOT NULL, ' +
  'birth_time TEXT, ' +
  'hour_known INTEGER NOT NULL, ' +
  'gender TEXT NOT NULL, ' +
  'instagram TEXT NOT NULL, ' +
  'year_pillar TEXT NOT NULL, ' +
  'month_pillar TEXT NOT NULL, ' +
  'day_pillar TEXT NOT NULL, ' +
  'hour_pillar TEXT, ' +
  'element_counts TEXT NOT NULL, ' +
  'consent_version TEXT, ' +
  'consent_agreed_at TEXT, ' +
  'university TEXT, ' +
  'department TEXT)';

const CREATE_ATTEMPTS_SQL =
  'CREATE TABLE IF NOT EXISTS submission_attempts (' +
  'ip_hash TEXT NOT NULL, ' +
  'created_at TEXT NOT NULL)';

const CREATE_INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_submissions_gender ON submissions(gender)',
  'CREATE INDEX IF NOT EXISTS idx_submissions_day_pillar ON submissions(day_pillar)',
  'CREATE INDEX IF NOT EXISTS idx_attempts_ip_time ON submission_attempts(ip_hash, created_at)',
];

/**
 * 나중에 늘어난 열.
 *
 * SQLite 에는 "없으면 추가" 문법이 없어서, 현재 열 목록을 읽고 빠진 것만 붙인다.
 */
const LATER_COLUMNS: readonly { name: string; definition: string }[] = [
  { name: 'consent_version', definition: 'TEXT' },
  { name: 'consent_agreed_at', definition: 'TEXT' },
  { name: 'university', definition: 'TEXT' },
  { name: 'department', definition: 'TEXT' },
];

/** 받는 학교. 화면과 어긋나지 않도록 화면이 쓰는 표에서 그대로 만든다. */
const ALLOWED_UNIVERSITIES: ReadonlySet<string> = new Set(
  UNIVERSITIES.map((item) => item.value),
);

const UPSERT_SQL = `
INSERT INTO submissions (
  id, instagram_key, created_at, updated_at, name, birth_date, calendar_type,
  birth_time, hour_known, gender, instagram,
  year_pillar, month_pillar, day_pillar, hour_pillar, element_counts,
  consent_version, consent_agreed_at, university, department
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(instagram_key) DO UPDATE SET
  updated_at = excluded.updated_at,
  name = excluded.name,
  birth_date = excluded.birth_date,
  calendar_type = excluded.calendar_type,
  birth_time = excluded.birth_time,
  hour_known = excluded.hour_known,
  gender = excluded.gender,
  instagram = excluded.instagram,
  year_pillar = excluded.year_pillar,
  month_pillar = excluded.month_pillar,
  day_pillar = excluded.day_pillar,
  hour_pillar = excluded.hour_pillar,
  element_counts = excluded.element_counts,
  consent_version = excluded.consent_version,
  consent_agreed_at = excluded.consent_agreed_at,
  university = excluded.university,
  department = excluded.department`;

/** 스키마 준비는 아이솔레이트마다 한 번만 한다. */
let schemaReady: Promise<void> | null = null;

function ensureSchema(database: D1Database): Promise<void> {
  schemaReady ??= (async () => {
    await database.exec(CREATE_SUBMISSIONS_SQL);
    await database.exec(CREATE_ATTEMPTS_SQL);

    for (const statement of CREATE_INDEX_SQL) {
      await database.exec(statement);
    }

    const columns = await database
      .prepare('SELECT name FROM pragma_table_info(?)')
      .bind('submissions')
      .all<{ name: string }>();
    const existing = new Set(columns.results.map((row) => row.name));

    for (const column of LATER_COLUMNS) {
      if (!existing.has(column.name)) {
        await database.exec(
          `ALTER TABLE submissions ADD COLUMN ${column.name} ${column.definition}`,
        );
      }
    }
  })().catch((error: unknown) => {
    // 다음 요청에서 다시 시도할 수 있게 캐시를 비운다.
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

function getDatabase(): D1Database | null {
  const binding = (env as Record<string, unknown>)[D1_BINDING];
  return binding ? (binding as D1Database) : null;
}

async function hashClientIp(request: Request): Promise<string> {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${IP_HASH_SALT}:${ip}`),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** 최근 한 시간 제출 횟수를 세고, 넘지 않았으면 이번 시도를 기록한다. */
async function checkRateLimit(
  database: D1Database,
  ipHash: string,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(now - 60 * 60 * 1000).toISOString();

  const row = await database
    .prepare(
      'SELECT COUNT(*) AS count FROM submission_attempts WHERE ip_hash = ? AND created_at > ?',
    )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  if ((row?.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return false;
  }

  const staleBefore = new Date(
    now - ATTEMPT_RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  await database.batch([
    database
      .prepare(
        'INSERT INTO submission_attempts (ip_hash, created_at) VALUES (?, ?)',
      )
      .bind(ipHash, new Date(now).toISOString()),
    database
      .prepare('DELETE FROM submission_attempts WHERE created_at < ?')
      .bind(staleBefore),
  ]);

  return true;
}

type IncomingBody = {
  name?: unknown;
  birthDate?: unknown;
  calendarType?: unknown;
  birthTime?: unknown;
  hourKnown?: unknown;
  gender?: unknown;
  university?: unknown;
  department?: unknown;
  instagram?: unknown;
  consentAgreed?: unknown;
  consentVersion?: unknown;
  /** 사람에게는 보이지 않는 미끼 항목. 채워져 오면 봇이다. */
  website?: unknown;
  pillars?: {
    year?: unknown;
    month?: unknown;
    day?: unknown;
    hour?: unknown;
  };
  elementCounts?: unknown;
};

function asTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

export async function POST(request: Request): Promise<Response> {
  const database = getDatabase();

  if (!database) {
    return Response.json(
      {
        ok: false,
        error:
          'D1 바인딩이 없습니다. .openai/hosting.json 의 "d1" 값을 확인해 주세요.',
      },
      { status: 503 },
    );
  }

  let body: IncomingBody;

  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return Response.json(
      { ok: false, error: '본문을 읽을 수 없습니다.' },
      { status: 400 },
    );
  }

  // 미끼 항목이 채워져 있으면 봇이다. 성공한 척 돌려보내 재시도를 유도하지 않는다.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return Response.json({ ok: true }, { status: 201 });
  }

  if (body.consentAgreed !== true) {
    return Response.json(
      { ok: false, error: '개인정보 수집·이용 동의가 필요합니다.' },
      { status: 400 },
    );
  }

  const name = asTrimmedString(body.name, 40);
  const instagram = asTrimmedString(body.instagram, 30);
  const birthDate = asTrimmedString(body.birthDate, 10);
  const gender =
    body.gender === 'male' || body.gender === 'female' ? body.gender : null;
  const calendarType =
    body.calendarType === 'solar' || body.calendarType === 'lunar'
      ? body.calendarType
      : null;
  const university =
    typeof body.university === 'string' &&
    ALLOWED_UNIVERSITIES.has(body.university)
      ? body.university
      : null;
  const department = asTrimmedString(body.department, 30);
  const yearPillar = asTrimmedString(body.pillars?.year, 4);
  const monthPillar = asTrimmedString(body.pillars?.month, 4);
  const dayPillar = asTrimmedString(body.pillars?.day, 4);

  if (
    !name ||
    !instagram ||
    !birthDate ||
    !gender ||
    !calendarType ||
    !university ||
    !department ||
    !yearPillar ||
    !monthPillar ||
    !dayPillar ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !/^[A-Za-z0-9._]{1,30}$/.test(instagram)
  ) {
    return Response.json(
      { ok: false, error: '입력값이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  const hourKnown = body.hourKnown === true;
  const birthTime = hourKnown ? asTrimmedString(body.birthTime, 5) : null;
  const hourPillar = hourKnown ? asTrimmedString(body.pillars?.hour, 4) : null;
  const now = new Date().toISOString();

  try {
    await ensureSchema(database);

    const allowed = await checkRateLimit(database, await hashClientIp(request));

    if (!allowed) {
      return Response.json(
        {
          ok: false,
          error: '잠시 후 다시 시도해 주세요.',
        },
        { status: 429, headers: { 'retry-after': '3600' } },
      );
    }

    await database
      .prepare(UPSERT_SQL)
      .bind(
        crypto.randomUUID(),
        instagram.toLowerCase(),
        now,
        now,
        name,
        birthDate,
        calendarType,
        birthTime,
        hourKnown ? 1 : 0,
        gender,
        instagram,
        yearPillar,
        monthPillar,
        dayPillar,
        hourPillar,
        JSON.stringify(body.elementCounts ?? {}),
        asTrimmedString(body.consentVersion, 20) ?? CONSENT_VERSION,
        now,
        university,
        department,
      )
      .run();

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('신청서 저장 실패', error);

    return Response.json(
      { ok: false, error: '저장 중 문제가 생겼습니다.' },
      { status: 500 },
    );
  }
}
