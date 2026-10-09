import {
    supabase
} from "../supabase.js";

function createRoomCode() {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const bytes =
        crypto.getRandomValues(
            new Uint8Array(
                6
            )
        );

    return Array.from(
        bytes,
        value =>
            characters[
                value %
                characters.length
            ]
    ).join("");
}

export class RoomService {
    async create(
        profile
    ) {
        if (
            profile.guest
        ) {
            throw new Error(
                "Sign in to create a room."
            );
        }

        const {
            data,
            error
        } =
            await supabase
                .from("rooms")
                .insert({
                    code:
                        createRoomCode(),

                    host_id:
                        profile.id,

                    status:
                        "LOBBY"
                })
                .select()
                .single();

        if (error) {
            throw error;
        }

        return data;
    }

    async join(
        profile,
        code
    ) {
        if (
            profile.guest
        ) {
            throw new Error(
                "Sign in to join a room."
            );
        }

        const cleanCode =
            String(
                code ||
                ""
            )
                .trim()
                .toUpperCase();

        const {
            data,
            error
        } =
            await supabase
                .from("rooms")
                .select("*")
                .eq(
                    "code",
                    cleanCode
                )
                .single();

        if (error) {
            throw new Error(
                "Room not found."
            );
        }

        const {
            error:
                joinError
        } =
            await supabase
                .from(
                    "room_members"
                )
                .upsert({
                    room_id:
                        data.id,

                    user_id:
                        profile.id,

                    ready:
                        false
                });

        if (joinError) {
            throw joinError;
        }

        return data;
    }
}
