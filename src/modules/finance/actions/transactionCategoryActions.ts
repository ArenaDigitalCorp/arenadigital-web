'use server';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { requireAuthenticatedDbUser, assertArenaAccess, assertArenaAdminAccess } from '@/lib/server-auth';
import type { TransactionCategory, UpdateTransactionCategoryDTO } from '@/modules/finance/types/finance.types';
import { revalidatePath } from 'next/cache';

export async function getTransactionCategoriesAction(arenaId: string) {
  try {
    await assertArenaAccess(arenaId);
    const { data, error } = await getSupabaseAdmin()
      .from('transaction_categories')
      .select('*')
      .eq('arena_id', arenaId)
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: (data ?? []) as TransactionCategory[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar categorias de lançamento';
    return { success: false, error: message, data: [] as TransactionCategory[] };
  }
}

export async function createTransactionCategoryAction(
  arenaId: string,
  input: { name: string; type: 'entrada' | 'saída' }
) {
  try {
    await assertArenaAdminAccess(arenaId);
    const { dbUserId } = await requireAuthenticatedDbUser();
    const name = input.name.trim();
    if (name.length < 2) throw new Error('Nome da categoria deve ter pelo menos 2 caracteres');

    const { data, error } = await getSupabaseAdmin()
      .from('transaction_categories')
      .insert([{ arena_id: arenaId, name, type: input.type, created_by: dbUserId }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Já existe uma categoria com este nome');
      throw new Error(error.message);
    }
    revalidatePath(`/dashboard/finance/${arenaId}/cadastros-auxiliares`);
    return { success: true, data: data as TransactionCategory };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar categoria';
    return { success: false, error: message, data: null };
  }
}

export async function updateTransactionCategoryAction(
  arenaId: string,
  categoryId: string,
  input: { name?: string; active?: boolean; sort_order?: number }
) {
  try {
    await assertArenaAdminAccess(arenaId);
    const patch: UpdateTransactionCategoryDTO = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) throw new Error('Nome da categoria deve ter pelo menos 2 caracteres');
      patch.name = name;
    }
    if (input.active !== undefined) patch.active = input.active;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

    const { data, error } = await getSupabaseAdmin()
      .from('transaction_categories')
      .update(patch)
      .eq('id', categoryId)
      .eq('arena_id', arenaId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Já existe uma categoria com este nome');
      throw new Error(error.message);
    }
    revalidatePath(`/dashboard/finance/${arenaId}/cadastros-auxiliares`);
    return { success: true, data: data as TransactionCategory };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar categoria';
    return { success: false, error: message, data: null };
  }
}

export async function deleteTransactionCategoryAction(arenaId: string, categoryId: string) {
  try {
    await assertArenaAdminAccess(arenaId);
    const supabase = getSupabaseAdmin();

    const { data: category, error: categoryError } = await supabase
      .from('transaction_categories')
      .select('name, type')
      .eq('id', categoryId)
      .eq('arena_id', arenaId)
      .single();

    if (categoryError) throw new Error(categoryError.message);

    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('arena_id', arenaId)
      .eq('type', category.type)
      .eq('category', category.name);

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        `Não é possível excluir: há ${count} lançamento${count === 1 ? '' : 's'} com esta categoria. Inative-a em vez de excluir.`
      );
    }

    const { error } = await supabase
      .from('transaction_categories')
      .delete()
      .eq('id', categoryId)
      .eq('arena_id', arenaId);

    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/finance/${arenaId}/cadastros-auxiliares`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir categoria';
    return { success: false, error: message };
  }
}
