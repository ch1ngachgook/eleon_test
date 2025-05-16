import AuthForm from '@/components/auth/auth-form';
import Header from '@/components/layout/header';

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto flex flex-grow items-center justify-center p-4">
        <AuthForm />
      </main>
    </>
  );
}
