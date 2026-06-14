import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const isPublicRoute = path === '/login';

  const session = request.cookies.get('session')?.value;

  let isValidSession = false;
  if (session) {
    try {
      const payload = await decrypt(session);
      isValidSession = !!payload;
    } catch (e) {
      isValidSession = false;
    }
  }

  // Redirect to login if unauthenticated and trying to access a protected route
  if (!isValidSession && !isPublicRoute && !path.startsWith('/api/') && !path.includes('.')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if logged in and trying to access login page
  if (isValidSession && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
