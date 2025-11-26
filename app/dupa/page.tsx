import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DupaPage() {
  const journalists = await prisma.mediaContact.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-8 bg-gray-50">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">Lista Dziennikarzy</h1>
        
        {journalists.length === 0 ? (
          <div className="p-4 text-center bg-white rounded shadow">
            <p className="text-gray-500">Brak dziennikarzy w bazie danych.</p>
          </div>
        ) : (
          <div className="overflow-x-auto shadow-md sm:rounded-lg">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3">Imię i Nazwisko</th>
                  <th scope="col" className="px-6 py-3">Email</th>
                  <th scope="col" className="px-6 py-3">Redakcja</th>
                  <th scope="col" className="px-6 py-3">Rola</th>
                  <th scope="col" className="px-6 py-3">Tagi</th>
                </tr>
              </thead>
              <tbody>
                {journalists.map((journalist) => (
                  <tr key={journalist.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {journalist.name}
                    </td>
                    <td className="px-6 py-4">
                      {journalist.email || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {journalist.outlet || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {journalist.role || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {journalist.tags && journalist.tags.length > 0 
                        ? journalist.tags.join(', ') 
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
