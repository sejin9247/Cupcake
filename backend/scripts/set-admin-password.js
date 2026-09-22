/* 관리자 비밀번호 설정: npm run set-password
   입력한 비밀번호는 화면에 보이지 않고, 원문 대신 scrypt 해시만 .env의 ADMIN_PASSWORD_HASH에 저장한다.
   배포(Vercel)에서는 이 해시 값을 Vercel 환경 변수 ADMIN_PASSWORD_HASH에 넣는다 (코드·git에는 넣지 않음).
   (터미널이 아닌 곳에서 실행하면 표준 입력의 첫 줄을 비밀번호로 쓴다) */
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { hashPassword } from '../src/utils/password.js';

const ENV = fileURLToPath(new URL('../.env', import.meta.url));
const EXAMPLE = fileURLToPath(new URL('../.env.example', import.meta.url));
const MIN_LENGTH = 4;
const RECOMMENDED_LENGTH = 12;

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = s => { if (!muted) rl.output.write(s); else if (s.includes('\n')) rl.output.write('\n'); };
    rl.question(question, answer => { rl.close(); resolve(answer); });
    muted = true;
  });
}

async function readStdinLine() {
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { rl.close(); return line; }
  return '';
}

let password;
if (process.stdin.isTTY) {
  password = await askHidden('새 관리자 비밀번호: ');
  const again = await askHidden('한 번 더 입력: ');
  if (password !== again) { console.error('두 비밀번호가 다릅니다. 다시 실행하세요.'); process.exit(1); }
} else {
  password = await readStdinLine();
}

if (password.length < MIN_LENGTH) {
  console.error(`비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
  process.exit(1);
}
if (password.length < RECOMMENDED_LENGTH || /^\d+$/.test(password)) {
  console.warn(`⚠ 짧거나 숫자로만 된 비밀번호는 추측하기 쉽습니다. ${RECOMMENDED_LENGTH}자 이상, 글자와 숫자를 섞는 것을 권장합니다.`);
}

const line = `ADMIN_PASSWORD_HASH=${await hashPassword(password)}`;
if (!existsSync(ENV)) await copyFile(EXAMPLE, ENV);
const env = await readFile(ENV, 'utf8');
const next = /^ADMIN_PASSWORD_HASH=.*$/m.test(env)
  ? env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line)
  : env.replace(/\s*$/, '\n') + line + '\n';
await writeFile(ENV, next, 'utf8');

console.log('✔ 관리자 비밀번호를 설정했습니다 (.env에는 해시만 저장됨).');
console.log('  실행 중인 서버가 있다면 껐다가 다시 켜야 적용됩니다.');
