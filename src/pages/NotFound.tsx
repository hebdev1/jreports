import { Link } from 'react-router';
import { H1 } from '../components/blocks';
import { EYEBROW } from '../components/ui';
import { sx } from '../lib/sx';
import { useTitle } from '../lib/useTitle';

export default function NotFound({ what = 'page' }: Readonly<{ what?: 'page' | 'episode' }>) {
  useTitle(what === 'episode' ? 'Episode not found' : 'Page not found');
  return (
    <section aria-labelledby="nf-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:96px 32px 120px')}>
      <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>404</div>
      <h1 id="nf-title" style={sx(H1)}>
        {what === 'episode' ? 'We couldn’t find that episode.' : 'We couldn’t find that page.'}
      </h1>
      <p style={sx("margin:0 0 32px;font-family:'Lora',serif;font-size:19px;color:#4A5578;max-width:620px;line-height:1.55")}>
        The link may be out of date. Try the full list instead.
      </p>
      <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
        <Link to={what === 'episode' ? '/episodes' : '/'} className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600')}>
          {what === 'episode' ? 'All episodes' : 'Go to the home page'}
        </Link>
      </div>
    </section>
  );
}
