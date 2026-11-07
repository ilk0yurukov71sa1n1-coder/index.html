import ContributionSkyline from '../components/ui/ContributionSkyline';

// Blood red, light to heavy, so the chart matches the rest of the app.
const OXBLOOD = ['#ecd5d1', '#d08f8b', '#a8383d', '#5c1215'];

// The 3D activity chart with the app's defaults. `data` is always a real
// array: the component would otherwise draw a made-up sample year.
export default function Skyline({ data, unit, unitPlural, footer }) {
  return (
    <ContributionSkyline
      className="app-skyline"
      data={Array.isArray(data) ? data : []}
      unit={unit}
      unitPlural={unitPlural}
      palette={OXBLOOD}
      defaultView="2d"
      weekStart={1}
      locale="en-GB"
      footer={footer}
    />
  );
}
