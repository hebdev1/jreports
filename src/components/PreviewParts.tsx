import { useEffect } from 'react';
import { sx } from '../lib/sx';

// Shared pieces of the team-only draft previews (?preview=1).

/** Previews are never indexed. */
export function usePreviewNoindex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export function previewLabel(publication: 'draft' | 'published' | 'archived', hasChanges: boolean, noun: string): string {
  if (publication === 'published') return hasChanges ? 'Preview of unpublished changes. Visitors still see the published version.' : `This ${noun} is live. This preview matches what visitors see.`;
  if (publication === 'archived') return `Preview of an archived ${noun}. Visitors can’t see it.`;
  return `Preview of a draft. Visitors can’t see this ${noun} until it’s published.`;
}

export function PreviewBanner({ label, editorHref }: Readonly<{ label: string; editorHref: string }>) {
  return (
    <div role="status" style={sx('background:#FFF4E5;color:#0B1F5C;border-bottom:1px solid #F3D9B1;font-size:14px')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:10px 32px;display:flex;gap:12px;align-items:center;flex-wrap:wrap')}>
        <b style={sx('font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#B4231F')}>Preview</b>
        <span style={{ flex: 1, minWidth: 220 }}>{label}</span>
        <a href={editorHref} style={sx('font-weight:600;border-bottom:1px solid #0B1F5C')}>
          Back to the editor
        </a>
      </div>
    </div>
  );
}

export function SignInToPreview({ what }: Readonly<{ what: string }>) {
  return (
    <section className="wrap" style={sx('max-width:760px;margin:0 auto;padding:96px 32px;display:flex;flex-direction:column;gap:16px')}>
      <h1 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:36px;font-weight:700")}>Sign in to preview</h1>
      <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>Previews of unpublished {what} are only for the James Reports team. Sign in to the admin in this browser, then open the preview again.</p>
      <a href="/admin/login" className="press h-navy" style={sx('align-self:flex-start;background:#0B1F5C;color:#FFFFFF;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600')}>
        Sign in to the admin
      </a>
    </section>
  );
}
