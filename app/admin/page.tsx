'use client';

/**
 * 관리자 신청서 목록.
 *
 * 이 화면에는 실명과 생년월일이 그대로 뜬다. 인증은 서버가 한다. 여기서는
 * 401 이 오면 로그인 폼을 보여 줄 뿐이고, 데이터는 세션이 유효할 때만 내려온다.
 */

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getUniversityLabel } from '@/lib/wolyung-flow';

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
  /** 서버가 계좌번호 뒤 4자리만 내려보낸다. 전체 번호는 CSV 에만 있다. */
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

type Status = 'checking' | 'locked' | 'ready';

/** 한 쪽에 보여 줄 행 수. 서버의 기본값과 맞춰 둔다. */
const PAGE_SIZE = 100;

const EXPORT_URL = '/api/admin/submissions?format=csv';

export default function AdminPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [rows, setRows] = useState<readonly SubmissionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (nextOffset: number) => {
    const response = await fetch(
      `/api/admin/submissions?limit=${PAGE_SIZE}&offset=${nextOffset}`,
    );

    if (response.status === 401) {
      setStatus('locked');
      return;
    }

    const payload = (await response.json()) as {
      ok: boolean;
      rows?: SubmissionRow[];
      total?: number;
      error?: string;
    };

    if (!payload.ok) {
      setStatus('locked');
      setMessage(payload.error ?? '불러오지 못했습니다.');
      return;
    }

    setRows(payload.rows ?? []);
    setTotal(payload.total ?? 0);
    setOffset(nextOffset);
    setMessage('');
    setStatus('ready');
  }, []);

  // 이미 로그인된 세션이 있으면 비밀번호를 다시 묻지 않도록 마운트할 때 한 번 확인한다.
  // 이 한 번의 setState 로 'checking' → 'locked' | 'ready' 렌더가 한 번 더 도는데,
  // 관리자 혼자 쓰는 화면이라 그대로 두었다.
  useEffect(() => {
    void load(0);
  }, [load]);

  const signIn = async () => {
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!payload.ok) {
        setMessage(payload.error ?? '로그인에 실패했습니다.');
        return;
      }

      setPassword('');
      await load(0);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setRows([]);
    setTotal(0);
    setOffset(0);
    setStatus('locked');
  };

  const remove = async (row: SubmissionRow) => {
    const confirmed = window.confirm(
      `@${row.instagram} (${row.name}) 의 신청서를 지웁니다. 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    await fetch(
      `/api/admin/submissions?instagram=${encodeURIComponent(row.instagram)}`,
      { method: 'DELETE' },
    );

    // 마지막 쪽의 마지막 행을 지웠으면 빈 쪽이 남으므로 한 쪽 앞으로 물러난다.
    const wasLastOnPage = rows.length === 1 && offset > 0;

    await load(wasLastOnPage ? offset - PAGE_SIZE : offset);
  };

  return (
    <main className="admin-page">
      {/* 신청자 정보가 담긴 화면이라 검색엔진에 남으면 안 된다. */}
      <meta name="robots" content="noindex, nofollow" />

      <header className="admin-header">
        <h1 className="admin-title">신청서 관리</h1>
        {status === 'ready' && (
          <button type="button" onClick={signOut} className="admin-signout">
            로그아웃
          </button>
        )}
      </header>

      {status === 'checking' && (
        <p className="admin-note">확인하는 중입니다…</p>
      )}

      {status === 'locked' && (
        <form
          className="admin-login"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <label className="admin-label" htmlFor="admin-password">
            관리자 비밀번호
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="admin-input"
          />
          <Button type="submit" disabled={busy} className="admin-submit">
            {busy ? '확인 중…' : '들어가기'}
          </Button>
          {message && <p className="admin-error">{message}</p>}
        </form>
      )}

      {status === 'ready' && (
        <>
          <p className="admin-note">
            총 {total}건
            {total > 0 && (
              <>
                {' '}
                중 {offset + 1}–{offset + rows.length}번째
              </>
            )}
            . 최근 신청 순입니다. 보유 기간은 매칭 종료 후 6개월이며, 삭제
            요청이 오면 이 화면에서 바로 지울 수 있습니다.
          </p>

          {/*
            모집을 닫고 한 번에 매칭을 돌리는 방식이라, 그때 전체를 빼내는
            창구가 필요하다. 백업도 겸한다.
          */}
          <div className="admin-toolbar">
            <a href={EXPORT_URL} download className="admin-export">
              CSV 내보내기 (전체 {total}건)
            </a>
            <span className="admin-toolbar-note">
              실명과 생년월일이 담긴 파일입니다. 내려받은 뒤 관리에 주의하세요.
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="admin-note">아직 신청서가 없습니다.</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">신청 시각</th>
                    <th scope="col">이름</th>
                    <th scope="col">인스타</th>
                    <th scope="col">성별</th>
                    <th scope="col">학교</th>
                    <th scope="col">학과</th>
                    <th scope="col">학번</th>
                    <th scope="col">환불 계좌</th>
                    <th scope="col">생년월일</th>
                    <th scope="col">태어난 시간</th>
                    <th scope="col">사주</th>
                    <th scope="col">동의</th>
                    <th scope="col">파기</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.instagram}>
                      <td>{row.created_at.slice(0, 16).replace('T', ' ')}</td>
                      <td>{row.name}</td>
                      <td>@{row.instagram}</td>
                      <td>{row.gender === 'male' ? '남' : '여'}</td>
                      <td>
                        {row.university
                          ? getUniversityLabel(row.university)
                          : '—'}
                      </td>
                      <td>{row.department ?? '—'}</td>
                      <td>{row.student_id ?? '—'}</td>
                      <td>
                        {row.refund_bank
                          ? `${row.refund_bank} ····${row.refund_account_last4 ?? ''}`
                          : '—'}
                      </td>
                      <td>{row.birth_date}</td>
                      <td>{row.hour_known ? row.birth_time : '모름'}</td>
                      <td className="admin-pillars">
                        {[
                          row.hour_pillar ?? '—',
                          row.day_pillar,
                          row.month_pillar,
                          row.year_pillar,
                        ].join(' ')}
                      </td>
                      <td>{row.consent_version ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          className="admin-delete"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > PAGE_SIZE && (
            <nav className="admin-pager" aria-label="신청서 쪽 이동">
              <button
                type="button"
                onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="admin-page-button"
              >
                이전
              </button>
              <span className="admin-page-state">
                {Math.floor(offset / PAGE_SIZE) + 1} /{' '}
                {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                type="button"
                onClick={() => void load(offset + PAGE_SIZE)}
                disabled={offset + rows.length >= total}
                className="admin-page-button"
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
