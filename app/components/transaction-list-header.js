import { alias } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { get, computed } from "@ember/object";
import Component from "@ember/component";
import translate from "splittypie/utils/translate";

export default Component.extend({
    classNames: ["transaction-list-header"],

    locale: service(),

    currency: alias("transactions.firstObject.event.currency.code"),
    count: alias("transactions.length"),

    // the pluralize helper only knows English inflection rules (just adds
    // "s"), which is wrong for German, so pick the plural form ourselves
    expenseWord: computed("count", "locale.current", function () {
        const locale = get(this, "locale.current");
        const key = get(this, "count") === 1
            ? "transactionListHeader.expenseSingular"
            : "transactionListHeader.expensePlural";

        return translate(locale, key);
    }),

    total: computed("transactions.[]", function () {
        const transactions = get(this, "transactions");

        return transactions.reduce(
            (prev, curr) => prev + parseFloat(get(curr, "amount")),
            0
        );
    }),
});
