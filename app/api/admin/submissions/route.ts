/**
 * 관리자용 신청서 조회와 파기.
 *
 * 실명과 생년월일이 오가는 창구라 유효한 관리자 세션 없이는 아무것도 돌려주지
 * 않는다. 삭제는 동의 문구에 적어 둔 "삭제 요청" 을 실제로 이행하는 수단이다.
 *
 * `?format=csv` 로 부르면 전체를 CSV 로 내려보낸다. 매칭을 돌릴 자료를 빼내는
 * 창구다. OpenAI Sites 로 배포한 경우에는 플랫폼이 잡아 주는 D1 이라 wrangler
 * 로 붙을 수 없어서, 이것이 자료를 빼내는 유일한 수단이 된다.
 */

import { env } from 'cloudflare:workers';

import { hasValidSession } from '@/lib/admin-session';

const D1_BINDING = 'DB';

/** 화면 한 쪽에 보여 줄 기본 행 수. */
const DEFAULT_PAGE_SIZE = 100;

/** 화면이 한 번에 받아 갈 수 있는 최대 행 수. */
const MAX_PAGE_SIZE = 500;

/**
 * CSV 한 번에 내보낼 최대 행 수.
 *
 * 응답을 통째로 메모리에 쌓으므로 상한을 둔다. 이 수를 넘길 만큼 쌓이면
 * 스트리밍으로 바꿔야 한다.
 */
const MAX_EXPORT_ROWS = 10_000;

/** 화면용. 매칭에 쓰지 않는 열은 뺀다. */
const SELECT_PAGE_SQL = `
SELECT instagram, name, birth_date, birth_time, hour_known, gender,
       university, department, student_id, refund_bank,
       -- 목록 화면에는 계좌번호 뒤 4자리만 내려보낸다. 전체 번호는 CSV 에서만 나간다.
       substr(refund_account, -4) AS refund_account_last4,
       year_pillar, month_pillar, day_pillar, hour_pillar, element_counts,
       consent_version, created_at, updated_at
FROM submissions
ORDER BY created_at DESC
LIMIT ? OFFSET ?`;

/** 내보내기용. 나중에 매칭을 돌릴 때 아쉬운 열이 없도록 전부 담는다. */
const SELECT_EXPORT_SQL = `
SELECT instagram, name, birth_date, calendar_type, birth_time, hour_known,
       gender, university, department, student_id, refund_bank, refund_account,
       year_pillar, month_pillar, day_pillar, hour_pillar,
       element_counts, consent_version, consent_agreed_at, created_at, updated_at
FROM submissions
ORDER BY created_at DESC
LIMIT ?`;

const COUNT_SQL = 'SELECT COUNT(*) AS total FROM submissions';

type SubmissionRow = {
  instagram: string;
  name: string;
  birth_date: string;
  birth_time: string | null;
  hour_known: number;
  gender: string;
  university: string | null;
  department: string | null;
  student_id: string | null;
  refund_bank: string | null;
  refund_account_last4: string | null;
  year_pillar: string;
  month_pillar: string;
  day_pillar: string;
  hour_pillar: string | null;
  element_counts: string;
  consent_version: string | null;
  created_at: string;
  updated_at: string;
};

/** 이 표가 쓰는 SQLite 열 타입은 TEXT 와 INTEGER 뿐이다. */
type CsvValue = string | number | null;

/** 범위를 벗어나거나 숫자가 아니면 기본값으로 돌린다. */
function readInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function getDatabase(): D1Database | null {
  const binding = (env as Record<string, unknown>)[D1_BINDING];
  return binding ? (binding as D1Database) : null;
}

function getAdminPassword(): string | null {
  const value = (env as Record<string, unknown>).ADMIN_PASSWORD;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** 통과하면 데이터베이스를, 막히면 그대로 돌려보낼 응답을 준다. */
async function guard(
  request: Request,
): Promise<{ database: D1Database } | Response> {
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return Response.json(
      { ok: false, error: 'ADMIN_PASSWORD 가 설정되지 않았습니다.' },
      { status: 503 },
    );
  }

  if (!(await hasValidSession(request, adminPassword))) {
    return Response.json(
      { ok: false, error: '로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  const database = getDatabase();

  if (!database) {
    return Response.json(
      { ok: false, error: 'D1 바인딩이 없습니다.' },
      { status: 503 },
    );
  }

  return { database };
}

/**
 * CSV 한 칸.
 *
 * 이름에 쉼표가, 사주 메모에 줄바꿈이 들어올 수 있으므로 전부 큰따옴표로 감싸고
 * 안쪽 따옴표만 두 번씩 적는다(RFC 4180).
 */
function toCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '""';
  }

  return `"${String(value).replaceAll('"', '""')}"`;
}

function toCsv(rows: readonly Record<string, CsvValue>[]): string {
  if (rows.length === 0) {
    return '';
  }

  const columns = Object.keys(rows[0]);
  const lines = [
    columns.map(toCsvCell).join(','),
    ...rows.map((row) =>
      columns.map((column) => toCsvCell(row[column])).join(','),
    ),
  ];

  // 엑셀은 BOM 이 없으면 UTF-8 을 못 알아보고 한글을 깬다.
  return `﻿${lines.join('\r\n')}\r\n`;
}

async function exportCsv(database: D1Database): Promise<Response> {
  const result = await database
    .prepare(SELECT_EXPORT_SQL)
    .bind(MAX_EXPORT_ROWS)
    .all<Record<string, CsvValue>>();

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(toCsv(result.results), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="submissions-${stamp}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const checked = await guard(request);

  if (checked instanceof Response) {
    return checked;
  }

  const params = new URL(request.url).searchParams;

  try {
    if (params.get('format') === 'csv') {
      return await exportCsv(checked.database);
    }

    const limit = readInt(
      params.get('limit'),
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    );
    const offset = readInt(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

    const counted = await checked.database
      .prepare(COUNT_SQL)
      .first<{ total: number }>();
    const total = counted?.total ?? 0;

    const result = await checked.database
      .prepare(SELECT_PAGE_SQL)
      .bind(limit, offset)
      .all<SubmissionRow>();

    return Response.json(
      { ok: true, rows: result.results, total, limit, offset },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('신청서 조회 실패', error);

    return Response.json(
      { ok: false, error: '조회 중 문제가 생겼습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const checked = await guard(request);

  if (checked instanceof Response) {
    return checked;
  }

  const instagram = new URL(request.url).searchParams.get('instagram');

  if (!instagram) {
    return Response.json(
      { ok: false, error: '지울 대상을 지정해 주세요.' },
      { status: 400 },
    );
  }

  try {
    const result = await checked.database
      .prepare('DELETE FROM submissions WHERE instagram_key = ?')
      .bind(instagram.toLowerCase())
      .run();

    return Response.json(
      { ok: true, deleted: result.meta.changes },
      { status: 200 },
    );
  } catch (error) {
    console.error('신청서 삭제 실패', error);

    return Response.json(
      { ok: false, error: '삭제 중 문제가 생겼습니다.' },
      { status: 500 },
    );
  }
}
