
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css'; // Assuming you want to keep the global styles
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Controller UI',
  description: 'Directly interact with the room controller.',
};

export default function ControllerUILayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <header className="bg-slate-700 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
              <Link href="/controller-ui" className="text-xl font-bold">Controller Interface</Link>
              <nav>
                <Link href="/controller-ui/login" className="hover:text-slate-300">Login</Link>
              </nav>
            </div>
          </header>
          <main className="flex-grow container mx-auto p-4">
            {children}
          </main>
          <footer className="bg-slate-700 text-white p-4 text-center text-sm">
            Simple Controller UI Footer
          </footer>
        </div>
      </body>
    </html>
  );
}
