"use server"

import { createClerkClient } from '@clerk/nextjs/server'
import { UserService } from '@/modules/users/services/userService'
import { AthleteService } from '@/modules/athletes/services/athleteService'
import { ArenaService } from '@/modules/arenas/services/arenaService'
import { auth } from '@clerk/nextjs/server'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export async function linkAthlete(formData: {
    name: string;
    cpf: string;
    phone: string;
    email: string;
    sportId: string;
    arenaId: string;
}) {
    try {
        const { userId: managerClerkId } = await auth();

        if (!managerClerkId) {
            return { success: false, error: "Não autorizado" };
        }

        // 1. Get Manager's DB User
        const managerDbUser = await UserService.getUserByClerkId(managerClerkId);
        if (!managerDbUser) {
            return { success: false, error: "Usuário gestor não encontrado no banco." };
        }

        // 1.1 Check if email already exists
        const existingUser = await UserService.getUserByEmail(formData.email);
        if (existingUser) {
            return { success: false, error: "Este e-mail já está cadastrado no sistema." };
        }

        // 2. Create User in Clerk
        // Note: Using await clerk since createClerkClient might return a promise or the client depending on version
        const client = await clerk;
        const clerkUser = await client.users.createUser({
            emailAddress: [formData.email],
            firstName: formData.name.split(' ')[0],
            lastName: formData.name.split(' ').slice(1).join(' ') || undefined,
        });

        // 3. Sync to Supabase users table
        const athleteDbUser = await UserService.syncUser(
            clerkUser.id,
            formData.email,
            formData.name,
            undefined,
            undefined,
            undefined,
            undefined,
            'atleta'
        );

        // 4. Create Atleta profile
        const atleta = await AthleteService.createAtleta({
            id_users: athleteDbUser.id,
            nome_perfil: formData.name,
            cpf: formData.cpf,
            telefone: formData.phone,
            origem_cadastro: 'arena',
            id_arena_cadastro: formData.arenaId,
            compartilha_info: true
        });

        // 5. Link to Arena
        await AthleteService.linkToArena({
            id_arena: formData.arenaId,
            id_atleta: atleta.id,
            origem: 'arena'
        });

        // 6. Link to Sport
        await AthleteService.addSport({
            id_atleta: atleta.id,
            id_esporte: formData.sportId,
            nivel_habilidade: "Iniciante"
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error in linkAthlete action:", error);

        // Handle Clerk duplicate email error specifically
        if (error.errors && error.errors[0]?.code === 'form_identifier_exists') {
            return { success: false, error: "Este e-mail já está cadastrado no sistema." };
        }

        return {
            success: false,
            error: error.message || "Ocorreu um erro inesperado ao vincular o atleta."
        };
    }
}
