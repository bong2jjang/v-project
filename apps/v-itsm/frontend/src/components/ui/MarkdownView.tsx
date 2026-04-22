/**
 * MarkdownView — 마크다운을 읽기 전용 HTML로 렌더링.
 *
 * RichEditor 와 동일한 TipTap 파이프라인을 재사용하여 서식(이미지/링크/목록)이
 * 작성 시점과 동일하게 표시되도록 한다.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { useEffect } from "react";

interface MarkdownViewProps {
  value: string | null | undefined;
  className?: string;
  emptyFallback?: React.ReactNode;
}

export function MarkdownView({
  value,
  className,
  emptyFallback = "-",
}: MarkdownViewProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: true, autolink: true }),
      Markdown.configure({ html: false, tightLists: true }),
    ],
    content: value || "",
    editable: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none text-body-base ${className ?? ""}`,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(value || "", false);
  }, [value, editor]);

  if (!value || value.trim() === "") {
    return <div className="text-sm text-content-secondary">{emptyFallback}</div>;
  }

  return <EditorContent editor={editor} />;
}

export default MarkdownView;
