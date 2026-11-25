import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateHostCredentials,
  createHostSessionToken,
  setHostSessionCookie,
} from '@/lib/waitlist-security';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid credentials' },
      { status: 400 }
    );
  }

  const result = await authenticateHostCredentials(
    parsed.data.email,
    parsed.data.password
  );

  if (!result.authenticated) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const token = createHostSessionToken({
    email: result.email,
    restaurantSlug: result.restaurantSlug,
    role: result.role,
  });

  const res = NextResponse.json({
    ok: true,
    session: {
      email: result.email,
      restaurantSlug: result.restaurantSlug,
      role: result.role,
    },
  });
  setHostSessionCookie(res, token);
  return res;
}
