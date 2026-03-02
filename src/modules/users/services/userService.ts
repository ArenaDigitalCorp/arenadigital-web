import { supabase } from "@/shared/database/supabaseClient";

export class UserService {
    static async getCoordinatesFromAddress(addressData: { street: string, number: string, neighborhood: string, city: string, state: string }) {
        const query = `${addressData.street}, ${addressData.number}, ${addressData.city}, ${addressData.state}, Brasil`;
        const encodedQuery = encodeURIComponent(query);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`, {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'ArenaDigital-Web-Sync'
                }
            });
            const geoData = await res.json();
            if (geoData && geoData.length > 0) {
                return `POINT(${geoData[0].lon} ${geoData[0].lat})`;
            }
        } catch (error) {
            console.error("Erro ao obter coordenadas Nominatim:", error);
        }
        return null;
    }

    static async syncUser(clerkUserId: string, email: string, name?: string, arenaName?: string, cpf?: string, phone?: string, addressData?: any) {
        // 1. Sync user
        const { data: user, error: userError } = await supabase
            .from('users')
            .upsert(
                {
                    clerk_user_id: clerkUserId,
                    email: email,
                    name: name,
                    ...(cpf && { cpf })
                },
                { onConflict: 'clerk_user_id' }
            )
            .select()
            .single();

        if (userError) {
            console.error('Error syncing user:', userError);
            throw userError;
        }

        // 2. If arenaName is provided, ensure organization and arena exist
        if (arenaName && user) {
            // 2.1 Get or Create Organization
            let orgId: string | null = null;
            const { data: existingOrg } = await supabase
                .from('organizations')
                .select('id')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (existingOrg) {
                orgId = existingOrg.id;
            } else {
                const { data: newOrg, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: arenaName,
                        owner_id: user.id
                    })
                    .select()
                    .single();

                if (orgError) {
                    // If duplicate (concurrent call), try to fetch it again
                    if (orgError.code === '23505') {
                        const { data: retryOrg } = await supabase
                            .from('organizations')
                            .select('id')
                            .eq('owner_id', user.id)
                            .maybeSingle();
                        orgId = retryOrg?.id || null;
                    } else {
                        console.error('Error creating organization:', orgError);
                        throw new Error(`Erro ao criar organização: ${orgError.message}`);
                    }
                } else {
                    orgId = newOrg.id;
                }
            }

            // 2.2 Create Arena if it doesn't exist for this organization
            if (orgId) {
                const { data: existingArena } = await supabase
                    .from('arenas')
                    .select('id')
                    .eq('organization_id', orgId)
                    .eq('name', arenaName)
                    .maybeSingle();

                if (!existingArena) {
                    const arenaInsertData: any = {
                        name: arenaName,
                        owner_id: user.id,
                        organization_id: orgId,
                        status: 'ativo'
                    };

                    if (phone) {
                        arenaInsertData.phone = phone;
                    }

                    if (addressData) {
                        arenaInsertData.zip_code = addressData.cep || undefined;
                        arenaInsertData.municipio_id = addressData.municipio_id || undefined;
                        arenaInsertData.number = addressData.number || undefined;
                        arenaInsertData.complement = addressData.complement || undefined;
                        arenaInsertData.neighborhood = addressData.neighborhood || undefined;
                        arenaInsertData.address = addressData.street || undefined;

                        // Geocodificação automática
                        if (addressData.street && addressData.city && addressData.state) {
                            const locationPoint = await this.getCoordinatesFromAddress({
                                street: addressData.street,
                                number: addressData.number || "",
                                neighborhood: addressData.neighborhood || "",
                                city: addressData.city,
                                state: addressData.state
                            });
                            if (locationPoint) {
                                arenaInsertData.location = locationPoint;
                            }
                        }
                    }

                    const { data: newArena, error: arenaError } = await supabase
                        .from('arenas')
                        .insert(arenaInsertData)
                        .select()
                        .single();

                    if (arenaError && arenaError.code !== '23505') {
                        console.error('Error creating arena:', arenaError);
                        throw new Error(`Erro ao criar arena: ${arenaError.message}`);
                    }

                    if (newArena) {
                        const { error: arenaUserError } = await supabase
                            .from('arena_users')
                            .insert({
                                arena_id: newArena.id,
                                user_id: user.id,
                                role: 'Gestor',
                                status: 'Ativo'
                            });

                        if (arenaUserError && arenaUserError.code !== '23505') {
                            console.error('Error linking user to arena:', arenaUserError);
                            throw new Error(`Erro ao vincular usuário à arena: ${arenaUserError.message}`);
                        }
                    }
                }
            } else {
                throw new Error("Não foi possível criar ou encontrar a organização (orgId nulo).");
            }
        }

        return user;
    }

    static async getUserByClerkId(clerkUserId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('clerk_user_id', clerkUserId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching user:', error);
            throw error;
        }

        return data;
    }

    static async getUserByEmail(email: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Error fetching user by email:', error);
            throw error;
        }

        return data;
    }
}
