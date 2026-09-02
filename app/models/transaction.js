import { equal, or } from "@ember/object/computed";
import { get, computed } from "@ember/object";
import ModelMixin from "splittypie/mixins/model-mixin";
import Model from "ember-data/model";
import attr from "ember-data/attr";
import { belongsTo, hasMany } from "ember-data/relationships";

export default Model.extend(ModelMixin, {
    name: attr("string"),
    amount: attr("number"),
    date: attr("string"),
    event: belongsTo("event", { async: false }),
    payer: belongsTo("user", { async: false }),
    participants: hasMany("user", { async: false }),
    type: attr("string", { defaultValue: "expense" }),
    obeyFactors: attr("boolean", { defaultValue: true }),
    // per-transaction override of each participant's factor, keyed by user id
    participantFactors: attr({ defaultValue: () => ({}) }),
    typeOrDefault: computed("type", {
        // FIXME: I don't like this typeOrDefault
        get() {
            return get(this, "type") || "expense";
        },
    }),

    month: computed("date", function () {
        const date = get(this, "date");

        if (date) {
            return date.substring(0, 7);
        }

        return null;
    }),

    isTransfer: equal("type", "transfer"),
    isDonation: equal("type", "donation"),
    isDeposit: equal("type", "deposit"),
    // a one-way contribution into the pot: only the contributor's balance
    // moves, nobody is considered to owe it back
    isContribution: or("isDonation", "isDeposit"),
});
