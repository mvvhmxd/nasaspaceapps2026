// Compass and key for the map pointers. The map is always north-up.
export default function MapLegend() {
  return (
    <div className="hud map-legend" aria-label="Map key">
      <div className="compass" aria-label="North is up">
        <span aria-hidden="true">▲</span>
        <b>N</b>
      </div>
      <div><span className="lit" aria-hidden="true">●━</span> Sun direction</div>
      <div><span className="comms" aria-hidden="true">◆━</span> Earth direction</div>
      <div className="dim"><span aria-hidden="true">○ ◇</span> hollow = hidden behind terrain</div>
    </div>
  );
}
