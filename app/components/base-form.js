import { inject as service } from "@ember/service";
import { get, computed } from "@ember/object";
import Component from "@ember/component";
import translate from "splittypie/utils/translate";

export default Component.extend({
    formObject: null,
    modal: service(),
    locale: service(),

    saveButtonText: computed("formObject.{isNew,isSaving}", "locale.current", function () {
        const isNew = get(this, "formObject.isNew");
        const isSaving = get(this, "formObject.isSaving");
        const locale = get(this, "locale.current");

        if (isSaving) {
            return translate(locale, "common.saving");
        }

        return translate(locale, isNew ? "common.create" : "common.save");
    }),

    actions: {
        save() {
            const formObject = get(this, "formObject");

            if (formObject.updateModel()) {
                this.onModelUpdated(get(formObject, "model"));
            }
        },

        delete() {
            const model = get(this, "formObject.model");

            get(this, "modal").onConfirm(
                () => this.onDelete(model)
            );
        },
    },
});
