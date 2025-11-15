import { useRecommendations } from '@/hooks/useRecommendations';

interface RecommendationsListProps {
  clientId: string;
}

export function RecommendationsList({ clientId }: RecommendationsListProps) {
  const { data, isLoading } = useRecommendations(clientId);

  if (isLoading) {
    return <p className="text-slate-500">Loading recommendations...</p>;
  }

  if (!data?.length) {
    return <p className="text-slate-500">No recommendations yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {data.map((rec: any) => (
        <li key={rec.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{rec.query_text}</p>
          <p className="text-xs text-slate-600">{rec.recommendation_type}</p>
        </li>
      ))}
    </ul>
  );
}
