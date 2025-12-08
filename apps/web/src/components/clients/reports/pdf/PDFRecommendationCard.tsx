import { View, Text } from '@react-pdf/renderer';
import { pdfStyles, getTypeBadgeStyle, getImpactBadgeStyle, getEffortColor } from './styles';
import type { RecommendationCategory, ImpactLevel, EffortLevel } from '@advergent/shared';

interface PDFRecommendationCardProps {
  index: number;
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

export function PDFRecommendationCard({
  index,
  title,
  description,
  type,
  impact,
  effort,
  actionItems,
}: PDFRecommendationCardProps) {
  return (
    <View style={pdfStyles.recCard} wrap={false}>
      <View style={pdfStyles.recHeader}>
        <View style={{ flex: 1 }}>
          <View style={pdfStyles.recBadgeRow}>
            <Text style={[pdfStyles.recBadge, getTypeBadgeStyle(type)]}>
              {type.toUpperCase()}
            </Text>
            <Text style={[pdfStyles.recBadge, getImpactBadgeStyle(impact)]}>
              {impact.toUpperCase()} IMPACT
            </Text>
          </View>
          <View style={pdfStyles.recTitleRow}>
            <Text style={pdfStyles.recIndex}>{index + 1}</Text>
            <Text style={pdfStyles.recTitle}>{title}</Text>
          </View>
        </View>
        <Text style={[pdfStyles.recEffort, { color: getEffortColor(effort) }]}>
          {effort.charAt(0).toUpperCase() + effort.slice(1)} Effort
        </Text>
      </View>

      <Text style={pdfStyles.recDescription}>{description}</Text>

      {actionItems.length > 0 && (
        <View>
          <Text style={pdfStyles.actionItemsTitle}>Action Items:</Text>
          {actionItems.map((item, idx) => (
            <View key={idx} style={pdfStyles.actionItem}>
              <Text style={pdfStyles.actionBullet}>•</Text>
              <Text style={pdfStyles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
