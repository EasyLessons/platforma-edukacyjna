import Link from 'next/link';
import { ReactNode } from 'react';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pt-18 s">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 p-6">
        {/* Sidebar */}
        <aside className="md:col-span-1">
          <nav className="sticky top-28 space-y-10">
            <div className="text-sm font-bold text-black uppercase tracking-wide">
              Dokumentacja
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/podrecznik-uzytkownika"
                  className="text-black hover:text-blue-600 transition"
                >
                  Wprowadzenie
                </Link>
              </li>
              <li>
                <span className="text-black font-medium text-xs">PODRECZNIK UZYTKOWNIKA</span>
                <ul className="mt-2 ml-3 space-y-2 border-l border-gray-200 pl-4">
                  <li>
                    <Link
                      href="/podrecznik-uzytkownika/rejestracja"
                      className="text-black hover:text-blue-600 transition"
                    >
                      Rejestracja
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/podrecznik-uzytkownika/tablica"
                      className="text-black hover:text-blue-600 transition"
                    >
                      Tablica
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/podrecznik-uzytkownika/workspaces"
                      className="text-black hover:text-blue-600 transition"
                    >
                      Workspaces
                    </Link>
                  </li>
                </ul>
              </li>
              <li>
                <span className="text-black font-medium text-xs">POMOC</span>
                <ul className="mt-2 ml-3 space-y-2 border-l border-gray-200 pl-4">
                  <li>
                    <Link
                      href="/podrecznik-uzytkownika/faq"
                      className="text-black hover:text-blue-600 transition"
                    >
                      FAQ
                    </Link>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="md:col-span-3 bg-white rounded-lg shadow-sm p-8 text-gray-900">
          <article className="max-w-none text-gray-900 [&_h1]:text-gray-900 [&_h2]:text-gray-900 [&_h3]:text-gray-900 [&_p]:text-gray-800 [&_li]:text-gray-800 [&_a]:text-blue-700 hover:[&_a]:text-blue-800">
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}
