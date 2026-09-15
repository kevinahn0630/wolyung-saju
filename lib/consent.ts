/**
 * 개인정보 수집·이용 동의 문구.
 *
 * 문구를 고치면 `CONSENT_VERSION` 도 함께 올린다. 저장된 신청서에는 동의한
 * 버전이 남으므로, 나중에 "이 사람이 무엇에 동의했는지" 를 되짚을 수 있다.
 */

/** 문구를 바꿀 때마다 올린다. 날짜 형식으로 둬서 언제 판인지 바로 보이게 했다. */
export const CONSENT_VERSION = '2026-09-15';

/**
 * 문의와 삭제 요청을 받을 창구.
 *
 * 개인정보 처리에는 연락처 고지가 필요하다. 계정을 옮기면 여기만 고치면 된다.
 */
export const CONTACT_HANDLE = '@wolyungdang';

/** 첫 화면 오른쪽 위 `문의` 버튼이 여는 안내. */
export const CONTACT_COPY = {
  buttonLabel: '문의',
  openLabel: '문의 안내 열기',
  closeLabel: '문의 안내 닫기',
  /** 아이디만 링크로 감싸므로 앞뒤를 나눠 둔다. */
  bodyBefore: '정정, 삭제 요청은 ',
  bodyAfter: ' 인스타그램 페이지를 통해 부탁드립니다.',
  handle: CONTACT_HANDLE,
  handleHref: `https://instagram.com/${CONTACT_HANDLE.slice(1)}`,
} as const;

export const CONSENT_COPY = {
  /** 체크박스 옆에 늘 보이는 한 줄. */
  checkboxLabel: '개인정보 수집·이용에 동의합니다. (필수)',
  expandLabel: '전문 보기',
  collapseLabel: '접기',
  error: '개인정보 수집·이용에 동의해 주세요.',

  title: '개인정보 수집·이용 동의',
  sections: [
    {
      heading: '수집하는 항목',
      body: '이름, 생년월일, 태어난 시간, 성별, 재학중인 대학교, 학과, 학번, 인스타그램 아이디, 환불 계좌(은행, 계좌번호)',
    },
    {
      heading: '이용 목적',
      body: '사주 기반 연애운 풀이 제공, 사주를 활용한 소개팅 상대 매칭, 재학생 여부 확인(학번), 환불 처리(환불 계좌)',
    },
    {
      heading: '제3자 제공',
      body: '매칭이 성사되면 상대방에게 회원님의 인스타그램 아이디와 재학중인 대학교, 학과가 공개됩니다. 이름, 생년월일, 태어난 시간, 학번, 환불 계좌는 상대방에게 제공하지 않습니다.',
    },
    {
      heading: '보유 및 이용 기간',
      body: '매칭 종료 후 6개월간 보관한 뒤 파기합니다. 환불 계좌는 환불이 끝나거나 환불할 일이 없어지면 지체 없이 파기합니다. 그 전에도 삭제를 요청하시면 지체 없이 파기합니다.',
    },
    {
      heading: '동의를 거부할 권리',
      body: '동의를 거부하실 수 있습니다. 다만 위 정보 없이는 사주 풀이와 매칭을 제공할 수 없어 서비스 이용이 제한됩니다.',
    },
    {
      heading: '열람·정정·삭제 요청',
      body: `인스타그램 ${CONTACT_HANDLE} 으로 연락 주시면 보관 중인 정보를 확인·수정하거나 삭제해 드립니다.`,
    },
  ],
} as const;
