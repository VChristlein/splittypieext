import Service, { inject as service } from "@ember/service";
import { set, get } from "@ember/object";

const STORAGE_KEY = "locale";
export const DEFAULT_LOCALE = "en";
export const AVAILABLE_LOCALES = [
    { code: "en", name: "English" },
    { code: "de", name: "Deutsch" },
];

export default Service.extend({
    localStorage: service(),

    current: DEFAULT_LOCALE,

    init() {
        this._super(...arguments);
        const stored = get(this, "localStorage").getItem(STORAGE_KEY);

        if (stored) {
            set(this, "current", stored);
        }
    },

    setLocale(locale) {
        set(this, "current", locale);
        get(this, "localStorage").setItem(STORAGE_KEY, locale);
    },
});
