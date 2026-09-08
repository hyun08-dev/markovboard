/**
 * inline-build.ts — 빌드 산출물을 **파일 하나**로 합친다.
 *
 * Vercel 은 `dist/` 를 그대로 서빙하면 되지만, 링크 하나로 공유하거나 오프라인에서
 * 열어 보려면 자기완결적인 HTML 이 편하다. 외부 요청이 전혀 없으므로 파일을 열기만
 * 하면 동작한다.
 *
 *   npm run build && npm run inline
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const assets = readdirSync('dist/assets');
const jsName = assets.find((name) => name.endsWith('.js'));
const cssName = assets.find((name) => name.endsWith('.css'));
if (jsName === undefined || cssName === undefined) throw new Error('dist/assets 에서 번들을 찾지 못했습니다. 먼저 npm run build 를 실행하세요.');

const css = readFileSync(`dist/assets/${cssName}`, 'utf8');
// 번들 안의 문자열에 </script> 가 들어 있으면 인라인 스크립트가 거기서 끊긴다.
const js = readFileSync(`dist/assets/${jsName}`, 'utf8').replaceAll('</script', '<\\/script');

const html = `<title>MarkovBoard</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

writeFileSync('dist/markovboard.html', html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`dist/markovboard.html  ${kb} KB  (외부 요청 없음)`);
