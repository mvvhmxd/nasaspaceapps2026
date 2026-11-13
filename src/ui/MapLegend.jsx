// Compass and key for the map. The map is always north-up.
import { memo } from 'react';
import { siteContours } from '../render/contours.js';
import { contourCss } from '../render/contourStyle.js';

function MapLegend({ site }) {
  // Same cached values the renderer uses (computed once per heightmap).
  const c = site?.heightmap?.heights ? siteContours(site.heightmap) : null;
  return (
    <section className="hud map-legend" aria-label="Map key">
      <div className="compass">
        <span aria-hidden="true">▲ <b>N</b></span>
        <span className="sr-only">North is up</span>
      </div>
      <ul>
        <li><span className="lit" aria-hidden="true">●━</span> Sun direction</li>
        <li><span className="comms" aria-hidden="true">◆━</span> Earth direction</li>
        <li className="dim"><span aria-hidden="true">○ ◇</span> Hollow head: hidden behind terrain</li>
        {c && (
          <li className="dim">
            <span aria-hidden="true">
              <span style={{ color: contourCss('majorShadow') }}>─</span>
              <span style={{ color: contourCss('majorLit') }}>━</span>
            </span>{' '}
            Contours every {c.interval} m, index every {c.interval * c.majorEvery} m; thinned on steep slopes
          </li>
        )}
      </ul>
    </section>
  );
}

export default memo(MapLegend); // props change only with the site
