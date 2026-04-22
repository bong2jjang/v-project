/**
 * RichEditor — TipTap 기반 마크다운 리치 에디터
 *
 * - 마크다운 직렬화(tiptap-markdown)로 value/onChange 는 markdown 문자열
 * - 이미지 붙여넣기/드롭/툴바 버튼 → /api/uploads/image 업로드 후 URL 삽입
 * - 플랫폼 승격 후보: 2개 이상 앱에서 사용할 경우 @v-platform/core 로 이관
 */

import {
  EditorContent,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Link2,
  Image as ImageIcon,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { apiClient } from "@v-platform/core/api/client";

interface RichEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  minHeight?: number;
}

interface UploadImageResponse {
  url: string;
}

async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<UploadImageResponse>(
    "/api/uploads/image",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.url;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-input transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-brand-primary/10 text-brand-primary"
          : "text-content-secondary hover:bg-surface-raised hover:text-content-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  onPickImage,
}: {
  editor: Editor;
  onPickImage: () => void;
}) {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line-soft bg-surface-raised/50 px-2 py-1">
      <ToolbarButton
        title="굵게"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="기울임"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="H3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line-soft" />
      <ToolbarButton
        title="순서 없는 목록"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="순서 있는 목록"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="인용"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="코드"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line-soft" />
      <ToolbarButton
        title="링크"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="이미지 업로드" onClick={onPickImage}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-line-soft" />
      <ToolbarButton
        title="실행 취소"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="다시 실행"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  disabled,
  label,
  required,
  helperText,
  error,
  minHeight = 160,
}: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "내용을 입력하세요…",
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        transformPastedText: true,
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-3 py-2 focus:outline-none text-body-base",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        void insertFiles(images);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? [],
        );
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        void insertFiles(images);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md =
        (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
        "";
      onChange(md);
    },
  });

  const insertFiles = useCallback(
    async (files: File[]) => {
      if (!editor) return;
      for (const file of files) {
        try {
          const url = await uploadImage(file);
          editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("이미지 업로드 실패", err);
          window.alert(
            `이미지 업로드 실패: ${file.name}\n${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    },
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown;
    const currentMd = storage?.getMarkdown() ?? "";
    if (value !== currentMd) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length > 0) await insertFiles(images);
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-heading-sm text-content-primary">
          {label}
          {required && <span className="ml-1 text-status-danger">*</span>}
        </label>
      )}
      <div
        className={`overflow-hidden rounded-input border bg-surface-default ${
          error ? "border-status-danger" : "border-line-heavy"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {editor && <Toolbar editor={editor} onPickImage={handlePickImage} />}
        <div style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <p className="text-body-sm text-status-danger">{error}</p>}
      {helperText && !error && (
        <p className="text-body-sm text-content-secondary">{helperText}</p>
      )}
    </div>
  );
}

export default RichEditor;
