import en from "splittypie/locales/en";
import de from "splittypie/locales/de";

const DICTIONARIES = { en, de };

// simple {{placeholder}} interpolation, e.g. translate("en", "hi", { name: "Bob" })
// for a dictionary entry "hi": "Hello {{name}}"
export default function translate(locale, key, params) {
    const dictionary = DICTIONARIES[locale] || DICTIONARIES.en;
    let text = dictionary[key];

    if (text === undefined) {
        text = DICTIONARIES.en[key];
    }

    if (text === undefined) {
        return key;
    }

    if (params) {
        Object.keys(params).forEach((paramKey) => {
            text = text.split(`{{${paramKey}}}`).join(params[paramKey]);
        });
    }

    return text;
}
