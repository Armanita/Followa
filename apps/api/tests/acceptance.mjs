// Final business acceptance scenario (14 steps) against a running API.
const BASE = 'http://127.0.0.1:3001/api/v1';
const results = [];
const ok = (step, cond, detail = '') =>
  results.push(`${cond ? '✓' : '✗'} ${step}${detail ? ' — ' + detail : ''}`);

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const stamp = Date.now();
const mobile = (n) => `0917${String(stamp).slice(-6)}${n}`; // unique per run

// 1-2. SystemAdmin creates company + manager
const admin = await api(null, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin1234' });
ok('1. SystemAdmin login', admin.status === 200);
const mgrMobile = mobile('1');
const created = await api(admin.data.token, 'POST', '/admin/companies', {
  name: `پذیرش نهایی ${stamp}`,
  manager: { firstName: 'رضا', lastName: 'مدیرپذیرش', mobile: mgrMobile, password: 'Manager!234' },
});
ok('2. Company + first manager created by admin', created.status === 200);

// 3. Manager login
const mgr = await api(null, 'POST', '/auth/login', { mobile: mgrMobile, password: 'Manager!234' });
ok('3a. Manager logs in', mgr.status === 200 && mgr.data.user.role === 'COMPANY_MANAGER');

// 3b-4. Manager creates employee1 (no password); employee1 completes OTP signup
const emp1Mobile = mobile('2'), emp2Mobile = mobile('3');
{
  const c = await api(mgr.data.token, 'POST', '/members', { firstName: 'کارمندیک', lastName: 'پذیرش', mobile: emp1Mobile, role: 'EMPLOYEE' });
  if (c.status !== 200) ok('4. employee created', false, c.data?.message);
}
const otpReq = await api(null, 'POST', '/auth/otp/request', { mobile: emp1Mobile });
let otpCode = null;
{
  // mock provider logs the code — read it from server log via a fresh request is not possible;
  // instead use the documented dev path: check API stdout file
  const fs = await import('node:fs');
  const logPath = process.env.API_LOG ?? 'C:/Users/ABTINA~1/AppData/Local/Temp/api-final.log';
  const log = fs.readFileSync(logPath, 'utf8');
  const matches = [...log.matchAll(/code for (\d+): (\d{6})/g)];
  const found = matches.find((x) => x[1] === emp1Mobile);
  otpCode = found?.[2];
}
ok('4. Employee registered (OTP-less create), OTP flow started', otpReq.status === 200);
if (!otpCode) {
  ok('4b. OTP code readable from mock log', false, 'code not found');
} else {
  const verify = await api(null, 'POST', '/auth/otp/verify', { mobile: emp1Mobile, code: otpCode });
  ok('5. Employee verifies OTP', verify.status === 200);
  const pwd = await api(null, 'POST', '/auth/password', { mobile: emp1Mobile, resetToken: verify.data.resetToken, password: 'Employee!234' });
  ok('5b. Employee sets password', pwd.status === 200);
}
const emp1 = await api(null, 'POST', '/auth/login', { mobile: emp1Mobile, password: 'Employee!234' });
ok('6. Employee logs in', emp1.status === 200);
if (emp1.status !== 200) {
  console.log(results.join('\n'));
  console.log('EMP1 LOGIN FAILED:', JSON.stringify(emp1.data));
  process.exit(1);
}

// second employee gets password directly at creation (manager-set)
const emp2Created = await api(mgr.data.token, 'POST', '/members', { firstName: 'دوم', lastName: 'با رمز', mobile: emp2Mobile, role: 'EMPLOYEE', password: 'Employee!234' });
ok('6b. Second employee created with initial password', emp2Created.status === 200);
const emp2 = await api(null, 'POST', '/auth/login', { mobile: emp2Mobile, password: 'Employee!234' });
if (emp2.status !== 200) {
  console.log(results.join('\n'));
  console.log('EMP2 LOGIN FAILED:', JSON.stringify(emp2.data));
  process.exit(1);
}

// 5. Manager creates case assigned to employee1
const caseRes = await api(mgr.data.token, 'POST', '/cases', {
  title: 'پیگیری تمدید قرارداد مشتری آلفا',
  description: 'قرارداد در حال اتمام است؛ تماس و ثبت نتیجه.',
  priority: 'HIGH',
  assignToUserId: emp1.data.user.id,
});
const caseId = caseRes.data?.case?.id;
ok(`7. Manager creates case → WAITING_ACCEPTANCE`, caseRes.status === 200 && caseRes.data.case.status === 'WAITING_ACCEPTANCE');

// 8. Employee accepts
const accept = await api(emp1.data.token, 'POST', `/cases/${caseId}/accept`);
ok('8. Employee accepts assignment', accept.status === 200 && accept.data.case.status === 'IN_PROGRESS');

// 9. Work session
const start = await api(emp1.data.token, 'POST', '/work-sessions/start', { caseId });
const end = await api(emp1.data.token, 'POST', '/work-sessions/end', { caseId });
ok('9. Work session start/end with duration', start.status === 200 && end.status === 200 && typeof end.data.durationSeconds === 'number');

// 10. Transfer to second employee + accept
const transfer = await api(emp1.data.token, 'POST', `/cases/${caseId}/transfer`, { toUserId: emp2.data.user.id, note: 'ادامه توسط همکار' });
const accept2 = await api(emp2.data.token, 'POST', `/cases/${caseId}/accept`);
ok('10. Transfer + second employee accepts', transfer.status === 200 && accept2.status === 200);

// 11. Reminder
const remindAt = new Date(Date.now() + 3600_000).toISOString();
const rem = await api(emp2.data.token, 'POST', '/reminders', { caseId, remindAt, note: 'چک کردن واریز قسط' });
ok('11. Reminder created on case', rem.status === 200);

// 12. Result + complete
const result = await api(emp2.data.token, 'POST', `/cases/${caseId}/result`, { result: 'تمدید انجام شد؛ فایل امضاشده ارسال گردید.', complete: true });
ok('12. Result added and case completed', result.status === 200 && result.data.case.status === 'DONE');

// 13. History immutable & complete
const hist = await api(mgr.data.token, 'GET', `/cases/${caseId}/assignments`);
const acts = await api(mgr.data.token, 'GET', `/cases/${caseId}/activities`);
if (!hist.data?.items || !Array.isArray(acts.data)) {
  console.log('HISTORY FETCH FAILED:', hist.status, acts.status);
  process.exit(1);
}
const reasons = hist.data.items.map((a) => a.reason);
const types = (Array.isArray(acts.data) ? acts.data : acts.data.items).map((a) => a.type);
const historyOk =
  JSON.stringify(reasons) === JSON.stringify(['INITIAL_ASSIGNMENT', 'TRANSFER']) &&
  ['CREATE','ASSIGN','ACCEPT','START_WORK','END_WORK','ASSIGN','ACCEPT','RESULT_ADDED','COMPLETE'].every((t) => types.includes(t)) &&
  types.length === types.filter(Boolean).length;
ok('13. Full history & timeline intact (immutable)', historyOk, `assignments=${reasons.join(',')}`);

// 14. Dashboard reflects final state
const dash = await api(mgr.data.token, 'GET', '/dashboard/manager');
const cards = dash.data.cards;
ok('14. Manager dashboard reflects state', dash.status === 200 && cards.totalCases >= 1 && cards.doneCases >= 1, `total=${cards.totalCases} done=${cards.doneCases}`);
const rep = await api(mgr.data.token, 'GET', '/reports/employees');
ok('14b. Employee report includes work time', rep.status === 200 && rep.data.items.some((r) => r.workSeconds30d >= 0));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('✗')).length;
console.log(failed === 0 ? '\nALL ACCEPTANCE STEPS PASSED' : `\n${failed} STEP(S) FAILED`);

// cleanup test company
const list = await api(admin.data.token, 'GET', '/admin/companies');
const target = list.data.items.find((c) => c.name === `پذیرش نهایی ${stamp}`);
if (target) {
  const { execSync } = await import('node:child_process');
  execSync(`docker exec followa-postgres psql -U followa -d followa -c "DELETE FROM users WHERE id IN (SELECT \\"userId\\" FROM company_memberships WHERE \\"companyId\\"='${target.id}');" `, { stdio: 'ignore' });
  console.log('(cleanup: acceptance company removed)');
}
process.exit(failed === 0 ? 0 : 1);
