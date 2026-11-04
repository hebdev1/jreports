import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Youtube from '@tiptap/extension-youtube';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  SquarePlay,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { MediaPickerDialog } from '@/admin/components/media-picker';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/admin/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { cn } from '@/admin/lib/utils';
import { readMinutes, safeHref, youtubeIdFromSrc, type RichDoc } from '@/lib/richtext';

const BLOCKS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'h4', label: 'Small heading' },
];

function extensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      code: false,
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['https', 'http', 'mailto'],
        isAllowedUri: (url) => safeHref(url) !== null,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Image.configure({ allowBase64: false }),
    Youtube.configure({ nocookie: true, modestBranding: true, width: 640, height: 360 }),
    Placeholder.configure({ placeholder }),
    CharacterCount,
  ];
}

function ToolButton({ icon: Icon, label, onClick, active, disabled }: Readonly<{ icon: LucideIcon; label: string; onClick: () => void; active?: boolean; disabled?: boolean }>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-8 shrink-0', active && 'bg-accent text-accent-foreground')}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

/** Popover with one address field, used for links and YouTube embeds. */
function AddressPopover({
  icon,
  label,
  placeholder,
  initial,
  validate,
  onApply,
  onRemove,
  active,
  disabled,
}: Readonly<{
  icon: LucideIcon;
  label: string;
  placeholder: string;
  initial: () => string;
  validate: (v: string) => string | null;
  onApply: (v: string) => void;
  onRemove?: () => void;
  active?: boolean;
  disabled?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const Icon = icon;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validate(value.trim());
    if (problem) {
      setError(problem);
      return;
    }
    onApply(value.trim());
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValue(initial());
          setError(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('size-8 shrink-0', active && 'bg-accent text-accent-foreground')} aria-label={label} title={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()}>
          <Icon className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <form onSubmit={submit} className="grid gap-2" noValidate>
          <label htmlFor={id} className="text-[13px] font-medium">
            {label}
          </label>
          <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? `${id}-err` : undefined} autoFocus />
          {error && (
            <p id={`${id}-err`} className="text-[12px] text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {onRemove && active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, disabled }: Readonly<{ editor: Editor; disabled: boolean }>) {
  const [picking, setPicking] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : e.isActive('heading', { level: 4 }) ? 'h4' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b bg-card/95 px-1.5 py-1 backdrop-blur">
      <ToolButton icon={Undo2} label="Undo" onClick={() => chain().undo().run()} disabled={disabled || !s.canUndo} />
      <ToolButton icon={Redo2} label="Redo" onClick={() => chain().redo().run()} disabled={disabled || !s.canRedo} />
      <Divider />
      <Select
        value={s.block}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === 'p') chain().setParagraph().run();
          else chain().setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-[140px] border-0 shadow-none" aria-label="Text style">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCKS.map((b) => (
            <SelectItem key={b.value} value={b.value}>
              {b.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Divider />
      <ToolButton icon={Bold} label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()} disabled={disabled} />
      <ToolButton icon={Italic} label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()} disabled={disabled} />
      <ToolButton icon={Underline} label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()} disabled={disabled} />
      <ToolButton icon={Strikethrough} label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()} disabled={disabled} />
      <ToolButton icon={Highlighter} label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()} disabled={disabled} />
      <AddressPopover
        icon={Link2}
        label="Link"
        placeholder="https://… or /episodes/ep-48"
        active={s.link}
        disabled={disabled}
        initial={() => (editor.getAttributes('link').href as string | undefined) ?? ''}
        validate={(v) => (safeHref(v) ? null : 'Use a web address (https://…), an email (mailto:…) or a page on this site (/…).')}
        onApply={(href) => {
          if (editor.state.selection.empty && !s.link) chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
          else chain().extendMarkRange('link').setLink({ href }).run();
        }}
        onRemove={() => chain().extendMarkRange('link').unsetLink().run()}
      />
      {s.link && <ToolButton icon={Link2Off} label="Remove link" onClick={() => chain().extendMarkRange('link').unsetLink().run()} disabled={disabled} />}
      <Divider />
      <ToolButton icon={AlignLeft} label="Align left" active={s.align === 'left'} onClick={() => chain().setTextAlign('left').run()} disabled={disabled} />
      <ToolButton icon={AlignCenter} label="Center" active={s.align === 'center'} onClick={() => chain().setTextAlign('center').run()} disabled={disabled} />
      <ToolButton icon={AlignRight} label="Align right" active={s.align === 'right'} onClick={() => chain().setTextAlign('right').run()} disabled={disabled} />
      <ToolButton icon={AlignJustify} label="Justify" active={s.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()} disabled={disabled} />
      <Divider />
      <ToolButton icon={List} label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()} disabled={disabled} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()} disabled={disabled} />
      <ToolButton icon={Quote} label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()} disabled={disabled} />
      <ToolButton icon={Minus} label="Divider line" onClick={() => chain().setHorizontalRule().run()} disabled={disabled} />
      <Divider />
      <ToolButton icon={ImagePlus} label="Insert image" onClick={() => setPicking(true)} disabled={disabled} />
      <AddressPopover
        icon={SquarePlay}
        label="Embed a YouTube video"
        placeholder="https://www.youtube.com/watch?v=…"
        disabled={disabled}
        initial={() => ''}
        validate={(v) => (youtubeIdFromSrc(v) ? null : 'Paste a YouTube video link.')}
        onApply={(src) => chain().setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${youtubeIdFromSrc(src)}` }).run()}
      />
      <Divider />
      <ToolButton icon={Eraser} label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()} disabled={disabled} />
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        kind="image"
        onSelect={(a) => chain().setImage({ src: a.url, alt: a.alt || a.file_name }).run()}
      />
    </div>
  );
}

/**
 * Rich-text editor for report articles. The value is TipTap JSON, or null
 * when the article is empty. Only formatting the public site can render
 * (src/components/RichText.tsx) is available.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  disabled = false,
  placeholder = 'Write the report…',
  invalid,
  describedBy,
}: Readonly<{ value: RichDoc | null; onChange: (v: RichDoc | null) => void; label: string; disabled?: boolean; placeholder?: string; invalid?: boolean; describedBy?: string }>) {
  const last = useRef<string>(JSON.stringify(value ?? null));
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: value ?? '',
    editable: !disabled,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'jr-prose min-h-[360px] px-5 py-4 focus:outline-none',
        'aria-label': label,
        'aria-multiline': 'true',
        role: 'textbox',
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      const next = e.isEmpty ? null : (e.getJSON() as RichDoc);
      last.current = JSON.stringify(next);
      onChange(next);
    },
  });

  // Outside changes (loading a revision, Cancel, Defaults) replace the content.
  useEffect(() => {
    const incoming = JSON.stringify(value ?? null);
    if (editor && incoming !== last.current) {
      last.current = incoming;
      editor.commands.setContent(value ?? '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const words = (e?.storage as { characterCount?: { words: () => number } } | undefined)?.characterCount?.words() ?? 0;
      return { words, minutes: words ? readMinutes(e?.getJSON()) : 0 };
    },
  });

  if (!editor) return null;
  return (
    <div className={cn('rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring/40', invalid && 'border-destructive')}>
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
      <div className="flex justify-between gap-2 border-t px-3 py-1.5 text-[12px] text-muted-foreground" aria-live="polite">
        <span>Select text to format it. Ctrl/⌘ + B, I and U work too.</span>
        <span>
          {counts?.words ?? 0} words{counts?.minutes ? ` · about ${counts.minutes} min read` : ''}
        </span>
      </div>
    </div>
  );
}
