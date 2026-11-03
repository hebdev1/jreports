import { Link } from 'react-router';
import { H1 } from '../components/blocks';
import { Img } from '../components/Img';
import { EYEBROW } from '../components/ui';
import { sx } from '../lib/sx';
import { useTitle } from '../lib/useTitle';

const GALLERY: Array<[string, string]> = [
  ['james-field.png', 'James Pierre reporting in the field with a James Reports microphone'],
  ['james-beige.png', 'James Pierre seated in a beige suit on set'],
  ['james-stage.png', 'James Pierre smiling as he speaks into a microphone on stage'],
  ['event-stage-gold.jpg', 'James Pierre in a gold jacket addressing an audience from the stage'],
  ['event-smile-blue.jpg', 'James Pierre smiling in a blue tuxedo jacket at an evening event'],
];

export default function About() {
  useTitle('About James Pierre');
  const stat = "font-family:'Oswald',sans-serif;font-size:38px;font-weight:700;line-height:1";
  return (
    <div>
      <section aria-labelledby="about-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:64px;align-items:start')}>
        <div style={sx('position:relative;aspect-ratio:4/5;border-radius:20px;overflow:hidden;background:#DDE3F0')}>
          <Img src="james-emmy.png" alt="James Pierre holding his Emmy award at the Suncoast Emmy Awards" eager sizes="(max-width: 960px) 100vw, 620px" />
        </div>
        <div style={sx('display:flex;flex-direction:column;gap:24px')}>
          <div style={sx(EYEBROW + ';color:#D21034')}>About</div>
          <h1 id="about-title" style={sx(H1 + ';margin:0;font-size:clamp(44px,6vw,80px)')}>
            James Pierre
          </h1>
          <p style={sx("margin:0;font-family:'Lora',serif;font-size:21px;line-height:1.55;color:#0B1F5C")}>
            4-time Emmy Award-winning Haitian-American journalist, television producer and multilingual news anchor with more than 20 years of experience in broadcast journalism.
          </p>
          <p style={sx('margin:0;font-size:16px;line-height:1.7;color:#4A5578')}>
            James has been featured on CNN en Español, MSNBC, NewsNation, Telemundo, Univision, Fox Sports, CBS 4, NBC 6, RT America and Canal 9 in Argentina. He was a contributor to the Rick Sanchez Show and Prohibido Callarse on Mira TV, and serves as TV producer and anchor at MDC-TV, where he hosts The Talk with James Pierre.
          </p>
          <p style={sx('margin:0;font-size:16px;line-height:1.7;color:#4A5578')}>
            He is fluent in English, French, Creole and Spanish. Beyond the newsroom, he hosts events for nonprofits and educational institutions and speaks to students across South Florida and the Caribbean.
          </p>
          <dl style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;background:#CDD4E6;border:1px solid #CDD4E6;border-radius:12px;overflow:hidden;margin:0')}>
            {[
              ['Awards', 'Emmy · Davey · Telly · Communicator'],
              ['Education', 'B.S. Miami Dade College · M.A. St. Thomas University'],
              ['Based in', 'Miami, Florida'],
            ].map(([k, v]) => (
              <div key={k} style={sx('background:#FFFFFF;padding:20px')}>
                <dt style={sx(EYEBROW + ';color:#6B6B6B;margin-bottom:8px')}>{k}</dt>
                <dd style={sx('margin:0;font-size:15px;line-height:1.5')}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="awards-title" className="on-dark" style={sx('background:#050B22;color:#FFFFFF')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px;display:flex;flex-direction:column;gap:40px')}>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px 56px;align-items:end')}>
            <div style={sx('display:flex;flex-direction:column;gap:14px')}>
              <span style={sx(EYEBROW + ';color:#FF8A9B')}>Awards &amp; recognition</span>
              <h2 id="awards-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(38px,4.6vw,64px);font-weight:700;letter-spacing:-0.02em;line-height:1")}>
                Four-time Emmy Award winner
              </h2>
            </div>
            <p style={sx("margin:0;font-family:'Lora',serif;font-size:18px;line-height:1.6;color:#C3CCE6")}>
              Honored by the National Academy of Television Arts &amp; Sciences, Suncoast Chapter, alongside multiple Davey, Telly and Communicator awards over two decades in radio and television.
            </p>
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px')}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={sx('position:relative;aspect-ratio:16/7;border-radius:12px;overflow:hidden;background:#DDE3F0')}>
                <Img src="emmy-team.jpg" alt="James Pierre and three colleagues holding their Emmy awards" sizes="(max-width: 1320px) 100vw, 1256px" />
              </div>
            </div>
            {[
              ['emmy-portrait.jpg', 'James Pierre holding his Emmy in front of the Academy backdrop'],
              ['emmy-trophy-look.jpg', 'James Pierre looking down at his Emmy statuette'],
              ['emmy-standing.jpg', 'James Pierre standing with his Emmy award'],
            ].map(([src, alt]) => (
              <div key={src} style={sx('position:relative;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:#DDE3F0')}>
                <Img src={src} alt={alt} sizes="(max-width: 700px) 100vw, 420px" />
              </div>
            ))}
          </div>
          <dl style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));border-top:1px solid rgba(247,248,252,0.14);margin:0')}>
            {[
              ['4×', 'Emmy Awards', '#FF8A9B'],
              ['Davey', 'Multiple awards', '#FFFFFF'],
              ['Telly', 'Multiple awards', '#FFFFFF'],
              ['Communicator', 'Multiple awards', '#FFFFFF'],
            ].map(([n, l, color]) => (
              <div key={n} style={sx('padding:22px 20px 0 0;display:flex;flex-direction:column-reverse;gap:6px')}>
                <dt style={sx('font-size:14px;color:#C3CCE6')}>{l}</dt>
                <dd style={{ ...sx(stat), margin: 0, color }}>{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-label="Photo gallery" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 72px')}>
        <h2 style={sx(EYEBROW + ';color:#D21034;margin:0 0 20px')}>On set, on stage, in the field</h2>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:16px')}>
          {GALLERY.map(([src, alt]) => (
            <div key={src} style={sx('position:relative;aspect-ratio:3/4;border-radius:12px;overflow:hidden;background:#DDE3F0')}>
              <Img src={src} alt={alt} sizes="(max-width: 700px) 100vw, 320px" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="book-title" style={sx('background:#E6EBF8')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:48px')}>
          <div>
            <h2 id="book-title" style={sx("margin:0 0 14px;font-family:'Playfair Display',serif;font-size:40px;font-weight:700;letter-spacing:-0.02em")}>
              Book James
            </h2>
            <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#00209F;max-width:440px')}>Freelance reporting, on-air commentary in four languages, event hosting and speaking engagements.</p>
          </div>
          <div style={sx('display:flex;gap:12px;flex-wrap:wrap;align-items:center')}>
            <Link to="/booking" className="press h-navy" style={sx('background:#0B1F5C;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
              Book an appearance
            </Link>
            <Link to="/booking?tab=ads" className="press h-white-bg" style={sx('background:transparent;color:#0B1F5C;border:1px solid #0B1F5C;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
              Advertise on James Reports
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
