import { get, computed } from "@ember/object";
import ModelMixin from "splittypie/mixins/model-mixin";
import Model from "ember-data/model";
import attr from "ember-data/attr";
import { belongsTo } from "ember-data/relationships";

export default Model.extend(ModelMixin, {
    name: attr("string"),
    factor: attr("number", { defaultValue: 1 }),
    event: belongsTo("event", { async: false }),

    factorOrDefault: computed("factor", {
        get() {
            const factor = parseFloat(get(this, "factor"));

            return factor > 0 ? factor : 1;
        },
    }),

    balance: computed(
        "event.transactions.{[],@each.amount,@each.payer,@each.participants,@each.obeyFactors,@each.participantFactors,@each.type}",
        "event.users.@each.factor",
        function () {
            const transactions = get(this, "event.transactions");
            const paidTransactions = transactions.filterBy("payer", this);
            const owedTransactions = transactions.filter(
                t => get(t, "participants").includes(this)
            );
            // a donation flows the other way: the contributor's balance goes
            // down and everyone they're crediting goes up, so it's split
            // exactly like an expense but with the amount's sign flipped
            const signedAmount = (t) => {
                const amount = parseFloat(get(t, "amount"));

                return get(t, "isDonation") ? -amount : amount;
            };
            const paidMoney = paidTransactions.reduce(
                (acc, t) => acc + signedAmount(t),
                0
            );
            const owedMoney = owedTransactions.reduce((acc, t) => {
                const participants = get(t, "participants");
                const amount = signedAmount(t);

                if (get(t, "obeyFactors") === false) {
                    return acc + (amount / participants.length);
                }

                // a transaction may override a participant's usual factor
                // just for itself, e.g. only 1 of a family of 3 had a drink
                const participantFactors = get(t, "participantFactors") || {};
                const factorFor = (p) => {
                    const override = parseFloat(participantFactors[get(p, "id")]);

                    return override > 0 ? override : get(p, "factorOrDefault");
                };
                const totalFactor = participants.reduce(
                    (sum, p) => sum + factorFor(p),
                    0
                );

                return acc + (amount * factorFor(this) / totalFactor);
            }, 0);

            return (paidMoney - owedMoney).toFixed(2);
        }
    ),
});
