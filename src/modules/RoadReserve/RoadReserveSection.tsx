import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import SectionDashboard from '../Dashboard/SectionDashboard';

export default function RoadReserveSection() {
  return (
    <div style={{ width: '100%' }}>
      <CrossLinkChipBar sectionId="roadreserve" />
      <SectionDashboard sectionId="roadreserve" accent="#00d4aa" />
    </div>
  );
}
