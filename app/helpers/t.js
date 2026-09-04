import { inject as service } from "@ember/service";
import { observer, get } from "@ember/object";
import Helper from "@ember/component/helper";
import translate from "splittypie/utils/translate";

export default Helper.extend({
    locale: service(),

    compute([key], hash) {
        return translate(get(this, "locale.current"), key, hash);
    },

    // helpers don't automatically track service property reads, so this
    // needs to explicitly recompute when the locale changes
    localeDidChange: observer("locale.current", function () {
        this.recompute();
    }),
});
