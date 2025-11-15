import { useParams } from 'react-router-dom';

export default function Recommendations() {
  const { clientId } = useParams();

  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold text-slate-900">Recommendations for {clientId}</h1>
      <p className="mt-2 text-slate-600">AI recommendations list placeholder.</p>
    </main>
  );
}
