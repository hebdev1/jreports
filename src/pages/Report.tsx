import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { MediaImg } from '../components/Img';
import { PreviewBanner, previewLabel, SignInToPreview, usePreviewNoindex } from '../components/PreviewParts';
import { RichText } from '../components/RichText';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { fetchReport, toApiError, type ApiError } from '../lib/api';
import { shortDate } from '../lib/format';
import { fetchReportPreview, type ReportPreview } from '../lib/preview';
import { useResource } from '../lib/resource';
import { sx } from '../lib/sx';
import type { ReportArticle } from '../lib/types';
import { useTitle } from '../lib/useTitle';
import NotFound from './NotFound';


const hostOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

function Loading() {
  return (
    <section className="wrap" aria-busy="true" aria-label="Loading the report" style={sx('max-width:760px;margin:0 auto;padding:64px 32px 96px;display:flex;flex-direction:column;gap:20px')}>
      <Skeleton count={1} css="height:18px;width:160px" />
      <Skeleton count={2} css="height:56px;width:100%" />
      <Skeleton count={1} css="aspect-ratio:16/9;width:100%;border-radius:16px" />
      <Skeleton count={6} css="height:22px;width:100%" />
    </section>
  );
}

export default function Report() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  return params.get('preview') === '1' ? <Preview id={id} /> : <Published id={id} />;
}

function Published({ id }: Readonly<{ id: string }>) {
  const report = useResource(`report:${id}`, () => fetchReport(id));
  const r = report.status === 'ready' ? report.data : null;
  useTitle(r ? r.seoTitle || r.title : 'Report', r ? r.seoDescription || r.dek : undefined);
  if (report.status === 'loading') return <Loading />;
  if (report.status === 'error')
    return (
      <section className="wrap" style={sx('max-width:760px;margin:0 auto;padding:72px 32px')}>
        <LoadError message="We couldn’t load this report." onRetry={report.retry} />
      </section>
    );
  if (!r) return <NotFound what="report" />;
  return <ReportView report={r} />;
}

/** /reports/:id?preview=1, for the team: drafts and pending edits, never indexed. */
function Preview({ id }: Readonly<{ id: string }>) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'done'; result: ReportPreview }>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    fetchReportPreview(id).then(
      (result) => setState({ status: 'done', result }),
      (err) => setState({ status: 'error', error: toApiError(err) }),
    );
  }, [id]);
  useEffect(load, [load]);
  usePreviewNoindex();
  const item = state.status === 'done' && state.result.status === 'ok' ? state.result.item : undefined;
  useTitle(item ? `Preview · ${item.title}` : 'Preview');

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error')
    return (
      <section className="wrap" style={sx('max-width:760px;margin:0 auto;padding:72px 32px')}>
        <LoadError message={state.error.message} onRetry={load} />
      </section>
    );
  const r = state.result;
  if (r.status === 'not_found') return <NotFound what="report" />;
  if (r.status === 'signed_out') return <SignInToPreview what="reports" />;
  return <ReportView report={r.item} banner={<PreviewBanner label={previewLabel(r.publication, r.hasChanges, 'report')} editorHref={`/admin/reports/${encodeURIComponent(r.item.id)}`} />} />;
}

function ReportView({ report: r, banner }: Readonly<{ report: ReportArticle; banner?: ReactNode }>) {
  const ratio = r.image?.width && r.image.height ? `${r.image.width} / ${r.image.height}` : '16 / 9';
  return (
    <div>
      {banner}
      <article aria-labelledby="report-title">
        <header className="wrap" style={sx('max-width:860px;margin:0 auto;padding:56px 32px 0;display:flex;flex-direction:column;gap:18px')}>
          <Link to="/reports" className="h-red-text" style={sx('align-self:flex-start;font-size:14px;color:#4A5578')}>
            ← All reports
          </Link>
          <span style={sx(EYEBROW + ';color:#D21034')}>{r.topic}</span>
          <h1 id="report-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(36px,5.2vw,64px);font-weight:700;letter-spacing:-0.02em;line-height:1.05;text-wrap:balance")}>
            {r.title}
          </h1>
          {r.dek && <p style={sx("margin:0;font-family:'Lora',serif;font-size:clamp(19px,2.2vw,23px);line-height:1.5;color:#4A5578;text-wrap:pretty")}>{r.dek}</p>}
          <p style={sx('margin:0;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:14px;color:#4A5578;padding:14px 0;border-top:1px solid #CDD4E6;border-bottom:1px solid #CDD4E6')}>
            <span style={{ fontWeight: 600, color: '#0B1F5C' }}>By {r.author || 'James Reports'}</span>
            <time dateTime={r.publishedOn}>{shortDate(r.publishedOn)}</time>
            {r.body && <span>{r.readMinutes} min read</span>}
          </p>
        </header>

        {r.image && (
          <div className="wrap" style={sx('max-width:1100px;margin:36px auto 0;padding:0 32px')}>
            <div style={{ ...sx('position:relative;border-radius:16px;overflow:hidden;background:#DDE3F0'), aspectRatio: ratio, maxHeight: '70vh' }}>
              <MediaImg media={r.image} fallback="" alt={r.image.alt} eager sizes="(max-width: 1100px) 100vw, 1036px" />
            </div>
          </div>
        )}

        <div className="wrap" style={sx('max-width:760px;margin:0 auto;padding:44px 32px 96px')}>
          {r.body ? (
            <RichText doc={r.body} />
          ) : r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="press h-red" style={sx('display:inline-block;background:#D21034;color:#FFFFFF;border-radius:999px;padding:14px 24px;font-size:15px;font-weight:600')}>
              Read the full report on {hostOf(r.url)} →<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p style={sx("margin:0;font-family:'Lora',serif;font-size:18px;color:#4A5578")}>The full text of this report hasn’t been published yet.</p>
          )}
          {r.body && r.url && (
            <p style={sx('margin:48px 0 0;padding-top:20px;border-top:1px solid #CDD4E6;font-size:14px;color:#4A5578')}>
              Originally published at{' '}
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00209F', fontWeight: 600 }}>
                {hostOf(r.url)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
