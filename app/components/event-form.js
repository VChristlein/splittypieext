import { oneWay, alias } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { get } from "@ember/object";
import BaseForm from "splittypie/components/base-form";
import exportEventToExcel from "splittypie/utils/export-event-to-excel";

export default BaseForm.extend({
    store: service(),
    notify: service(),

    formObject: alias("event"),
    isSubmitted: oneWay("event.isSubmitted"),

    didInsertElement() {
        if (get(this, "formObject.isNew")) {
            this.$(".event-name").focus();
        }
    },

    actions: {
        addUser() {
            const event = get(this, "event");

            event.addUser();
        },

        syncOnline() {
            this.onSyncOnline(get(this, "event.model"));
        },

        exportToExcel() {
            exportEventToExcel(get(this, "event.model")).catch(() => {
                get(this, "notify").error("Could not export to Excel");
            });
        },
    },
});
