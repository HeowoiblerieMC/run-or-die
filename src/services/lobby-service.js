export class LobbyService
    extends EventTarget {
    constructor(
        profile
    ) {
        super();

        this.profile =
            profile;
    }

    async connect() {
        this.dispatchEvent(
            new CustomEvent(
                "players",
                {
                    detail: [
                        this.profile
                    ]
                }
            )
        );
    }

    async disconnect() {
        return undefined;
    }
}
