import { H1 } from '../components/blocks';
import { EYEBROW } from '../components/ui';
import { sx } from '../lib/sx';
import { useTitle } from '../lib/useTitle';

const STEPS: Array<[string, string, string]> = [
  ['01', 'Send your pitch', 'Fill out the form below with your topic and background.'],
  ['02', 'Producer review', 'The team reviews every request and reaches out if it’s a fit.'],
  ['03', 'Pre-interview', 'A short call to shape the conversation and pick a date.'],
  ['04', 'Recording', 'In studio in Miami or remotely, in the language of your choice.'],
];

/** Explains the guest process; the request form itself sits just below (#guest-request). */
export default function Guest() {
  useTitle('Be a guest');
  return (
    <section aria-labelledby="g-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 80px')}>
      <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Podcast · Guest request</div>
      <h1 id="g-title" style={sx(H1)}>
        Be a guest on James Reports
      </h1>
      <p style={sx("margin:0 0 44px;font-family:'Lora',serif;font-size:19px;color:#4A5578;max-width:640px;line-height:1.55")}>
        James sits down with people who have something to say about immigration, politics, Haiti, community, culture, sports and entertainment.
      </p>
      <ol style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:20px;list-style:none;margin:0;padding:0')}>
        {STEPS.map(([n, t, d]) => (
          <li key={n} className="card-pad" style={sx('background:#FFFFFF;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.07);padding:28px;display:flex;flex-direction:column;gap:10px')}>
            <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:36px;font-weight:700;color:#D21034;line-height:1")}>{n}</span>
            <span style={sx("font-family:'Playfair Display',serif;font-size:22px;font-weight:700")}>{t}</span>
            <span style={sx('font-size:15px;line-height:1.55;color:#4A5578')}>{d}</span>
          </li>
        ))}
      </ol>
      <p style={sx('margin:32px 0 0;font-size:15px;color:#4A5578')}>
        <a href="#guest-request" style={sx('font-weight:600;border-bottom:1px solid #0B1F5C')}>
          Go to the guest request form ↓
        </a>
      </p>
    </section>
  );
}
