export interface SharedRecommendation {
  id: string;
  queryId: string;
  recommendationType: 'reduce' | 'pause' | 'increase' | 'maintain';
  confidenceLevel: 'high' | 'medium' | 'low';
}
