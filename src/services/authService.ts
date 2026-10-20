import { supabaseAnon, isSupabaseConfigured } from '../repositories/supabaseClient.js';
import { userRepository } from '../repositories/userRepository.js';
import { UserProfile } from '../types/index.js';

const isTest = () => process.env.NODE_ENV === 'test';

function unavailable(): Error {
  return new Error('AUTH_SERVICE_UNAVAILABLE: Serviço de autenticação indisponível ou não configurado.');
}

export class AuthService {
  async register(
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ): Promise<{ user: UserProfile; session?: any }> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAnon.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            role: 'customer',
          },
        },
      });

      if (error) throw new Error(`AUTH_ERROR: ${error.message}`);
      if (!data.user) throw new Error('AUTH_ERROR: Não foi possível criar o usuário.');

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
        const { data: loginData, error: loginError } =
          await supabaseAnon.auth.signInWithPassword({ email, password });

        if (!loginError) session = loginData.session;
      }

      return { user: profile, session };
    }

    if (!isTest()) throw unavailable();

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('AUTH_EMAIL_EXISTS: Este e-mail já está cadastrado.');
    }

    const id = crypto.randomUUID();
    const user = await userRepository.createProfile({
      id,
      email,
      full_name: fullName || null,
      phone: phone || null,
      role: 'customer',
      is_active: true,
    });

    return {
      user,
      session: {
        access_token: `mock_jwt_token_${id}`,
        refresh_token: `mock_refresh_token_${id}`,
        expires_in: 3600,
        token_type: 'bearer',
      },
    };
  }

  async login(email: string, password: string): Promise<{ user: UserProfile; session: any }> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAnon.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new Error('AUTH_INVALID_CREDENTIALS: E-mail ou senha incorretos.');
      }

      const user = await userRepository.findById(data.user.id);

      if (!user) {
        await supabaseAnon.auth.signOut();
        throw new Error('AUTH_PROFILE_REQUIRED: Perfil não encontrado. Entre em contato com o suporte.');
      }

      if (!user.is_active) {
        await supabaseAnon.auth.signOut();
        throw new Error('AUTH_USER_INACTIVE: Usuário inativo.');
      }

      return { user, session: data.session };
    }

    if (!isTest()) throw unavailable();

    const user = await userRepository.findByEmail(email);
    if (!user || !user.is_active) {
      throw new Error('AUTH_INVALID_CREDENTIALS: E-mail ou senha incorretos.');
    }

    return {
      user,
      session: {
        access_token: `mock_jwt_token_${user.id}`,
        refresh_token: `mock_refresh_token_${user.id}`,
        expires_in: 3600,
        token_type: 'bearer',
      },
    };
  }

  async logout(_token: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { error } = await supabaseAnon.auth.signOut();
      if (error) console.warn('Supabase logout warning:', error.message);
    }
  }

  async refresh(refreshToken: string): Promise<{ session: any }> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAnon.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        throw new Error('AUTH_REFRESH_FAILED: Token de renovação inválido ou expirado.');
      }

      return { session: data.session };
    }

    if (!isTest()) throw unavailable();

    const prefix = 'mock_refresh_token_';
    if (!refreshToken.startsWith(prefix)) {
      throw new Error('AUTH_REFRESH_FAILED: Token de renovação inválido ou expirado.');
    }

    const userId = refreshToken.slice(prefix.length);
    if (!userId) {
      throw new Error('AUTH_REFRESH_FAILED: Token de renovação inválido ou expirado.');
    }

    const user = await userRepository.findById(userId);
    if (!user || !user.is_active) {
      throw new Error('AUTH_REFRESH_FAILED: Token de renovação inválido ou expirado.');
    }

    return {
      session: {
        access_token: `mock_jwt_token_${userId}`,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'bearer',
      },
    };
  }

  async forgotPassword(email: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      if (!isTest()) throw unavailable();
      return;
    }

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email);
    if (error) throw new Error(`AUTH_ERROR: ${error.message}`);
  }

  async getMe(userId: string): Promise<UserProfile | null> {
    return userRepository.findById(userId);
  }
}

export const authService = new AuthService();
