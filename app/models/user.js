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
        "event.transactions.{[],@each.amount,@each.payer,@each.participants,@each.obeyFactors,@each.participantFactors,@each.type,@each.contributions}",
        "event.users.@each.factor",
        function () {
            const transactions = get(this, "event.transactions");
            // a deposit isn't a single payer split among participants - it's
            // each person's own already-contributed amount, so it's handled
            // separately below instead of through the payer/participants math
            const depositTransactions = transactions.filterBy("isDeposit");
            // an itemized expense has a real payer (handled below, same as
            // any other expense) but each participant's share is entered
            // directly instead of derived from a factor
            const itemizedTransactions = transactions.filterBy("isItemized");
            const factorBasedTransactions = transactions.reject(
                t => get(t, "isDeposit") || get(t, "isItemized")
            );

            const paidTransactions = transactions.rejectBy("isDeposit").filterBy("payer", this);
            // a deposit's payer, when set, is who the money is actually
            // going to (e.g. one person collecting everyone's prepayment) -
            // they're debited the total collected, same as a transfer
            // recipient, rather than crediting a fictional "payer"
            const directedDepositTransactions = depositTransactions.filter(
                t => get(t, "payer") === this
            );
            const owedTransactions = factorBasedTransactions.filter(
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

            // a deposit credits each contributor with exactly what they put
            // in, independent of everyone else's contribution
            const depositCredit = depositTransactions.reduce((acc, t) => {
                const contributions = get(t, "contributions") || {};
                const myContribution = parseFloat(contributions[get(this, "id")]);

                return acc + (myContribution > 0 ? myContribution : 0);
            }, 0);

            // if the deposit is directed at someone, they're debited the
            // full amount collected - they're now holding it on behalf of
            // the group until it's actually spent (recorded separately)
            const directedDepositDebit = directedDepositTransactions.reduce((acc, t) => {
                const contributions = get(t, "contributions") || {};
                const total = Object.values(contributions).reduce((sum, value) => {
                    const parsed = parseFloat(value);

                    return sum + (parsed > 0 ? parsed : 0);
                }, 0);

                return acc + total;
            }, 0);

            // an itemized expense debits each person exactly the amount
            // assigned to them, with no factor involved
            const itemizedOwed = itemizedTransactions.reduce((acc, t) => {
                const contributions = get(t, "contributions") || {};
                const myShare = parseFloat(contributions[get(this, "id")]);

                return acc + (myShare > 0 ? myShare : 0);
            }, 0);

            // deliberately NOT rounded here - rounding each person's balance
            // independently (e.g. a $10 expense split 3 ways: 6.67 + -3.33 +
            // -3.33 = 0.01, not 0) used to leave the group's balances not
            // summing to exactly zero. Round only where a balance is
            // actually displayed or turned into a real payment.
            return paidMoney - owedMoney - itemizedOwed + depositCredit - directedDepositDebit;
        }
    ),
});
