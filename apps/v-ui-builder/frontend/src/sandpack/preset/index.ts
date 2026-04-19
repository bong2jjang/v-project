/**
 * Sandpack Shadcn Preset — S3(Sandbox 레이어) 공급.
 *
 * v-ui-builder 의 Sandpack iframe 안에 shadcn-ui 스타일 컴포넌트 15종을
 * "가상 파일" 로 주입한다. 사용자/LLM 이 생성하는 코드는 `@/components/ui/*`
 * 가 아닌 **루트 경로 `/components/ui/*`** 에서 import 한다 (Sandpack tsconfig
 * 에 path alias 를 세팅하지 않음 — 단순화). `cn()` 은 `/lib/utils.ts` 에서.
 *
 * 의도적으로 배제: 앱 본체 번들에는 한 줄도 싣지 않는다 — 모든 의존성은
 * Sandpack iframe 의 esm 번들러가 CDN/npm 에서 로딩.
 */

import { UTILS } from "./components/utils";
import { BUTTON } from "./components/button";
import { CARD } from "./components/card";
import { INPUT } from "./components/input";
import { TEXTAREA } from "./components/textarea";
import { LABEL } from "./components/label";
import { BADGE } from "./components/badge";
import { ALERT } from "./components/alert";
import { SEPARATOR } from "./components/separator";
import { AVATAR } from "./components/avatar";
import { SKELETON } from "./components/skeleton";
import { TABS } from "./components/tabs";
import { DIALOG } from "./components/dialog";
import { DROPDOWN_MENU } from "./components/dropdown-menu";
import { TOOLTIP } from "./components/tooltip";
import { TABLE } from "./components/table";

export const presetFiles: Record<string, string> = {
  "/lib/utils.ts": UTILS,
  "/components/ui/button.tsx": BUTTON,
  "/components/ui/card.tsx": CARD,
  "/components/ui/input.tsx": INPUT,
  "/components/ui/textarea.tsx": TEXTAREA,
  "/components/ui/label.tsx": LABEL,
  "/components/ui/badge.tsx": BADGE,
  "/components/ui/alert.tsx": ALERT,
  "/components/ui/separator.tsx": SEPARATOR,
  "/components/ui/avatar.tsx": AVATAR,
  "/components/ui/skeleton.tsx": SKELETON,
  "/components/ui/tabs.tsx": TABS,
  "/components/ui/dialog.tsx": DIALOG,
  "/components/ui/dropdown-menu.tsx": DROPDOWN_MENU,
  "/components/ui/tooltip.tsx": TOOLTIP,
  "/components/ui/table.tsx": TABLE,
};

export const presetDependencies: Record<string, string> = {
  "class-variance-authority": "^0.7.0",
  "tailwind-merge": "^2.5.0",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-label": "^2.1.0",
  "@radix-ui/react-separator": "^1.1.0",
  "@radix-ui/react-avatar": "^1.1.0",
  "@radix-ui/react-tabs": "^1.1.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-dropdown-menu": "^2.1.0",
  "@radix-ui/react-tooltip": "^1.1.0",
};

/**
 * LLM 시스템 프롬프트에 바로 인용 가능한 컴포넌트 카탈로그.
 * 백엔드 SYSTEM_PROMPT 에도 같은 목록을 문자열로 포함해 일관성을 유지한다.
 */
export const presetComponentCatalog: ReadonlyArray<{
  path: string;
  exports: string;
}> = [
  { path: "/components/ui/button", exports: "Button, buttonVariants" },
  { path: "/components/ui/card", exports: "Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter" },
  { path: "/components/ui/input", exports: "Input" },
  { path: "/components/ui/textarea", exports: "Textarea" },
  { path: "/components/ui/label", exports: "Label" },
  { path: "/components/ui/badge", exports: "Badge, badgeVariants" },
  { path: "/components/ui/alert", exports: "Alert, AlertTitle, AlertDescription" },
  { path: "/components/ui/separator", exports: "Separator" },
  { path: "/components/ui/avatar", exports: "Avatar, AvatarImage, AvatarFallback" },
  { path: "/components/ui/skeleton", exports: "Skeleton" },
  { path: "/components/ui/tabs", exports: "Tabs, TabsList, TabsTrigger, TabsContent" },
  { path: "/components/ui/dialog", exports: "Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose" },
  { path: "/components/ui/dropdown-menu", exports: "DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel" },
  { path: "/components/ui/tooltip", exports: "Tooltip, TooltipTrigger, TooltipContent, TooltipProvider" },
  { path: "/components/ui/table", exports: "Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption" },
];
