import { alias } from "@ember/object/computed";
import { get, computed } from "@ember/object";
import BaseForm from "splittypie/components/base-form";
import { TRANSACTION_TYPES } from "splittypie/forms/expense";

export default BaseForm.extend({
    formObject: alias("transaction"),

    transactionTypes: computed(() => TRANSACTION_TYPES),

    didInsertElement() {
        if (get(this, "formObject.isNew")) {
            this.$(".transaction-name").focus();
        }
    },

    maxDate: computed(function () {
        return `${new Date().getFullYear()}-12-31`;
    }),
});
