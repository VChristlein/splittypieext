import { get } from "@ember/object";
import { inject as service } from "@ember/service";
import Component from "@ember/component";
import { AVAILABLE_LOCALES } from "splittypie/services/locale";

export default Component.extend({
    tagName: "div",
    classNames: ["switch-locale-dropdown"],

    locale: service(),
    availableLocales: AVAILABLE_LOCALES,

    actions: {
        change(option) {
            get(this, "locale").setLocale(get(option, "code"));
        },
    },
});
