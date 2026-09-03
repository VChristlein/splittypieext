import { get, computed } from "@ember/object";
import Component from "@ember/component";

export default Component.extend({
    classNames: ["list-group-item", "btn", "btn-default", "transaction-list-item"],

    participants: computed("transaction.participants", function () {
        return get(this, "transaction.participants").getEach("name").join(", ");
    }),

    verb: computed("transaction.{isDonation,isDeposit}", function () {
        if (get(this, "transaction.isDonation")) {
            return "donated for";
        }

        if (get(this, "transaction.isDeposit")) {
            return "deposited for";
        }

        return "paid for";
    }),

    click() {
        const onClick = get(this, "onClick");

        if (typeof onClick === "function") {
            onClick();
        }
    },
});
