import Header from '@/components/layout/header';
import AuthGuard from '@/components/layout/auth-guard';
import AdminDashboardClientPage from '@/components/admin/admin-dashboard-client-page';

export default function AdminPage() {
  return (
    <>
      <Header />
      <AuthGuard requiredRole="admin">
        <main className="container mx-auto p-4 flex-grow">
          <AdminDashboardClientPage />
        </main>
      </AuthGuard>
    </>
  );
}
