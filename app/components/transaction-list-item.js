import { inject as service } from "@ember/service";
import { get, computed } from "@ember/object";
import Component from "@ember/component";
import translate from "splittypie/utils/translate";

export default Component.extend({
    classNames: ["list-group-item", "btn", "btn-default", "transaction-list-item"],

    locale: service(),

    participants: computed("transaction.participants", function () {
        return get(this, "transaction.participants").getEach("name").join(", ");
    }),

    verb: computed("transaction.isDonation", "locale.current", function () {
        const key = get(this, "transaction.isDonation") ? "transactionListItem.donatedFor" : "transactionListItem.paidFor";

        return translate(get(this, "locale.current"), key);
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
