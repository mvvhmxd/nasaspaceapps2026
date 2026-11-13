// Compass and key for the map pointers. The map is always north-up.
export default function MapLegend() {
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
      </ul>
    </section>
  );
}
