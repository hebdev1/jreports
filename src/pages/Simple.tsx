import { Link } from 'react-router';
import { ArchiveCard, H1 } from '../components/blocks';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { useArchive, useReports } from '../lib/content';
import { shortDate } from '../lib/format';
import { sx } from '../lib/sx';
import { useTitle } from '../lib/useTitle';

export function Reports() {
  useTitle('Reports');
  const reports = useReports();
  return (
    <section aria-labelledby="rep-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 96px')}>
      <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Written reporting</div>
      <h1 id="rep-title" style={sx(H1 + ';margin:0 0 48px')}>
        Reports
      </h1>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:40px 48px')}>
        {reports.status === 'loading' && <Skeleton count={4} css="height:220px" />}
        {reports.status === 'error' && <LoadError message="We couldn’t load the reports." onRetry={reports.retry} />}
        {reports.status === 'ready' && reports.data.length === 0 && <p style={sx('margin:0;font-size:16px;color:#4A5578')}>No reports have been published yet.</p>}
        {reports.status === 'ready' &&
          reports.data.map((r) => (
            <article key={r.id} style={sx('display:flex;flex-direction:column;gap:12px;padding-top:24px;border-top:2px solid #0B1F5C')}>
              <div style={sx('display:flex;justify-content:space-between;gap:12px')}>
                <span style={sx(EYEBROW + ';color:#00209F')}>{r.topic}</span>
                <time dateTime={r.publishedOn} style={sx('font-size:12px;color:#6B6B6B')}>
                  {shortDate(r.publishedOn)}
                </time>
              </div>
              <h2 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:28px;font-weight:600;line-height:1.2;text-wrap:pretty")}>
                {r.hasArticle ? (
                  <Link to={`/reports/${encodeURIComponent(r.id)}`} className="h-red-text" style={{ color: 'inherit' }}>
                    {r.title}
                  </Link>
                ) : r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="h-red-text" style={{ color: 'inherit' }}>
                    {r.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  r.title
                )}
              </h2>
              <p style={sx("margin:0;font-family:'Lora',serif;font-size:17px;line-height:1.55;color:#4A5578")}>{r.dek}</p>
              <span style={sx('font-size:13px;color:#6B6B6B')}>
                {r.author ? `By ${r.author} · ` : ''}
                {r.readMinutes} min read
              </span>
            </article>
          ))}
      </div>
    </section>
  );
}

export function Archive() {
  useTitle('The archive');
  const archive = useArchive();
  return (
    <section aria-labelledby="arc-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 96px')}>
      <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>2014 — today</div>
      <h1 id="arc-title" style={sx(H1)}>
        The archive
      </h1>
      <p style={sx("margin:0 0 40px;font-family:'Lora',serif;font-size:19px;color:#4A5578;max-width:620px;line-height:1.55")}>Interviews from The Talk with James Pierre, WPBT2, PBS Miami and MDC-TV.</p>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:28px 20px')}>
        {archive.status === 'loading' && <Skeleton count={8} css="aspect-ratio:4/4" />}
        {archive.status === 'error' && <LoadError message="We couldn’t load the archive." onRetry={archive.retry} />}
        {archive.status === 'ready' && archive.data.length === 0 && <p style={sx('margin:0;color:#4A5578')}>The archive is being prepared.</p>}
        {archive.status === 'ready' && archive.data.map((a) => <ArchiveCard key={a.id} item={a} />)}
      </div>
    </section>
  );
}
