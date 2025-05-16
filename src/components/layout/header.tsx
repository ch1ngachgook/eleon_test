'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, User, LogIn, LogOut, ShieldCheck, BedDouble, Bot } from 'lucide-react';
import { useHotelStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import React, { useState } from 'react';
import ChatWidget from '@/components/chatbot/chat-widget';

export default function Header() {
  const { user, logout } = useHotelStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/', label: 'Book Room', icon: BedDouble, roles: ['guest', 'admin', null] },
    ...(user?.role === 'guest' && user.currentBookingId
      ? [{ href: `/room/${user.currentBookingId}`, label: 'My Room', icon: Home, roles: ['guest'] }]
      : []),
    { href: '/admin', label: 'Admin Panel', icon: ShieldCheck, roles: ['admin'] },
  ];

  const filteredNavLinks = navLinks.filter(link => link.roles.includes(user?.role || null));

  const NavLinkItems = ({isMobile = false}: {isMobile?: boolean}) => (
    <>
    {filteredNavLinks.map((link) => (
      <Link key={link.href} href={link.href} passHref legacyBehavior>
        <Button
          variant={pathname === link.href ? 'secondary' : 'ghost'}
          className={`justify-start ${isMobile ? 'w-full text-left' : ''}`}
          onClick={() => isMobile && setMobileMenuOpen(false)}
        >
          <link.icon className="mr-2 h-5 w-5" />
          {link.label}
        </Button>
      </Link>
    ))}
    </>
  );


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6 fill-primary">
              <rect width="256" height="256" fill="none"></rect>
              <path d="M120,120H40a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v72A8,8,0,0,1,120,120Zm0,96H40a8,8,0,0,1-8-8V136a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v72A8,8,0,0,1,120,216Zm104-40h-1.6A158.2,158.2,0,0,1,160,120V40a8,8,0,0,0-8-8H152a8,8,0,0,0-7.2,4.9,8,8,0,0,0,4.2,10.7,16,16,0,1,1-13.4,26.7,8,8,0,0,0-10.7,4.2,8,8,0,0,0,4.9,7.2V120a189.9,189.9,0,0,0,65.2,57.8A8,8,0,0,0,224,176Z"></path>
            </svg>
            <span className="font-bold sm:inline-block">
              HotelKey
            </span>
          </Link>
          <nav className="flex items-center space-x-2 text-sm font-medium">
            <NavLinkItems />
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="md:hidden">
             <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <svg strokeWidth="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                    <path d="M3 5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M3 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M3 19H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="pt-10 pr-0">
                 <Link href="/" className="flex items-center space-x-2 px-4 mb-6" onClick={() => setMobileMenuOpen(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="h-6 w-6 fill-primary">
                      <rect width="256" height="256" fill="none"></rect>
                      <path d="M120,120H40a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v72A8,8,0,0,1,120,120Zm0,96H40a8,8,0,0,1-8-8V136a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v72A8,8,0,0,1,120,216Zm104-40h-1.6A158.2,158.2,0,0,1,160,120V40a8,8,0,0,0-8-8H152a8,8,0,0,0-7.2,4.9,8,8,0,0,0,4.2,10.7,16,16,0,1,1-13.4,26.7,8,8,0,0,0-10.7,4.2,8,8,0,0,0,4.9,7.2V120a189.9,189.9,0,0,0,65.2,57.8A8,8,0,0,0,224,176Z"></path>
                    </svg>
                    <span className="font-bold">HotelKey</span>
                  </Link>
                <nav className="flex flex-col space-y-2 px-4">
                  <NavLinkItems isMobile={true} />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => setChatOpen(true)} aria-label="Open Chatbot">
            <Bot className="h-5 w-5" />
          </Button>
          <ChatWidget open={chatOpen} onOpenChange={setChatOpen} />


          {user?.email ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://i.pravatar.cc/40?u=${user.email}`} alt={user.name || user.email} data-ai-hint="user avatar" />
                    <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email} ({user.role})
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" passHref legacyBehavior>
              <Button variant="outline">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
