import { inject as service } from "@ember/service";
import { observer, get } from "@ember/object";
import Helper from "@ember/component/helper";
import formatMoney from "accounting/format-money";

// wraps accounting.js's formatMoney (the vendor lib ember-cli-accounting
// wraps) so amounts use German number formatting (1.234,56 instead of
// 1,234.56) when that's the locale

export default Helper.extend({
    locale: service(),

    compute([value], hash) {
        const isGerman = get(this, "locale.current") === "de";
        const localeOptions = isGerman
            ? { decimal: ",", thousand: "." }
            : { decimal: ".", thousand: "," };

        return formatMoney(value, Object.assign({}, localeOptions, hash));
    },

    localeDidChange: observer("locale.current", function () {
        this.recompute();
    }),
});
