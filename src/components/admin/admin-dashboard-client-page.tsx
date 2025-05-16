'use client';

import { useHotelStore } from '@/store/useStore';
import type { Room } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Lightbulb, DoorClosed, Snowflake, Users, PowerOff, Edit3, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import React from 'react';


const mockOccupancyData = [
  { date: 'Jan', occupied: 20, total: 5 },
  { date: 'Feb', occupied: 30, total: 5 },
  { date: 'Mar', occupied: 50, total: 5 },
  { date: 'Apr', occupied: 40, total: 5 },
  { date: 'May', occupied: 60, total: 5 },
  { date: 'Jun', occupied: 70, total: 5 },
  { date: 'Jul', occupied: 85, total: 5 },
  { date: 'Aug', occupied: 80, total: 5 },
  { date: 'Sep', occupied: 65, total: 5 },
  { date: 'Oct', occupied: 55, total: 5 },
  { date: 'Nov', occupied: 45, total: 5 },
  { date: 'Dec', occupied: 75, total: 5 },
].map(item => ({ ...item, occupancyRate: (item.occupied / 100) * 100 /* if occupied is a percentage */  }));


const EditRoomStatusDialog: React.FC<{ room: Room, onSave: (roomId: string, status: Room['status'], guestName?: string) => void }> = ({ room, onSave }) => {
  const [status, setStatus] = React.useState<Room['status']>(room.status);
  const [guestName, setGuestName] = React.useState(room.guestName || '');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSave = () => {
    onSave(room.id, status, status === 'occupied' ? guestName : undefined);
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit Room Status">
          <Edit3 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Room {room.id} Status</AlertDialogTitle>
          <AlertDialogDescription>
            Update the status and guest information for this room.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 my-4">
          <div>
            <Label htmlFor={`status-select-${room.id}`}>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Room['status'])}>
              <SelectTrigger id={`status-select-${room.id}`}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === 'occupied' && (
            <div>
              <Label htmlFor={`guest-name-${room.id}`}>Guest Name</Label>
              <Input 
                id={`guest-name-${room.id}`}
                value={guestName} 
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter guest name"
              />
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave}>Save Changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};


export default function AdminDashboardClientPage() {
  const { rooms, adminTurnOffAllLights, updateRoomControls, adminSetRoomStatus } = useHotelStore();

  const handleToggleRoomLight = (roomId: string, currentState: boolean) => {
    updateRoomControls(roomId, { lightOn: !currentState });
    toast({ title: `Room ${roomId} Light Toggled`, description: `Light is now ${!currentState ? 'ON' : 'OFF'}.` });
  };

  const handleTurnOffAllLights = () => {
    adminTurnOffAllLights();
    toast({ title: 'All Lights Off', description: 'Signal sent to turn off all lights in the hotel.' });
  };

  const handleSaveRoomStatus = (roomId: string, status: Room['status'], guestName?: string) => {
    adminSetRoomStatus(roomId, status, guestName);
    toast({ title: `Room ${roomId} Updated`, description: `Status set to ${status}.` });
  };

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(room => room.status === 'occupied').length;
  const occupancyPercentage = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  const getStatusBadge = (status: Room['status']) => {
    switch (status) {
      case 'free': return <Badge variant="secondary" className="bg-green-100 text-green-700"><CheckCircle className="mr-1 h-3 w-3"/>Free</Badge>;
      case 'occupied': return <Badge variant="destructive" className="bg-red-100 text-red-700"><XCircle className="mr-1 h-3 w-3"/>Occupied</Badge>;
      case 'maintenance': return <Badge variant="outline" className="bg-yellow-100 text-yellow-700"><Wrench className="mr-1 h-3 w-3"/>Maintenance</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Admin Dashboard</CardTitle>
          <CardDescription>Oversee hotel operations and room statuses.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-lg">
                Overall Occupancy: <span className="font-bold text-primary">{occupancyPercentage.toFixed(1)}%</span> ({occupiedRooms}/{totalRooms} rooms)
            </div>
          <Button onClick={handleTurnOffAllLights} variant="destructive">
            <PowerOff className="mr-2 h-5 w-5" /> Turn Off All Lights
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Users className="mr-2 h-6 w-6 text-primary" /> Room Occupancy Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockOccupancyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis label={{ value: 'Occupancy (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Occupancy"]} />
              <Legend />
              <Line type="monotone" dataKey="occupancyRate" name="Monthly Occupancy Rate" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Room Statuses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead className="text-center">Lights</TableHead>
                <TableHead className="text-center">Door</TableHead>
                <TableHead className="text-center">A/C</TableHead>
                <TableHead className="text-center">Sensors (°C/%)</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.id}</TableCell>
                  <TableCell>{getStatusBadge(room.status)}</TableCell>
                  <TableCell>{room.guestName || 'N/A'}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={room.lightOn}
                      onCheckedChange={() => handleToggleRoomLight(room.id, room.lightOn)}
                      aria-label={`Toggle light for room ${room.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    {room.doorLocked ? 
                        <DoorClosed className="h-5 w-5 mx-auto text-red-500" title="Door Locked" /> : 
                        <DoorClosed className="h-5 w-5 mx-auto text-green-500" title="Door Unlocked"/>
                    }
                  </TableCell>
                   <TableCell className="text-center">
                    {room.acOn ? 
                        <Snowflake className="h-5 w-5 mx-auto text-blue-500" title="A/C On" /> : 
                        <Snowflake className="h-5 w-5 mx-auto text-muted-foreground" title="A/C Off"/>
                    }
                  </TableCell>
                  <TableCell className="text-center">{room.temperature}°C / {room.humidity}%</TableCell>
                  <TableCell className="text-center">
                     <EditRoomStatusDialog room={room} onSave={handleSaveRoomStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
