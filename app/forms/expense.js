import { equal, or, oneWay } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { A } from "@ember/array";
import EmberObject, {
  computed,
  getWithDefault,
  setProperties,
  getProperties,
  set,
  get
} from "@ember/object";
import { validator, buildValidations } from "ember-cp-validations";
import { resolve } from "rsvp";

import FormObject from "./form-object";
import translate from "splittypie/utils/translate";
import fetchExchangeRate from "splittypie/utils/fetch-exchange-rate";

const TRANSACTION_TYPE_KEYS = [
    { value: "expense", labelKey: "transactionType.expense" },
    { value: "donation", labelKey: "transactionType.donation" },
    { value: "deposit", labelKey: "transactionType.deposit" },
    { value: "itemized", labelKey: "transactionType.itemized" },
];

export function transactionTypesFor(locale) {
    return TRANSACTION_TYPE_KEYS.map(({ value, labelKey }) => ({
        value,
        label: translate(locale, labelKey),
    }));
}

const Validations = buildValidations({
    name: {
        validators: [
            validator("presence", true),
            validator("length", { max: 50 }),
        ],
    },
    amount: {
        validators: [
            // amount is always derived now (summed from one or more entries),
            // so a plain presence check would pass even with nothing entered
            // (0 isn't "blank") - require it to be a real positive number
            validator("number", { allowString: true, gt: 0 }),
        ],
    },
    payer: validator("presence", {
        presence: true,
        disabled: oneWay("model.isDeposit"),
    }),
    participants: validator("presence", {
        presence: true,
        disabled: oneWay("model.usesContributionEntries"),
    }),
});

export default FormObject.extend(Validations, {
    modelName: "transaction",

    locale: service(),
    ajax: service(),

    event: oneWay("model.event"),
    isSaving: oneWay("event.isSaving"),

    // the currency this transaction was actually paid in - falls back to
    // the event's own currency until the user picks a different one. Note:
    // an unset async belongsTo (an unloaded "currency") still resolves to a
    // truthy PromiseObject wrapping null content, so a plain `||` fallback
    // would never reach event.currency - checking "id" tells them apart. A
    // brand new transaction's model is a plain EmberObject though (not an
    // ember-data record), so _currency can genuinely be undefined there -
    // get() throws on an undefined target, hence the `currency &&` guard
    transactionCurrency: computed("_currency", "event.currency", {
        get() {
            const currency = get(this, "_currency");

            return currency && get(currency, "id") ? currency : get(this, "event.currency");
        },
        set(key, currency) {
            set(this, "_currency", currency);
            this._fetchExchangeRate(currency);

            return currency;
        },
    }),

    isForeignCurrency: computed("transactionCurrency", "event.currency", function () {
        const currency = get(this, "transactionCurrency");
        const eventCurrency = get(this, "event.currency");

        // compare by id, not object identity - an async belongsTo (like
        // both of these) returns a brand new PromiseObject wrapper on every
        // get(), even for the same underlying record
        return !!currency && get(currency, "id") !== get(eventCurrency, "id");
    }),

    // amount/totalContributions above are always in transactionCurrency (what
    // was actually typed in) - these are the same totals converted into the
    // event's currency, for a live preview while the rate is being edited
    convertedAmount: computed("amount", "exchangeRate", function () {
        return get(this, "amount") * (parseFloat(get(this, "exchangeRate")) || 1);
    }),

    convertedTotalContributions: computed("totalContributions", "exchangeRate", function () {
        return get(this, "totalContributions") * (parseFloat(get(this, "exchangeRate")) || 1);
    }),

    refreshExchangeRate() {
        return this._fetchExchangeRate(get(this, "transactionCurrency"));
    },

    // returns the underlying fetch's promise (resolved immediately when no
    // fetch is needed) purely so tests can wait on it - nothing in the app
    // itself uses the return value
    _fetchExchangeRate(currency) {
        const eventCurrency = get(this, "event.currency");

        if (!currency || !eventCurrency || get(currency, "id") === get(eventCurrency, "id")) {
            set(this, "exchangeRate", 1);
            set(this, "rateFetchFailed", false);

            return resolve();
        }

        set(this, "isFetchingRate", true);
        set(this, "rateFetchFailed", false);

        return fetchExchangeRate(get(this, "ajax"), get(currency, "code"), get(eventCurrency, "code"))
            .then((rate) => {
                set(this, "exchangeRate", rate);
                set(this, "isFetchingRate", false);
            })
            .catch(() => {
                set(this, "rateFetchFailed", true);
                set(this, "isFetchingRate", false);
            });
    },

    isDeposit: equal("type", "deposit"),
    isItemized: equal("type", "itemized"),
    usesContributionEntries: or("isDeposit", "isItemized"),

    selectedTransactionType: computed("type", "locale.current", {
        get() {
            return transactionTypesFor(get(this, "locale.current")).findBy("value", get(this, "type"));
        },
        set(key, option) {
            set(this, "type", get(option, "value"));

            return option;
        },
    }),

    payerLabel: computed("type", "locale.current", function () {
        const locale = get(this, "locale.current");
        const key = {
            donation: "transactionForm.payerLabelDonation",
            deposit: "transactionForm.payerLabelDeposit",
        }[get(this, "type")] || "transactionForm.payerLabelDefault";

        return translate(locale, key);
    }),

    participantsLabel: computed("type", "locale.current", function () {
        const key = get(this, "type") === "donation"
            ? "transactionForm.participantsLabelDonation"
            : "transactionForm.participantsLabelDefault";

        return translate(get(this, "locale.current"), key);
    }),

    contributionsLabel: computed("isItemized", "locale.current", function () {
        const key = get(this, "isItemized")
            ? "transactionForm.contributionsLabelItemized"
            : "transactionForm.contributionsLabelDeposit";

        return translate(get(this, "locale.current"), key);
    }),

    // amount is always derived: from amountEntries for an expense/donation,
    // or from contributionEntries for a deposit/itemized expense
    amount: computed("usesContributionEntries", "totalAmount", "totalContributions", function () {
        return get(this, "usesContributionEntries")
            ? get(this, "totalContributions")
            : get(this, "totalAmount");
    }),

    init() {
        this._super(...arguments);
        const model = get(this, "model");

        setProperties(
            this,
            getProperties(
                model,
                "name", "isTransfer", "date", "payer", "participants", "obeyFactors", "type"
            )
        );
        set(this, "participants", getWithDefault(model, "participants", []).toArray());
        set(this, "_factorOverrides", Object.assign({}, getWithDefault(model, "participantFactors", {})));

        // read straight from the model here, bypassing the transactionCurrency
        // setter, so loading an existing transaction doesn't trigger a rate
        // fetch - only the user actively picking a new currency should
        set(this, "_currency", get(model, "currency"));
        set(this, "exchangeRate", getWithDefault(model, "exchangeRate", 1));

        // once a foreign currency is set, the entry fields should show/edit
        // what was actually typed in (originalAmounts/originalContributions),
        // not the already-converted amounts/contributions used for balances.
        // Note: getWithDefault only substitutes its default for `undefined`,
        // but a transaction saved before these fields existed can come back
        // from the offline/localforage store with them explicitly `null`
        const originalContributions = getWithDefault(model, "originalContributions", {}) || {};
        const contributions = Object.keys(originalContributions).length
            ? originalContributions
            : (getWithDefault(model, "contributions", {}) || {});

        set(this, "_contributions", Object.assign({}, contributions));

        const originalAmounts = getWithDefault(model, "originalAmounts", []) || [];
        const existingAmounts = originalAmounts.length
            ? originalAmounts
            : (getWithDefault(model, "amounts", []) || []);
        const modelAmount = get(model, "amount");
        const seedAmounts = existingAmounts.length
            ? existingAmounts
            : [modelAmount === undefined || modelAmount === null ? null : modelAmount];

        set(this, "_amounts", A(seedAmounts.map(value => ({ value }))));
    },

    // one row per individual amount making up this transaction's total,
    // e.g. a family's several separate purchases entered as one transaction
    amountEntries: computed("_amounts.[]", function () {
        return get(this, "_amounts").map(holder => EmberObject.extend({
            value: computed({
                get() {
                    return holder.value;
                },
                set(key, value) {
                    holder.value = value;

                    return value;
                },
            }),
        }).create({ _holder: holder }));
    }),

    hasMultipleAmounts: computed("amountEntries.length", function () {
        return get(this, "amountEntries.length") > 1;
    }),

    totalAmount: computed("amountEntries.@each.value", function () {
        return get(this, "amountEntries").reduce((sum, entry) => {
            const value = parseFloat(get(entry, "value"));

            return sum + (value > 0 ? value : 0);
        }, 0);
    }),

    addAmount() {
        get(this, "_amounts").pushObject({ value: null });
    },

    removeAmount(entry) {
        get(this, "_amounts").removeObject(get(entry, "_holder"));
    },

    // one row per person in the event for entering how much they've already
    // put towards a deposit directly, instead of one amount split any way
    contributionEntries: computed("event.users.[]", function () {
        const contributions = get(this, "_contributions");

        return (get(this, "event.users") || []).map((user) => {
            const id = get(user, "id");

            return EmberObject.extend({
                amount: computed({
                    get() {
                        return contributions[id];
                    },
                    set(key, value) {
                        contributions[id] = value;

                        return value;
                    },
                }),
            }).create({ user });
        });
    }),

    totalContributions: computed("contributionEntries.@each.amount", function () {
        return get(this, "contributionEntries").reduce((sum, entry) => {
            const amount = parseFloat(get(entry, "amount"));

            return sum + (amount > 0 ? amount : 0);
        }, 0);
    }),

    // one editable row per selected participant, showing their usual factor
    // (or this transaction's override, if one was already set) which can be
    // tweaked just for this transaction without touching their global factor
    participantFactorEntries: computed("participants.[]", function () {
        const overrides = get(this, "_factorOverrides");

        return get(this, "participants").map((participant) => {
            const id = get(participant, "id");

            if (!(id in overrides)) {
                overrides[id] = get(participant, "factorOrDefault") || 1;
            }

            return EmberObject.extend({
                factor: computed({
                    get() {
                        return overrides[id];
                    },
                    set(key, value) {
                        overrides[id] = value;

                        return value;
                    },
                }),
            }).create({ participant });
        });
    }),

    updateModelAttributes() {
        const model = get(this, "model");
        const isForeignCurrency = get(this, "isForeignCurrency");
        const rate = parseFloat(get(this, "exchangeRate")) || 1;

        setProperties(model, getProperties(this, "name", "date", "type"));
        set(model, "currency", isForeignCurrency ? get(this, "transactionCurrency") : null);
        set(model, "exchangeRate", isForeignCurrency ? rate : 1);

        if (get(this, "usesContributionEntries")) {
            const originalContributions = {};
            const contributions = {};

            get(this, "contributionEntries").forEach((entry) => {
                const amount = parseFloat(get(entry, "amount"));

                if (amount > 0) {
                    originalContributions[get(entry, "user.id")] = amount;
                    contributions[get(entry, "user.id")] = amount * rate;
                }
            });

            // a deposit's payer is optional - who this money is going to,
            // if it's headed to one person in particular rather than a
            // general pot; an itemized expense's payer is required, same as
            // a regular expense
            setProperties(model, {
                amount: get(this, "amount") * rate,
                amounts: [],
                originalAmounts: [],
                payer: get(this, "payer"),
                participants: [],
                participantFactors: {},
                contributions,
                originalContributions: isForeignCurrency ? originalContributions : {},
            });

            return;
        }

        const overrides = get(this, "_factorOverrides");
        const participantFactors = {};

        get(this, "participants").forEach((participant) => {
            participantFactors[get(participant, "id")] = overrides[get(participant, "id")];
        });

        const originalAmounts = get(this, "amountEntries")
            .map(entry => parseFloat(get(entry, "value")))
            .filter(value => value > 0);
        const amounts = originalAmounts.map(value => value * rate);

        setProperties(
            model,
            getProperties(this, "payer", "participants", "obeyFactors")
        );
        set(model, "amount", get(this, "amount") * rate);
        set(model, "amounts", amounts);
        set(model, "originalAmounts", isForeignCurrency ? originalAmounts : []);
        set(model, "participantFactors", participantFactors);
        set(model, "contributions", {});
        set(model, "originalContributions", {});
    },
});
