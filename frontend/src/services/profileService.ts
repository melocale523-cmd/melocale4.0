import { supabase } from '../lib/supabase';
import { logService } from '../lib/logService';

interface ProfileRow {
  id: string;
  status?: string | null;
  role?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

export type { ProfileRow };

export const profileService = {
  async saveProfile(userId: string, data: {
    name: string;
    phone: string;
    bio: string;
    category: string;
    serviceRadius: string;
  }) {
    const payload = {
      p_user_id: userId,
      p_full_name: data.name,
      p_phone: data.phone,
      p_bio: data.bio || null,
      p_category: data.category || null,
      p_service_radius: data.serviceRadius ? Number(data.serviceRadius) : null,
    };
    logService.info('profileService', 'saving profile via save_full_profile RPC', { ...payload, p_phone: '[REDACTED]' });
    const { error } = await supabase.rpc('save_full_profile', payload);
    if (error) {
      logService.error('profileService', 'save_full_profile RPC failed', error);
      throw new Error('Erro ao salvar dados. Tente novamente.');
    }
    logService.info('profileService', 'profile saved successfully');
    return true;
  },
};

export const clientProfileService = {
  async saveProfile(userId: string, data: {
    name: string;
    phone: string;
    city: string;
    cep?: string;
    address_zipcode?: string;
    address_street?: string;
    address_number?: string;
    address_block?: string;
    address_complement?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
  }) {
    const payload: Record<string, unknown> = { id: userId, full_name: data.name, phone: data.phone, city: data.city };
    const optionalFields = ['cep', 'address_zipcode', 'address_street', 'address_number', 'address_block', 'address_complement', 'address_neighborhood', 'address_city', 'address_state'] as const;
    for (const f of optionalFields) {
      if (data[f] !== undefined) payload[f] = data[f];
    }
    logService.info('clientProfileService', 'saving profile', { ...payload, phone: '[REDACTED]' });
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      logService.error('clientProfileService', 'profiles upsert failed', error);
      throw new Error('Erro ao salvar perfil. Tente novamente.');
    }
    return true;
  },
};

export const professionalAddressService = {
  async saveAddress(userId: string, data: {
    cep?: string;
    address_zipcode?: string;
    address_street?: string;
    address_number?: string;
    address_block?: string;
    address_complement?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    city?: string;
  }) {
    const payload: Record<string, unknown> = { id: userId };
    const fields = ['cep', 'address_zipcode', 'address_street', 'address_number', 'address_block', 'address_complement', 'address_neighborhood', 'address_city', 'address_state', 'city'] as const;
    for (const f of fields) {
      if (data[f] !== undefined) payload[f] = data[f];
    }
    logService.info('professionalAddressService', 'saving address');
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      logService.error('professionalAddressService', 'address upsert failed', error);
      throw new Error('Erro ao salvar endereço. Tente novamente.');
    }
    return true;
  },
};

export const avatarService = {
  async upload(userId: string, file: File): Promise<string> {
    const path = `${userId}/profile.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      logService.error('avatarService', 'upload failed', uploadError);
      throw new Error('Erro ao enviar a foto. Tente novamente.');
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      logService.error('avatarService', 'avatar_url update failed', updateError);
      throw new Error('Foto enviada, mas não foi possível salvar. Tente novamente.');
    }

    // Return cache-busted URL for immediate display; clean URL is stored in DB
    return `${publicUrl}?t=${Date.now()}`;
  },

  async remove(userId: string): Promise<void> {
    const path = `${userId}/profile.jpg`;

    const { error: storageError } = await supabase.storage.from('avatars').remove([path]);
    if (storageError) logService.warn('avatarService', 'storage remove failed — continuing', storageError);

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (error) {
      logService.error('avatarService', 'avatar_url clear failed', error);
      throw new Error('Não foi possível remover a foto. Tente novamente.');
    }
  },
};
