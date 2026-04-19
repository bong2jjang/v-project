/**
 * 코드블록의 lang/path 힌트로부터 Sandpack 가상 경로를 추정.
 *
 * LLM 응답 파싱은 react-markdown 이 담당하고, CodeCard 는 header 의 편집 가능한
 * path 입력의 기본값만 필요로 한다. 이 함수는 그 기본값을 제공한다.
 */

export function inferPath(language: string, path?: string): string {
  if (path) return path.startsWith("/") ? path : `/${path}`;
  switch (language) {
    case "tsx":
    case "jsx":
    case "typescript":
    case "ts":
      return "/App.tsx";
    case "javascript":
    case "js":
      return "/App.js";
    case "css":
      return "/styles.css";
    case "html":
      return "/public/index.html";
    case "json":
      return "/data.json";
    default:
      return "/App.tsx";
  }
}
