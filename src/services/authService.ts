import { supabaseAnon, supabaseAdmin, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import { UserProfile } from '../types/index.js';

export class AuthService {
  async register(
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ): Promise<{ user: UserProfile; session?: any }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAnon.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              role: 'customer',
            },
          },
        });

        if (error) {
          throw new Error(`AUTH_ERROR: ${error.message}`);
        }

        if (data.user) {
          const profile = await userRepository.createProfile({
            id: data.user.id,
            email: data.user.email || email,
            full_name: fullName || null,
            phone: phone || null,
            role: 'customer',
            is_active: true,
          });

          let session = data.session;
          if (!session) {
            try {
              const loginRes = await supabaseAnon.auth.signInWithPassword({ email, password });
              if (loginRes.data?.session) {
                session = loginRes.data.session;
              }
            } catch (autoLoginErr) {
              console.warn('Auto-login after signup warning:', autoLoginErr);
            }
          }

          return { user: profile, session };
        }
      } catch (err: any) {
        if (err.message?.startsWith('AUTH_ERROR:')) throw err;
        console.warn('Supabase auth register error, fallback locally:', err);
      }
    }

    // Local Mock Auth Registration for test/demo environments
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('AUTH_EMAIL_EXISTS: Este e-mail já está cadastrado.');
    }

    const newId = crypto.randomUUID();
    const profile = await userRepository.createProfile({
      id: newId,
      email,
      full_name: fullName || null,
      phone: phone || null,
      role: 'customer',
      is_active: true,
    });

    const mockSession = {
      access_token: `mock_jwt_token_${newId}`,
      refresh_token: `mock_refresh_token_${newId}`,
      expires_in: 3600,
      token_type: 'bearer',
    };

    return { user: profile, session: mockSession };
  }

  async login(email: string, password: string): Promise<{ user: UserProfile; session: any }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw new Error(`AUTH_INVALID_CREDENTIALS: ${error.message}`);
        }

        if (data.user) {
          let profile = await userRepository.findById(data.user.id);
          if (!profile) {
            profile = await userRepository.createProfile({
              id: data.user.id,
              email: data.user.email || email,
              full_name: data.user.user_metadata?.full_name || null,
              phone: data.user.user_metadata?.phone || null,
              role: data.user.user_metadata?.role || 'customer',
              is_active: true,
            });
          }

          return { user: profile, session: data.session };
        }
      } catch (err: any) {
        if (err.message?.startsWith('AUTH_INVALID_CREDENTIALS:')) throw err;
        console.warn('Supabase auth login error, fallback locally:', err);
      }
    }

    // Fallback login
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('AUTH_INVALID_CREDENTIALS: E-mail ou senha incorretos.');
    }

    const mockSession = {
      access_token: `mock_jwt_token_${user.id}`,
      refresh_token: `mock_refresh_token_${user.id}`,
      expires_in: 3600,
      token_type: 'bearer',
    };

    return { user, session: mockSession };
  }

  async logout(token: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabaseAnon.auth.signOut();
      } catch (err) {
        // ignore logout errors
      }
    }
  }

  async refresh(refreshToken: string): Promise<{ session: any }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) {
          throw new Error('AUTH_REFRESH_FAILED: Token de renovação inválido ou expirado.');
        }
        return { session: data.session };
      } catch (err: any) {
        if (err.message?.startsWith('AUTH_REFRESH_FAILED:')) throw err;
      }
    }

    return {
      session: {
        access_token: `mock_jwt_token_refreshed_${Date.now()}`,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'bearer',
      },
    };
  }

  async forgotPassword(email: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabaseAnon.auth.resetPasswordForEmail(email);
      } catch (err) {
        // silent
      }
    }
  }

  async getMe(userId: string): Promise<UserProfile | null> {
    return userRepository.findById(userId);
  }
}

export const authService = new AuthService();
