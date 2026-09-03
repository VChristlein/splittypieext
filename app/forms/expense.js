import { equal, or, oneWay } from "@ember/object/computed";
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

import FormObject from "./form-object";

export const TRANSACTION_TYPES = [
    { value: "expense", label: "Expense" },
    { value: "donation", label: "Donation (e.g. birthday gift)" },
    { value: "deposit", label: "Deposit (e.g. prepayment)" },
    { value: "itemized", label: "Itemized expense (exact amount per person)" },
];

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

    event: oneWay("model.event"),
    isSaving: oneWay("event.isSaving"),

    isDeposit: equal("type", "deposit"),
    isItemized: equal("type", "itemized"),
    usesContributionEntries: or("isDeposit", "isItemized"),

    selectedTransactionType: computed("type", {
        get() {
            return TRANSACTION_TYPES.findBy("value", get(this, "type"));
        },
        set(key, option) {
            set(this, "type", get(option, "value"));

            return option;
        },
    }),

    payerLabel: computed("type", function () {
        return get(this, "type") === "donation" ? "Who's donating?" : "Who paid?";
    }),

    participantsLabel: computed("type", function () {
        return get(this, "type") === "donation"
            ? "Credit this donation to (split according to their weight):"
            : "Divide the cost among:";
    }),

    contributionsLabel: computed("type", function () {
        return get(this, "isItemized")
            ? "How much does each person owe?"
            : "How much has each person already put in?";
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
        set(this, "_contributions", Object.assign({}, getWithDefault(model, "contributions", {})));

        const existingAmounts = getWithDefault(model, "amounts", []);
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

        setProperties(model, getProperties(this, "name", "date", "type"));

        if (get(this, "usesContributionEntries")) {
            const contributions = {};

            get(this, "contributionEntries").forEach((entry) => {
                const amount = parseFloat(get(entry, "amount"));

                if (amount > 0) {
                    contributions[get(entry, "user.id")] = amount;
                }
            });

            // a deposit has no single payer; an itemized expense does, same
            // as a regular expense
            setProperties(model, {
                amount: get(this, "amount"),
                amounts: [],
                payer: get(this, "isDeposit") ? null : get(this, "payer"),
                participants: [],
                participantFactors: {},
                contributions,
            });

            return;
        }

        const overrides = get(this, "_factorOverrides");
        const participantFactors = {};

        get(this, "participants").forEach((participant) => {
            participantFactors[get(participant, "id")] = overrides[get(participant, "id")];
        });

        const amounts = get(this, "amountEntries")
            .map(entry => parseFloat(get(entry, "value")))
            .filter(value => value > 0);

        setProperties(
            model,
            getProperties(this, "amount", "payer", "participants", "obeyFactors")
        );
        set(model, "amounts", amounts);
        set(model, "participantFactors", participantFactors);
        set(model, "contributions", {});
    },
});
