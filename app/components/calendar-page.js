import { computed, get } from "@ember/object";
import { inject as service } from "@ember/service";
import Component from "@ember/component";
import leftPad from "splittypie/utils/left-pad";

const MONTHS = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};

export default Component.extend({
    classNames: ["calendar-page"],

    locale: service(),

    day: computed("date", function () {
        const date = get(this, "date");

        return leftPad("00", new Date(date).getUTCDate().toString());
    }),

    month: computed("date", "locale.current", function () {
        const date = get(this, "date");
        const months = MONTHS[get(this, "locale.current")] || MONTHS.en;

        return months[new Date(date).getUTCMonth()];
    }),
});
