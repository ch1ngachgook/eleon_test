'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, BedDouble, UserCircle } from 'lucide-react';

import { useHotelStore } from '@/store/useStore';
import type { Room } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const bookingSchema = z.object({
  guestName: z.string().min(2, { message: 'Guest name must be at least 2 characters.' }),
  roomId: z.string().min(1, { message: 'Please select a room.' }),
  checkInDate: z.date({ required_error: 'Check-in date is required.' }),
  checkOutDate: z.date({ required_error: 'Check-out date is required.' }),
}).refine(data => data.checkOutDate > data.checkInDate, {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function BookingClientPage() {
  const router = useRouter();
  const { user, rooms, createBooking } = useHotelStore();
  const { toast } = useToast();
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setAvailableRooms(rooms.filter(room => room.status === 'free'));
  }, [rooms]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestName: user?.name || '',
      roomId: '',
      checkInDate: undefined,
      checkOutDate: undefined,
    },
  });
  
  useEffect(() => {
    if (user?.name) {
      form.setValue('guestName', user.name);
    }
  }, [user, form]);


  const onSubmit = async (data: BookingFormValues) => {
    setIsLoading(true);
    const bookingDetails = {
      ...data,
      checkInDate: format(data.checkInDate, 'yyyy-MM-dd'),
      checkOutDate: format(data.checkOutDate, 'yyyy-MM-dd'),
    };
    const bookingId = await createBooking(bookingDetails);
    setIsLoading(false);

    if (bookingId) {
      toast({ title: 'Booking Successful!', description: `Room ${data.roomId} booked for ${data.guestName}.` });
      router.push(`/room/${bookingId}`);
    } else {
      toast({ title: 'Booking Failed', description: 'Could not complete booking. Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <BedDouble className="mr-2 h-7 w-7 text-primary" />
            Make a Reservation
          </CardTitle>
          <CardDescription>Fill in the details below to book your room.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="guestName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><UserCircle className="mr-1 h-4 w-4" />Guest Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter guest name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="checkInDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-in Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkOutDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-out Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < (form.getValues('checkInDate') || new Date(new Date().setHours(0,0,0,0)))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="roomId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Room</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an available room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRooms.length > 0 ? (
                          availableRooms.map(room => (
                            <SelectItem key={room.id} value={room.id}>
                              Room {room.id} (Capacity: standard, View: city) {/* Mock details */}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-rooms" disabled>No rooms available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || availableRooms.length === 0}>
                {isLoading ? 'Processing...' : (availableRooms.length === 0 ? 'No Rooms Available' : 'Book Room')}
              </Button>
            </CardContent>
          </form>
        </Form>
      </Card>
    </div>
  );
}
