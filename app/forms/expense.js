import { equal, oneWay } from "@ember/object/computed";
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
            validator("presence", {
                presence: true,
                // a deposit's amount is derived from its contributions,
                // not typed in directly
                disabled: oneWay("model.isDeposit"),
            }),
            validator("number", { allowString: true, disabled: oneWay("model.isDeposit") }),
        ],
    },
    payer: validator("presence", {
        presence: true,
        disabled: oneWay("model.isDeposit"),
    }),
    participants: validator("presence", {
        presence: true,
        disabled: oneWay("model.isDeposit"),
    }),
});

export default FormObject.extend(Validations, {
    modelName: "transaction",

    event: oneWay("model.event"),
    isSaving: oneWay("event.isSaving"),

    isDeposit: equal("type", "deposit"),

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

    init() {
        this._super(...arguments);
        const model = get(this, "model");

        setProperties(
            this,
            getProperties(
                model,
                "name", "isTransfer", "date", "amount", "payer", "participants", "obeyFactors",
                "type"
            )
        );
        set(this, "participants", getWithDefault(model, "participants", []).toArray());
        set(this, "_factorOverrides", Object.assign({}, getWithDefault(model, "participantFactors", {})));
        set(this, "_contributions", Object.assign({}, getWithDefault(model, "contributions", {})));
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

        if (get(this, "isDeposit")) {
            const contributions = {};

            get(this, "contributionEntries").forEach((entry) => {
                const amount = parseFloat(get(entry, "amount"));

                if (amount > 0) {
                    contributions[get(entry, "user.id")] = amount;
                }
            });

            set(model, "amount", get(this, "totalContributions"));
            set(model, "payer", null);
            set(model, "participants", []);
            set(model, "participantFactors", {});
            set(model, "contributions", contributions);

            return;
        }

        const overrides = get(this, "_factorOverrides");
        const participantFactors = {};

        get(this, "participants").forEach((participant) => {
            participantFactors[get(participant, "id")] = overrides[get(participant, "id")];
        });

        setProperties(
            model,
            getProperties(this, "amount", "payer", "participants", "obeyFactors")
        );
        set(model, "participantFactors", participantFactors);
        set(model, "contributions", {});
    },
});
