import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import SectionDashboard from '../Dashboard/SectionDashboard';

export default function GisEnterpriseSection() {
  return (
    <div style={{ width: '100%' }}>
      <CrossLinkChipBar sectionId="gisenterprise" />
      <SectionDashboard sectionId="gisenterprise" accent="#4d9fff" />
    </div>
  );
}
