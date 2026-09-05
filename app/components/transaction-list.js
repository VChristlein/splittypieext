import { notEmpty, filterBy } from "@ember/object/computed";
import EmberObject, { get, computed } from "@ember/object";
import Component from "@ember/component";

export default Component.extend({
    tagName: "div",
    classNames: ["list-group"],

    searchQuery: "",

    anyTransactions: notEmpty("transactions"),
    anyFilteredTransactions: notEmpty("filteredTransactions"),
    isSearching: notEmpty("searchQuery"),

    filteredTransactions: computed("transactions.[]", "searchQuery", function () {
        const transactions = get(this, "transactions");
        const query = (get(this, "searchQuery") || "").trim().toLowerCase();

        if (!query) {
            return transactions;
        }

        return transactions.filter(
            transaction => (get(transaction, "name") || "").toLowerCase().indexOf(query) > -1
        );
    }),

    expenses: filterBy("filteredTransactions", "typeOrDefault", "expense"),
    transactionsByMonth: computed("filteredTransactions.[]", function () {
        const result = [];
        const transactions = get(this, "filteredTransactions").sortBy("date").reverse();

        transactions.forEach((transaction) => {
            const month = get(transaction, "month");
            const group = result.findBy("month", month);

            if (!group) {
                result.pushObject(
                    EmberObject.create({ month, transactions: [transaction] })
                );
            } else {
                get(group, "transactions").pushObject(transaction);
            }
        });

        return result;
    }),
    anyTransactionWithDate: computed("filteredTransactions.[]", function () {
        const transactions = get(this, "filteredTransactions");

        return transactions.any(transaction => !!get(transaction, "date"));
    }),

    actions: {
        edit(transaction) {
            this.onEdit(transaction);
        },
    },
});
