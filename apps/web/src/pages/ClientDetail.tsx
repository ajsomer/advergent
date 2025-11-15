import { useParams } from 'react-router-dom';

export default function ClientDetail() {
  const { clientId } = useParams();

  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold text-slate-900">Client {clientId}</h1>
      <p className="mt-2 text-slate-600">Detail view placeholder.</p>
    </main>
  );
}
