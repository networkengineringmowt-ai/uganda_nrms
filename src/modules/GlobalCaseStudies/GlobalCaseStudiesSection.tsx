import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import SectionDashboard from '../Dashboard/SectionDashboard';

export default function GlobalCaseStudiesSection() {
  return (
    <div style={{ width: '100%' }}>
      <CrossLinkChipBar sectionId="casestudies" />
      <SectionDashboard sectionId="casestudies" accent="#a855f7" />
    </div>
  );
}
