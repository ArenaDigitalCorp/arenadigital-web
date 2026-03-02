"use client"

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { UserService } from "@/modules/users/services/userService";
import { toast } from "sonner"; // IMPORT TOAST

export function useUserSync() {
    const { user, isLoaded } = useUser();
    const [dbUser, setDbUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function sync() {
            if (isLoaded && user) {
                try {
                    const arenaName = user.unsafeMetadata?.arenaName as string | undefined;
                    const cpf = user.unsafeMetadata?.cpf as string | undefined;
                    const phone = user.unsafeMetadata?.phone as string | undefined;
                    const addressData = user.unsafeMetadata?.addressData as any | undefined;

                    const syncedUser = await UserService.syncUser(
                        user.id,
                        user.primaryEmailAddress?.emailAddress || "",
                        user.fullName || "",
                        arenaName,
                        cpf,
                        phone,
                        addressData
                    );

                    // Clear metadata after successful sync to prevent duplicates
                    if (arenaName) {
                        try {
                            await user.update({
                                unsafeMetadata: {
                                    ...user.unsafeMetadata,
                                    arenaName: null,
                                    cpf: null,
                                    phone: null,
                                    addressData: null
                                }
                            });
                        } catch (metaError) {
                            console.error("Failed to clear metadata:", metaError);
                        }
                    }

                    setDbUser(syncedUser);
                } catch (error: any) {
                    console.error("Failed to sync user:", error);
                    toast.error(`Falha ao sincronizar usuário: ${error.message || JSON.stringify(error)}`);
                } finally {
                    setIsLoading(false);
                }
            } else if (isLoaded && !user) {
                setIsLoading(false);
            }
        }

        sync();
    }, [user, isLoaded]);

    return { dbUser, isLoading };
}
