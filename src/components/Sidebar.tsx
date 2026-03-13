'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: '대시보드',
    items: [
      { href: '/', label: '대시보드', icon: '📊' },
      { href: '/financial-assets', label: '금융 자산', icon: '💹' },
      { href: '/real-estate', label: '부동산', icon: '🏠' },
      { href: '/debts', label: '부채', icon: '💳' },
      { href: '/portfolio', label: '포트폴리오', icon: '🎯' },
    ],
  },
  {
    title: '전략',
    items: [
      { href: '/strategy', label: '포트폴리오 전략', icon: '⚙️' },
      { href: '/projections', label: '전망', icon: '🔮' },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-gray-900 border-t border-gray-700">
        {allNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${
              pathname === item.href ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate px-0.5">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-gray-900 border-r border-gray-700 min-h-screen p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white">💰 자산관리</h1>
          <p className="text-xs text-gray-400 mt-1">Personal Finance Dashboard</p>
        </div>
        <nav className="flex flex-col gap-1">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                {group.title}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-600/20 text-blue-400 font-medium'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
