import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /*
   * 상대 경로 기준(base: './')으로 빌드한다.
   *
   * Vercel 은 루트(/)에서, GitHub Pages 프로젝트 사이트는 하위 경로
   * (/<저장소 이름>/)에서 서빙한다. 절대 경로로 빌드하면 둘 중 한쪽에서 에셋이
   * 404 가 난다. 이 앱은 클라이언트 라우팅 없이 쿼리 문자열만 쓰므로 상대 경로가
   * 어디에 올려도 그대로 동작한다. 파일을 직접 열어도(file://) 마찬가지다.
   */
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
