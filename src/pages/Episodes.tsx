import { useSearchParams } from 'react-router';
import { EpisodeRow, H1 } from '../components/blocks';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { useEpisodes } from '../lib/content';
import { sx } from '../lib/sx';
import { chip, LANG_NAMES } from '../lib/theme';
import { LANG_CODES, TOPICS, type Episode, type LangCode, type Topic } from '../lib/types';
import { useTitle } from '../lib/useTitle';

/** Pure filter used by the page (and its tests). Unknown values mean "All". */
export function filterEpisodes(list: Episode[], topic: string | null, lang: string | null): Episode[] {
  const t = TOPICS.includes(topic as Topic) ? (topic as Topic) : null;
  const l = LANG_CODES.includes(lang as LangCode) ? (lang as LangCode) : null;
  return list.filter((e) => (!t || e.topic === t) && (!l || e.language === l));
}

export default function Episodes() {
  useTitle('Episodes');
  const episodes = useEpisodes();
  const [params, setParams] = useSearchParams();
  const topic = params.get('topic');
  const lang = params.get('lang');

  const setFilter = (key: 'topic' | 'lang', value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const list = episodes.status === 'ready' ? filterEpisodes(episodes.data, topic, lang) : [];
  const chipCss = 'border-radius:999px;padding:8px 16px;font-size:14px;font-weight:500;cursor:pointer';
  const activeTopic = TOPICS.includes(topic as Topic) ? topic : null;
  const activeLang = LANG_CODES.includes(lang as LangCode) ? lang : null;

  return (
    <section aria-labelledby="eps-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 96px')}>
      <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Watch · Listen</div>
      <h1 id="eps-title" style={sx(H1)}>
        Episodes
      </h1>
      <p style={sx("margin:0 0 40px;font-family:'Lora',serif;font-size:19px;color:#4A5578;max-width:620px;line-height:1.55")}>
        Long-form interviews on immigration, politics, Haiti and the diaspora. Every episode premieres on YouTube and is available here as audio.
      </p>
      <div style={sx('display:flex;flex-direction:column;gap:14px;margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid #CDD4E6')}>
        <div role="group" aria-labelledby="f-topic" style={sx('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
          <span id="f-topic" style={sx(EYEBROW + ';color:#6B6B6B;width:90px')}>
            Topic
          </span>
          {[null, ...TOPICS].map((t) => (
            <button key={t ?? 'all'} type="button" aria-pressed={activeTopic === t} onClick={() => setFilter('topic', t)} className="press" style={{ ...sx(chipCss), ...chip(activeTopic === t) }}>
              {t ?? 'All'}
            </button>
          ))}
        </div>
        <div role="group" aria-labelledby="f-lang" style={sx('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
          <span id="f-lang" style={sx(EYEBROW + ';color:#6B6B6B;width:90px')}>
            Language
          </span>
          {[null, ...LANG_CODES].map((l) => (
            <button key={l ?? 'all'} type="button" aria-pressed={activeLang === l} onClick={() => setFilter('lang', l)} className="press" style={{ ...sx(chipCss), ...chip(activeLang === l) }}>
              {l ? LANG_NAMES[l] : 'All'}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {episodes.status === 'ready' ? `${list.length} episode${list.length === 1 ? '' : 's'} shown` : ''}
      </p>
      {episodes.status === 'loading' && <Skeleton count={4} css="height:150px;margin-bottom:16px" />}
      {episodes.status === 'error' && <LoadError message="We couldn’t load the episodes." onRetry={episodes.retry} />}
      {episodes.status === 'ready' && list.length === 0 && (
        <div style={sx('display:flex;gap:16px;align-items:center;flex-wrap:wrap')}>
          <p style={sx('margin:0;font-size:16px;color:#4A5578')}>{episodes.data.length === 0 ? 'No episodes have been published yet.' : 'No episodes match these filters yet.'}</p>
          {episodes.data.length > 0 && (
            <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} style={sx('background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <div style={sx('display:flex;flex-direction:column')}>
        {list.map((ep) => (
          <EpisodeRow key={ep.id} ep={ep} />
        ))}
      </div>
    </section>
  );
}
