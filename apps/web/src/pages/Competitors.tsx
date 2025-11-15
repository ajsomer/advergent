import { useParams } from 'react-router-dom';

export default function Competitors() {
  const { clientId } = useParams();

  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold text-slate-900">Competitors for {clientId}</h1>
      <p className="mt-2 text-slate-600">Competitor dashboard placeholder.</p>
    </main>
  );
}
