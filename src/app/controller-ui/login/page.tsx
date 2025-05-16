
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useControllerStore } from '@/store/controllerStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ControllerLoginPage() {
  const router = useRouter();
  const { setAuthDetails } = useControllerStore();
  const [token, setToken] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && roomId.trim()) {
      setAuthDetails(token, roomId);
      router.push('/controller-ui');
    } else {
      alert('Please enter both Auth Token and Room ID.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-150px)]">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Controller Access</CardTitle>
          <CardDescription>Enter your Auth Token and Room ID to continue.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="authToken">Auth Token</Label>
              <Input
                id="authToken"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your guest token"
                required
              />
            </div>
            <div>
              <Label htmlFor="roomId">Room ID</Label>
              <Input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID (e.g., 101)"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Access Controller
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
