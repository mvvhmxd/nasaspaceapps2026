// Compass and key for the map. The map is always north-up.
import { useMemo } from 'react';
import { elevationRange, contourInterval, MAJOR_EVERY } from '../render/contours.js';

export default function MapLegend({ site }) {
  // Same rule as the renderer (scene.js), from the site's own heightmap.
  const interval = useMemo(() => {
    if (!site?.heightmap?.heights) return null;
    const { minM, maxM } = elevationRange(site.heightmap.heights);
    return contourInterval(minM, maxM);
  }, [site]);
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
        {interval && (
          <li className="dim">
            <span aria-hidden="true">─</span> Contour every {interval} m (bold every {interval * MAJOR_EVERY} m)
          </li>
        )}
      </ul>
    </section>
  );
}
