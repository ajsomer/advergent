import { StyleSheet } from '@react-pdf/renderer';
import type { RecommendationCategory, ImpactLevel, EffortLevel } from '@advergent/shared';

// Color palette matching Tailwind/shadcn
export const colors = {
  // Slate palette
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Blue palette
  blue50: '#eff6ff',
  blue200: '#bfdbfe',
  blue600: '#2563eb',
  blue800: '#1e40af',
  blue900: '#1e3a8a',

  // Badge colors
  purple100: '#f3e8ff',
  purple800: '#6b21a8',
  green100: '#dcfce7',
  green800: '#166534',
  orange100: '#ffedd5',
  orange800: '#9a3412',
  red100: '#fee2e2',
  red800: '#991b1b',
  red600: '#dc2626',
  yellow100: '#fef9c3',
  yellow800: '#854d0e',
  yellow600: '#ca8a04',
  green600: '#16a34a',
};

export const pdfStyles = StyleSheet.create({
  // Page layout
  page: {
    padding: 40,
    paddingBottom: 60, // Space for footer
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.slate800,
  },

  // Header styles
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.blue600,
    marginBottom: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.slate500,
  },
  metaText: {
    fontSize: 9,
    color: colors.slate400,
  },

  // Section styles
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.slate900,
  },

  // Executive summary card
  summaryCard: {
    backgroundColor: colors.blue50,
    borderWidth: 1,
    borderColor: colors.blue200,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.blue900,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: colors.slate700,
    marginBottom: 12,
  },
  highlightsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.slate600,
    marginBottom: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 5,
  },
  highlightNumber: {
    width: 20,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.blue600,
  },
  highlightText: {
    flex: 1,
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.4,
  },

  // Recommendation card
  recCard: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recBadgeRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  recBadge: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 5,
    fontWeight: 'bold',
  },
  recTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.slate100,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 18,
    marginRight: 8,
    color: colors.slate600,
  },
  recTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.slate900,
    flex: 1,
  },
  recEffort: {
    fontSize: 8,
  },
  recDescription: {
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  actionItemsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.slate600,
    marginBottom: 5,
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 10,
  },
  actionBullet: {
    width: 10,
    fontSize: 8,
    color: colors.slate400,
  },
  actionText: {
    flex: 1,
    fontSize: 8,
    color: colors.slate500,
    lineHeight: 1.4,
  },

  // Impact summary row
  impactSummary: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  impactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
    marginTop: 2,
  },
  impactText: {
    fontSize: 9,
    color: colors.slate500,
    marginRight: 12,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: colors.slate400,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.slate500,
  },
});

// Badge color helpers using shared types as single source of truth
export const getTypeBadgeStyle = (type: RecommendationCategory) => {
  switch (type) {
    case 'sem':
      return { backgroundColor: colors.purple100, color: colors.purple800 };
    case 'seo':
      return { backgroundColor: colors.green100, color: colors.green800 };
    case 'hybrid':
      return { backgroundColor: colors.orange100, color: colors.orange800 };
  }
};

export const getImpactBadgeStyle = (impact: ImpactLevel) => {
  switch (impact) {
    case 'high':
      return { backgroundColor: colors.red100, color: colors.red800 };
    case 'medium':
      return { backgroundColor: colors.yellow100, color: colors.yellow800 };
    case 'low':
      return { backgroundColor: colors.slate100, color: colors.slate600 };
  }
};

export const getEffortColor = (effort: EffortLevel) => {
  switch (effort) {
    case 'high':
      return colors.red600;
    case 'medium':
      return colors.yellow600;
    case 'low':
      return colors.green600;
  }
};
