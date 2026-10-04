# 상품등록 자동화 — 대시보드

React + Vite + TypeScript, Tailwind + shadcn/ui, TanStack Query.

```
npm install
npm run dev     # http://localhost:5173, /api 는 auto-app(192.168.0.41:8080)으로 프록시
npm run build
```

## 배포

auto-app 의 `/opt/autoreg/frontend` 에 두면 `/opt/autoreg/compose.yml` 의 `nginx` 서비스가
이 Dockerfile 로 빌드한다 (node 빌드 → nginx 정적 서빙 + /api·/files 프록시).
