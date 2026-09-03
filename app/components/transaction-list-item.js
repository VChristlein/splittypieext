import { get, computed } from "@ember/object";
import Component from "@ember/component";

export default Component.extend({
    classNames: ["list-group-item", "btn", "btn-default", "transaction-list-item"],

    participants: computed("transaction.participants", function () {
        return get(this, "transaction.participants").getEach("name").join(", ");
    }),

    verb: computed("transaction.isDonation", function () {
        return get(this, "transaction.isDonation") ? "donated for" : "paid for";
    }),

    // a deposit has no single payer, so list out who put in what
    contributors: computed("transaction.{contributions,event.users.[]}", function () {
        const contributions = get(this, "transaction.contributions") || {};
        const users = get(this, "transaction.event.users") || [];

        return users
            .filter(user => contributions[get(user, "id")] > 0)
            .map(user => `${get(user, "name")} (${contributions[get(user, "id")]})`)
            .join(", ");
    }),

    click() {
        const onClick = get(this, "onClick");

        if (typeof onClick === "function") {
            onClick();
        }
    },
});
