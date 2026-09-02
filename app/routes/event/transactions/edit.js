import { inject as service } from "@ember/service";
import { setProperties, get } from "@ember/object";
import Route from "@ember/routing/route";

export default Route.extend({
    notify: service(),
    transactionRepository: service(),

    model(params) {
        return this.store.findRecord("transaction", params.transaction_id);
    },

    setupController(controller, model) {
        this._super(controller, model);
        // donations/deposits are edited with the same form as expenses,
        // just with a different type selected
        const formName = get(model, "isTransfer") ? "transfer" : "expense";
        const form = get(this, "formFactory").createForm(formName, model);
        setProperties(controller, {
            form,
            users: get(this.modelFor("event"), "users"),
        });
    },

    renderTemplate() {
        this.render({ into: "application" });
    },

    actions: {
        delete(transaction) {
            get(this, "transactionRepository")
                .remove(transaction)
                .then(() => {
                    this.transitionTo("event.transactions");
                    get(this, "notify").success("Transaction has been deleted.");
                });
        },

        modelUpdated(transaction) {
            const event = this.modelFor("event");

            get(this, "transactionRepository")
                .save(event, transaction)
                .then(() => {
                    this.transitionTo("event.transactions");
                    get(this, "notify").success("Transaction has been changed.");
                });
        },
    },
});
