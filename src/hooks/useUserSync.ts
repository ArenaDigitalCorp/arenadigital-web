"use client"

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { UserService } from "@/modules/users/services/userService";

export function useUserSync() {
    const { user, isLoaded } = useUser();
    const [dbUser, setDbUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function sync() {
            if (isLoaded && user) {
                try {
                    const arenaName = user.unsafeMetadata?.arenaName as string | undefined;
                    const syncedUser = await UserService.syncUser(
                        user.id,
                        user.primaryEmailAddress?.emailAddress || "",
                        user.fullName || "",
                        arenaName
                    );

                    // Clear metadata after successful sync to prevent duplicates
                    if (arenaName) {
                        try {
                            await user.update({
                                unsafeMetadata: {
                                    ...user.unsafeMetadata,
                                    arenaName: null
                                }
                            });
                        } catch (metaError) {
                            console.error("Failed to clear metadata:", metaError);
                        }
                    }

                    setDbUser(syncedUser);
                } catch (error) {
                    console.error("Failed to sync user:", error);
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
