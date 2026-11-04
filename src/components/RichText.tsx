import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { safeHref, safeImageSrc, youtubeIdFromSrc, type RichDoc, type RichNode } from '../lib/richtext';
import { YouTube, ytVideo } from './blocks';

// Renders report articles saved by the admin's TipTap editor. Only the node
// and mark types below are drawn, links/images/videos are checked, and no
// HTML string is ever injected, so a tampered document can't run scripts.

const ALIGN = new Set(['center', 'right', 'justify']);
const MAX_DEPTH = 40;

function alignStyle(node: RichNode): CSSProperties | undefined {
  const a = node.attrs?.textAlign;
  return typeof a === 'string' && ALIGN.has(a) ? { textAlign: a as CSSProperties['textAlign'] } : undefined;
}

function renderText(node: RichNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? '';
  for (const m of node.marks ?? []) {
    if (m.type === 'bold') out = <strong>{out}</strong>;
    else if (m.type === 'italic') out = <em>{out}</em>;
    else if (m.type === 'underline') out = <u>{out}</u>;
    else if (m.type === 'strike') out = <s>{out}</s>;
    else if (m.type === 'highlight') out = <mark>{out}</mark>;
    else if (m.type === 'code') out = <code>{out}</code>;
    else if (m.type === 'link') {
      const href = safeHref(m.attrs?.href);
      if (href) {
        const external = !href.startsWith('/');
        out = (
          <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
            {out}
            {external && <span className="sr-only"> (opens in a new tab)</span>}
          </a>
        );
      }
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function renderNodes(nodes: RichNode[] | undefined, depth: number): ReactNode[] {
  return (nodes ?? []).map((n, i) => renderNode(n, i, depth));
}

function renderNode(node: RichNode, key: number, depth: number): ReactNode {
  if (depth > MAX_DEPTH || typeof node !== 'object' || node === null) return null;
  const kids = () => renderNodes(node.content, depth + 1);
  switch (node.type) {
    case 'text':
      return renderText(node, key);
    case 'paragraph':
      return (
        <p key={key} style={alignStyle(node)}>
          {kids()}
        </p>
      );
    case 'heading': {
      const level = node.attrs?.level;
      const Tag = level === 3 ? 'h3' : level === 4 ? 'h4' : 'h2';
      return (
        <Tag key={key} style={alignStyle(node)}>
          {kids()}
        </Tag>
      );
    }
    case 'bulletList':
      return <ul key={key}>{kids()}</ul>;
    case 'orderedList': {
      const start = Number(node.attrs?.start);
      return (
        <ol key={key} start={Number.isInteger(start) && start > 1 ? start : undefined}>
          {kids()}
        </ol>
      );
    }
    case 'listItem':
      return <li key={key}>{kids()}</li>;
    case 'blockquote':
      return <blockquote key={key}>{kids()}</blockquote>;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'hardBreak':
      return <br key={key} />;
    case 'image': {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return null;
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      return (
        <figure key={key}>
          <img src={src} alt={alt} loading="lazy" decoding="async" />
        </figure>
      );
    }
    case 'youtube': {
      const id = youtubeIdFromSrc(node.attrs?.src);
      if (!id) return null;
      return <YouTube key={key} src={ytVideo(id, 'rel=0')} title="Video in the report" css="position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#081230;margin:1.8em 0" />;
    }
    default:
      // Unknown blocks keep their text but lose their formatting.
      return node.content ? <Fragment key={key}>{kids()}</Fragment> : null;
  }
}

export function RichText({ doc }: Readonly<{ doc: RichDoc }>) {
  return <div className="jr-article">{renderNodes(doc.content, 0)}</div>;
}
