import { alias } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { get, computed } from "@ember/object";
import BaseForm from "splittypie/components/base-form";
import { transactionTypesFor } from "splittypie/forms/expense";

export default BaseForm.extend({
    formObject: alias("transaction"),
    locale: service(),

    transactionTypes: computed("locale.current", function () {
        return transactionTypesFor(get(this, "locale.current"));
    }),

    didInsertElement() {
        if (get(this, "formObject.isNew")) {
            this.$(".transaction-name").focus();
        }
    },

    maxDate: computed(function () {
        return `${new Date().getFullYear()}-12-31`;
    }),

    actions: {
        addAmount() {
            get(this, "formObject").addAmount();
        },

        removeAmount(entry) {
            get(this, "formObject").removeAmount(entry);
        },
    },
});
