import Header from '@/components/layout/header';
import AuthGuard from '@/components/layout/auth-guard';
import RoomControlClientPage from '@/components/room/room-control-client-page';

interface RoomPageProps {
  params: { id: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  const bookingId = params.id;

  return (
    <>
      <Header />
      <AuthGuard requiredRole="guest">
        <main className="container mx-auto p-4 flex-grow">
          <RoomControlClientPage bookingId={bookingId} />
        </main>
      </AuthGuard>
    </>
  );
}
