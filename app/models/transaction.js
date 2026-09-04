import { equal } from "@ember/object/computed";
import { get, computed } from "@ember/object";
import ModelMixin from "splittypie/mixins/model-mixin";
import Model from "ember-data/model";
import attr from "ember-data/attr";
import { belongsTo, hasMany } from "ember-data/relationships";

export default Model.extend(ModelMixin, {
    name: attr("string"),
    amount: attr("number"),
    // an expense/donation's amount can be entered as several individual
    // amounts (e.g. a family's several separate purchases) that get summed
    // into "amount" - empty/absent for a transaction with just one amount
    amounts: attr({ defaultValue: () => [] }),
    date: attr("string"),
    event: belongsTo("event", { async: false }),
    payer: belongsTo("user", { async: false }),
    participants: hasMany("user", { async: false }),
    type: attr("string", { defaultValue: "expense" }),
    obeyFactors: attr("boolean", { defaultValue: true }),
    // per-transaction override of each participant's factor, keyed by user id
    participantFactors: attr({ defaultValue: () => ({}) }),
    // per-user amount, keyed by user id, entered directly rather than
    // computed by dividing anything - for a deposit, how much each person
    // already put in (credited); for an itemized expense, how much each
    // person specifically owes the payer (debited)
    contributions: attr({ defaultValue: () => ({}) }),
    // when set, this transaction was actually paid in a different currency
    // than the event's - "amount"/"amounts"/"contributions" always stay in
    // the event's currency (already multiplied by exchangeRate) so balance
    // math never has to think about currencies; "originalAmounts"/
    // "originalContributions" keep what was actually typed in, in this
    // currency, purely so the form can show/edit them un-converted later
    currency: belongsTo("currency", { async: true }),
    exchangeRate: attr("number", { defaultValue: 1 }),
    originalAmounts: attr({ defaultValue: () => [] }),
    originalContributions: attr({ defaultValue: () => ({}) }),

    // the pre-conversion total, for display next to the converted amount -
    // falls back to 0 (rather than the converted amount) when there's no
    // foreign currency, since callers should only show this when "currency"
    // is set
    originalAmount: computed("originalAmounts.[]", "originalContributions", function () {
        const amounts = get(this, "originalAmounts") || [];

        if (amounts.length) {
            return amounts.reduce((sum, value) => {
                const parsed = parseFloat(value);

                return sum + (parsed > 0 ? parsed : 0);
            }, 0);
        }

        const contributions = get(this, "originalContributions") || {};

        return Object.values(contributions).reduce((sum, value) => {
            const parsed = parseFloat(value);

            return sum + (parsed > 0 ? parsed : 0);
        }, 0);
    }),

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
    // a donation is split among its participants just like an expense, but
    // credits them instead of debiting them - see models/user.js#balance
    isDonation: equal("type", "donation"),
    isDeposit: equal("type", "deposit"),
    // like a deposit, each amount is entered directly per person instead of
    // computed from a factor, but this one has a real payer who gets
    // credited the total, same as a regular expense
    isItemized: equal("type", "itemized"),
});
