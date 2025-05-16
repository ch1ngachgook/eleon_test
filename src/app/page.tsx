import Header from '@/components/layout/header';
import AuthGuard from '@/components/layout/auth-guard';
import BookingClientPage from '@/components/booking/booking-client-page';

export default function BookingPage() {
  return (
    <>
      <Header />
      <AuthGuard>
        <main className="container mx-auto p-4 flex-grow">
          <h1 className="text-3xl font-bold mb-6 text-center md:text-left">Book Your Stay</h1>
          <BookingClientPage />
        </main>
      </AuthGuard>
    </>
  );
}
