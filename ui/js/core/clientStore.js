//
// Client Store
// Release 1.0.0
//

const ClientStore = {


    //
    // data
    //

    async refresh() {
    
        try {
    
            const clients =
                await ClientEntityLayer.list();
    
    
            Store.set(
                "clients",
                clients || []
            );
    
    
        } catch (error) {
    
    
            console.error(
                "[ClientStore] failed to load clients",
                error
            );
    
    
            await Dialog.alert(
                safeT("clients.load_error_title"),
                error?.message ||
                safeT("clients.load_error_message")
            );
    
    
            //
            // Keep the last known client list.
            //
            // Do not overwrite Store["clients"]
            // when loading fails.
            //
    
        }
    
    },


    get() {

        return Store.get("clients") || [];

    },


    //
    // Validate client comment
    //
    // Comment is used as a client/profile name
    // in URI export payload.
    //
    // Allowed:
    //
    // - Cyrillic letters
    // - Latin letters
    // - digits
    // - spaces
    // - common punctuation
    //
    // Maximum length:
    // 32 characters
    //
    // Forbidden:
    //
    // - quotes
    // - backslash
    // - control characters
    //

    validateComment(comment) {


        const value =
            String(
                comment ?? ""
            ).trim();


        if (
            value.length > 32
        ) {

            throw new Error(
                safeT("clients.validation.too_long")
            );

        }


        if (
            !/^[\p{L}\p{N}\s.,!?_():;-]*$/u.test(
                value
            )
        ) {

            throw new Error(
                safeT("clients.validation.invalid_chars")
            );

        }


        return value;

    },


    //
    // mutations
    //

    async add(comment) {


        const validatedComment =
            this.validateComment(
                comment
            );


        await ClientEntityLayer.add(
            validatedComment
        );


        await this.refresh();

    },


    async update(id, comment) {


        const validatedComment =
            this.validateComment(
                comment
            );


        await ClientEntityLayer.update(
            id,
            validatedComment
        );


        await this.refresh();

    },


    async remove(id) {

        await ClientEntityLayer.remove(
            id
        );

        await this.refresh();

    },


    //
    // subscriptions
    //

    subscribe(callback) {

        Store.subscribe(
            "clients",
            callback
        );

    }

};


window.ClientStore =
    ClientStore;