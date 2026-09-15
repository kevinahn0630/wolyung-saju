-- 학번과 환불 계좌.
--
-- 인스타그램 아이디 단계에서 함께 받는다. 계좌번호는 하이픈을 걷어 낸 숫자만 넣는다.
--
-- 이 열이 생기기 전에 들어온 신청서가 있어 NOT NULL 을 걸지 않는다. 지금 폼은
-- 셋 다 필수로 받고, 서버도 빠진 요청을 400 으로 돌려보낸다.
--
-- 환불 계좌는 환불이 끝나거나 환불할 일이 없어지면 지체 없이 지운다고 고지했다.
-- 관리자 목록에는 뒤 4자리만 내려보내고, 전체 번호는 CSV 내보내기에서만 나간다.
--
-- 저장 API 가 첫 요청 때 빠진 열을 스스로 붙이므로, 이 파일은 기록과 수동 적용용이다.

ALTER TABLE submissions ADD COLUMN student_id TEXT;
ALTER TABLE submissions ADD COLUMN refund_bank TEXT;
ALTER TABLE submissions ADD COLUMN refund_account TEXT;
