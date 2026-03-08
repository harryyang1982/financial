'use client';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-700 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <div className="h-4 w-16 bg-gray-700 rounded mb-3" />
            <div className="h-8 w-32 bg-gray-700 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 h-64" />
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 h-64" />
      </div>
    </div>
  );
}
