'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

export async function login(
  prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') {
        return { error: 'Invalid username or password.' }; // D-04: generic message
      }
      // Check for rate limit error from authorize function
      if (error.message?.includes('RATE_LIMITED') || error.cause?.err?.message?.includes('RATE_LIMITED')) {
        return { error: 'Too many attempts. Try again in 30 seconds.' };
      }
      return { error: 'Something went wrong. Please try again.' };
    }
    throw error; // Re-throw redirect errors (signIn throws NEXT_REDIRECT on success)
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/login' }); // D-17
}
